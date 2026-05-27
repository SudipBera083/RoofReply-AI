import logging
from django.http import HttpResponse, HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.conf import settings
from rest_framework.decorators import api_view, throttle_classes, permission_classes
from rest_framework.permissions import AllowAny
from .twilio_helper import validate_twilio_signature
from .models import Conversation, Message
from .tasks import missed_call_sms_task, generate_ai_reply_task
from .throttling import TwilioWebhookRateThrottle
from apps.leads.models import Lead, LeadActivity
from apps.businesses.models import Business

logger = logging.getLogger(__name__)

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([TwilioWebhookRateThrottle])
def twilio_sms_webhook(request):
    """
    Receives incoming SMS messages from Twilio.
    """
    # 1. Signature Verification
    if not validate_twilio_signature(request):
        return HttpResponseForbidden("Invalid Twilio signature.")

    # 2. Extract Details
    msg_sid = request.POST.get('MessageSid', '')
    from_number = request.POST.get('From', '')
    to_number = request.POST.get('To', '')
    body = request.POST.get('Body', '')

    logger.info(f"Incoming SMS Webhook. SID: {msg_sid} | From: {from_number} | To: {to_number}")

    # 3. Idempotency Check
    if msg_sid and Message.objects.filter(provider_message_id=msg_sid).exists():
        logger.info(f"Ignored duplicate Twilio message SID: {msg_sid}")
        return HttpResponse("<Response></Response>", content_type="text/xml")

    # 4. Resolve Business Tenant
    business = Business.objects.filter(phone_number=to_number).first()
    if not business:
        business = Business.objects.first()
        if not business:
            logger.error(f"No business tenant matches Twilio number: {to_number}")
            return HttpResponse("<Response></Response>", content_type="text/xml")

    # 5. Retrieve or Create Lead
    lead = Lead.objects.filter(business=business, phone=from_number).first()
    if not lead:
        lead = Lead.objects.create(
            business=business,
            name=f"Inbound SMS {from_number[-4:]}",
            phone=from_number,
            source='WEBSITE',
            status='NEW'
        )

    # 6. Retrieve or Create Conversation
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

    # 7. Write Lead's Message to DB
    lead_msg = Message.objects.create(
        conversation=conversation,
        sender_type='LEAD',
        content=body,
        provider_message_id=msg_sid,
        delivery_status='delivered'
    )

    # Log Activity
    LeadActivity.objects.create(
        lead=lead,
        activity_type='sms_received',
        metadata={"message_id": str(lead_msg.id), "body": body}
    )

    # 8. Trigger OpenAI Qualification Task asynchronously
    if conversation.status == 'AI_ACTIVE':
        generate_ai_reply_task.delay(str(conversation.id))

    return HttpResponse("<Response></Response>", content_type="text/xml")


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([TwilioWebhookRateThrottle])
def twilio_call_webhook(request):
    """
    Receives Call status callback events from Twilio.
    """
    if not validate_twilio_signature(request):
        return HttpResponseForbidden("Invalid Twilio signature.")

    call_sid = request.POST.get('CallSid', '')
    from_number = request.POST.get('From', '')
    to_number = request.POST.get('To', '')
    call_status = request.POST.get('CallStatus', '')

    logger.info(f"Incoming Voice Webhook. SID: {call_sid} | Status: {call_status} | From: {from_number}")

    missed_statuses = ['busy', 'no-answer', 'failed', 'canceled']

    if call_status in missed_statuses:
        business = Business.objects.filter(phone_number=to_number).first()
        if not business:
            business = Business.objects.first()
            
        if business:
            missed_call_sms_task.delay(
                business_id=str(business.id),
                caller_phone=from_number,
                call_sid=call_sid
            )
        else:
            logger.error(f"No business found to handle missed call from {from_number}")

    return HttpResponse("<Response></Response>", content_type="text/xml")


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([TwilioWebhookRateThrottle])
def twilio_status_callback(request):
    """
    Receives message status delivery reports from Twilio.
    """
    msg_sid = request.POST.get('MessageSid', '')
    msg_status = request.POST.get('MessageStatus', '')
    error_code = request.POST.get('ErrorCode', None)

    logger.info(f"Twilio delivery status report: SID {msg_sid} -> {msg_status}")

    try:
        msg = Message.objects.get(provider_message_id=msg_sid)
        msg.delivery_status = msg_status
        if error_code:
            msg.error_message = f"Twilio Error Code: {error_code}"
        msg.save()
    except Message.DoesNotExist:
        logger.warning(f"Status report for message SID {msg_sid} received but not yet mapped.")

    return HttpResponse("OK")
