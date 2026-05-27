import logging
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from .models import Conversation, Message
from .twilio_helper import send_sms_via_twilio
from .ai_handler import query_openai_qualification
from apps.leads.models import Lead, LeadActivity
from apps.businesses.models import Business
from apps.authentication.models import User
from apps.appointments.models import Appointment

logger = logging.getLogger(__name__)

@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    max_retries=5
)
def send_sms_task(self, to_number, from_number, body, message_id=None):
    """
    Sends an SMS via Twilio, tracking status and retrying on failures.
    """
    msg = None
    if message_id:
        try:
            msg = Message.objects.get(id=message_id)
            msg.delivery_status = 'sending'
            msg.save()
        except Message.DoesNotExist:
            logger.error(f"Message ID {message_id} not found in send_sms_task.")

    try:
        provider_sid = send_sms_via_twilio(
            to_number=to_number,
            from_number=from_number,
            body=body
        )

        if msg:
            msg.provider_message_id = provider_sid
            msg.delivery_status = 'sent'
            msg.save()
            
            # Log activity
            LeadActivity.objects.create(
                lead=msg.conversation.lead,
                activity_type='sms_sent',
                metadata={"message_id": str(msg.id), "provider_sid": provider_sid}
            )
            
        return provider_sid

    except Exception as exc:
        logger.error(f"Error in send_sms_task to {to_number}: {str(exc)}")
        if msg:
            msg.delivery_status = 'failed'
            msg.error_message = str(exc)
            msg.save()
        raise self.retry(exc=exc)


@shared_task
def generate_ai_reply_task(conversation_id):
    """
    Retrieves the conversation history, queries OpenAI for structured lead details
    and a response, applies updates to models, and dispatches the message.
    """
    try:
        conversation = Conversation.objects.get(id=conversation_id)
    except Conversation.DoesNotExist:
        logger.error(f"Conversation ID {conversation_id} not found in generate_ai_reply_task.")
        return False

    # Only run AI automation if status is AI_ACTIVE
    if conversation.status != 'AI_ACTIVE':
        logger.info(f"AI automation bypassed for Conversation {conversation_id} (Status: {conversation.status}).")
        return False

    # 1. Run LLM pass
    extracted = query_openai_qualification(conversation)
    lead = conversation.lead
    business = conversation.business

    # 2. Update Lead attributes based on extraction
    if extracted.customer_name and extracted.customer_name != lead.name:
        lead.name = extracted.customer_name
    if extracted.address and extracted.address != lead.address:
        lead.address = extracted.address
    if extracted.roof_issue and extracted.roof_issue != lead.roof_issue:
        lead.roof_issue = extracted.roof_issue
    if extracted.preferred_inspection_time and extracted.preferred_inspection_time != lead.preferred_inspection_time:
        lead.preferred_inspection_time = extracted.preferred_inspection_time
    
    # Save urgency if it changes
    if extracted.urgency:
        lead.urgency = extracted.urgency
    lead.priority_score = extracted.priority_score
    lead.save()

    # 3. Handle State Machine & Handover triggers
    new_state = extracted.next_state
    
    if extracted.escalate_to_human or new_state == 'HUMAN_HANDOFF':
        conversation.status = 'HUMAN_HANDOFF'
        conversation.state = 'HUMAN_HANDOFF'
        conversation.save()
        
        # Notify Owner about critical human takeover
        notify_owner_task.delay(
            lead_id=str(lead.id),
            activity_type='human_takeover',
            details=f"AI detected escalation triggers. Conversation with {lead.phone} has been paused. Please log in to take over."
        )
    else:
        conversation.state = new_state
        conversation.save()

    # 4. Save AI's response in DB
    ai_msg = Message.objects.create(
        conversation=conversation,
        sender_type='AI',
        content=extracted.reply,
        delivery_status='queued'
    )

    # Log Activity
    LeadActivity.objects.create(
        lead=lead,
        activity_type='ai_response',
        metadata={"message_id": str(ai_msg.id), "content": extracted.reply}
    )

    # 5. Dispatch via Twilio SMS if channel is SMS
    if conversation.channel == 'SMS':
        send_sms_task.delay(
            to_number=lead.phone,
            from_number=business.phone_number,
            body=extracted.reply,
            message_id=str(ai_msg.id)
        )

    # 6. Schedule follow-ups if this is a qualifying conversation
    if conversation.state in ['QUALIFYING', 'WAITING_FOR_ADDRESS', 'WAITING_FOR_INSPECTION_TIME']:
        # Clear existing scheduled tasks if needed (handled dynamically in tasks)
        schedule_follow_up_campaign_task.apply_async((str(conversation.id), 1), countdown=7200) # 2 hours
        schedule_follow_up_campaign_task.apply_async((str(conversation.id), 2), countdown=86400) # 24 hours
        schedule_follow_up_campaign_task.apply_async((str(conversation.id), 3), countdown=259200) # 3 days

    # 7. Alert owner about bookings
    if conversation.state == 'BOOKING_REQUESTED':
        notify_owner_task.delay(
            lead_id=str(lead.id),
            activity_type='appointment_requested',
            details=f"Lead {lead.name} has qualified and requested a roof inspection: '{lead.preferred_inspection_time}' at {lead.address}."
        )

    return True


@shared_task
def schedule_follow_up_campaign_task(conversation_id, stage):
    """
    Celery task representing the follow-up campaign execution.
    Checks cancellation criteria: bookings, human handover, or closed conversations.
    """
    try:
        conversation = Conversation.objects.get(id=conversation_id)
        lead = conversation.lead
        business = conversation.business
    except Conversation.DoesNotExist:
        return False

    # Cancellation checks:
    # 1. Human takeover active
    if conversation.status == 'HUMAN_HANDOFF':
        logger.info(f"Follow-up stage {stage} cancelled for Conv {conversation_id} (Human takeover).")
        return False

    # 2. Lead has completed booking
    if conversation.state == 'CLOSED' or Appointment.objects.filter(lead=lead, status__in=['PENDING', 'CONFIRMED']).exists():
        logger.info(f"Follow-up stage {stage} cancelled for Conv {conversation_id} (Lead has booked or closed).")
        return False

    # 3. Idempotency check: Ignore duplicate sends for this stage
    already_sent = LeadActivity.objects.filter(
        lead=lead,
        activity_type='sms_sent',
        metadata__follow_up_stage=stage
    ).exists()
    if already_sent:
        logger.info(f"Follow-up stage {stage} already sent for Lead {lead.id}. Skipping.")
        return False

    # Define message content per stage
    name_label = lead.name if (lead.name and not lead.name.startswith("Missed Call")) else "there"
    
    if stage == 1:
        follow_up_text = f"Hey {name_label}, just checking if you still need a roofing inspection for your roof issue?"
    elif stage == 2:
        follow_up_text = f"Hi {name_label}, we have some estimate slots open tomorrow. Would you like us to schedule a free inspection at your property?"
    elif stage == 3:
        follow_up_text = f"Hey {name_label}, we wanted to reach out one last time about your roofing request. Let us know if we can help!"
    else:
        return False

    # Log and dispatch
    msg = Message.objects.create(
        conversation=conversation,
        sender_type='AI',
        content=follow_up_text,
        delivery_status='queued'
    )

    # Dispatch SMS
    if conversation.channel == 'SMS':
        send_sms_task.delay(
            to_number=lead.phone,
            from_number=business.phone_number,
            body=follow_up_text,
            message_id=str(msg.id)
        )

    # Log follow up activity with the stage code
    LeadActivity.objects.create(
        lead=lead,
        activity_type='sms_sent',
        metadata={"message_id": str(msg.id), "follow_up_stage": stage, "type": "campaign"}
    )

    return True


@shared_task
def missed_call_sms_task(business_id, caller_phone, call_sid):
    """
    Fulfills the missed call auto-text back workflow.
    """
    try:
        business = Business.objects.get(id=business_id)
    except Business.DoesNotExist:
        logger.error(f"Business ID {business_id} not found in missed_call_sms_task.")
        return False

    # Idempotency Check
    existing_activity = LeadActivity.objects.filter(
        lead__business=business,
        activity_type='missed_call',
        metadata__call_sid=call_sid
    ).exists()
    
    if existing_activity:
        logger.info(f"Duplicate missed call webhook ignored for Call SID: {call_sid}")
        return False

    lead = Lead.objects.filter(business=business, phone=caller_phone).first()
    if not lead:
        lead = Lead.objects.create(
            business=business,
            name=f"Missed Call {caller_phone[-4:]}",
            phone=caller_phone,
            source='MISSED_CALL',
            status='NEW',
            urgency='STANDARD_ESTIMATE'
        )

    LeadActivity.objects.create(
        lead=lead,
        activity_type='missed_call',
        metadata={"call_sid": call_sid, "timestamp": timezone.now().isoformat()}
    )

    conversation = Conversation.objects.filter(
        business=business,
        lead=lead,
        channel='SMS'
    ).first()
    
    if not conversation or conversation.status == 'COMPLETED':
        conversation = Conversation.objects.create(
            business=business,
            lead=lead,
            channel='SMS',
            status='AI_ACTIVE',
            state='NEW'
        )

    greeting_content = "Hey! Sorry we missed your call. We're currently on a roof helping another customer. What can we help you with today? Leak, storm damage, or estimate?"
    msg = Message.objects.create(
        conversation=conversation,
        sender_type='AI',
        content=greeting_content,
        delivery_status='queued'
    )

    send_sms_task.delay(
        to_number=caller_phone,
        from_number=business.phone_number,
        body=greeting_content,
        message_id=str(msg.id)
    )

    # Schedule follow-up dispatches
    schedule_follow_up_campaign_task.apply_async((str(conversation.id), 1), countdown=7200) # 2 hours
    schedule_follow_up_campaign_task.apply_async((str(conversation.id), 2), countdown=86400) # 24 hours
    schedule_follow_up_campaign_task.apply_async((str(conversation.id), 3), countdown=259200) # 3 days

    notify_owner_task.delay(
        lead_id=str(lead.id),
        activity_type='missed_call',
        details=f"You missed a call from {caller_phone} at {timezone.now().strftime('%I:%M %p')}. RoofReply AI has texted them back to qualify."
    )

    return True


@shared_task
def notify_owner_task(lead_id, activity_type, details):
    """
    Sends owner alerts (via console/SMTP email) when new leads or missed calls occur.
    """
    try:
        lead = Lead.objects.get(id=lead_id)
        business = lead.business
    except Lead.DoesNotExist:
        logger.error(f"Lead ID {lead_id} not found in notify_owner_task.")
        return False

    owners = User.objects.filter(business=business, role='OWNER')
    owner_emails = [owner.email for owner in owners if owner.email]
    
    if not owner_emails and business.email:
        owner_emails = [business.email]

    if not owner_emails:
        logger.warning(f"No owner email contact found to notify for Business {business.company_name}")
        return False

    subject = f"[RoofReply AI Alert] {activity_type.replace('_', ' ').title()}: {lead.name or lead.phone}"
    body = (
        f"Hello,\n\n"
        f"This is an automated operational alert from RoofReply AI for {business.company_name}.\n\n"
        f"Event details:\n"
        f"- Event: {activity_type.replace('_', ' ').upper()}\n"
        f"- Lead Phone: {lead.phone}\n"
        f"- Lead Name: {lead.name}\n"
        f"- Description: {details}\n\n"
        f"Login to your dashboard to review the qualification transcript.\n"
        f"Thank you,\n"
        f"RoofReply AI team"
    )

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=owner_emails,
            fail_silently=False
        )
        logger.info(f"Owner notification email dispatched to {owner_emails} for Lead {lead.id}")
        return True
    except Exception as e:
        logger.error(f"Failed to send owner notification email: {str(e)}")
        return False
