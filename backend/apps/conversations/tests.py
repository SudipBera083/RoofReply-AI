from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from django.core.management import call_command
from apps.businesses.models import Business
from apps.leads.models import Lead, LeadActivity
from apps.conversations.models import Conversation, Message
from apps.conversations.tasks import generate_ai_reply_task, schedule_follow_up_campaign_task
from apps.appointments.models import Appointment
from unittest.mock import patch
from datetime import datetime, timedelta
from django.utils import timezone

User = get_user_model()

class TwilioWebhookTests(APITestCase):
    def setUp(self):
        self.business = Business.objects.create(
            company_name="Atlanta Roofers Elite",
            phone_number="+15555555555",
            email="elite@atlanta.com"
        )
        self.owner = User.objects.create_user(
            email="owner@atlanta.com",
            password="securepassword123",
            role="OWNER",
            business=self.business
        )

    @patch('apps.conversations.twilio_views.validate_twilio_signature', return_value=True)
    def test_twilio_missed_call_flow(self, mock_signature):
        url = reverse('twilio_call_webhook')
        data = {
            'CallSid': 'CA_test_call_sid_123',
            'From': '+14045550299',
            'To': '+15555555555',
            'CallStatus': 'no-answer'
        }
        
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('<Response></Response>', response.content.decode())

        self.assertTrue(Lead.objects.filter(phone='+14045550299', business=self.business).exists())
        lead = Lead.objects.get(phone='+14045550299')
        self.assertEqual(lead.source, 'MISSED_CALL')
        self.assertEqual(lead.status, 'NEW')

        self.assertTrue(Conversation.objects.filter(lead=lead, channel='SMS').exists())
        conversation = Conversation.objects.get(lead=lead)
        self.assertEqual(conversation.status, 'AI_ACTIVE')

        self.assertTrue(LeadActivity.objects.filter(lead=lead, activity_type='missed_call').exists())
        self.assertTrue(LeadActivity.objects.filter(lead=lead, activity_type='sms_sent').exists())

        # Check Greeting Message stored in DB (first message created)
        self.assertTrue(Message.objects.filter(conversation=conversation, sender_type='AI').exists())
        greeting = Message.objects.filter(conversation=conversation, sender_type='AI').first()
        self.assertIn("Sorry we missed your call", greeting.content)

    @patch('apps.conversations.twilio_views.validate_twilio_signature', return_value=True)
    def test_twilio_incoming_sms_flow(self, mock_signature):
        lead = Lead.objects.create(
            business=self.business,
            name="John Tester",
            phone="+14045550300",
            source="WEBSITE"
        )
        conversation = Conversation.objects.create(
            business=self.business,
            lead=lead,
            channel="SMS",
            status="AI_ACTIVE",
            state="NEW"
        )

        url = reverse('twilio_sms_webhook')
        data = {
            'MessageSid': 'SM_test_message_sid_123',
            'From': '+14045550300',
            'To': '+15555555555',
            'Body': 'I need a roof estimate'
        }

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertTrue(Message.objects.filter(provider_message_id='SM_test_message_sid_123').exists())
        inbound_msg = Message.objects.get(provider_message_id='SM_test_message_sid_123')
        self.assertEqual(inbound_msg.content, 'I need a roof estimate')
        self.assertEqual(inbound_msg.sender_type, 'LEAD')

    @patch('apps.conversations.twilio_views.validate_twilio_signature', return_value=True)
    def test_twilio_webhook_idempotency(self, mock_signature):
        url = reverse('twilio_sms_webhook')
        data = {
            'MessageSid': 'SM_duplicate_check_sid',
            'From': '+14045550400',
            'To': '+15555555555',
            'Body': 'Hello, test'
        }

        response1 = self.client.post(url, data)
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        response2 = self.client.post(url, data)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)

        messages_count = Message.objects.filter(provider_message_id='SM_duplicate_check_sid').count()
        self.assertEqual(messages_count, 1)

    def test_twilio_status_callback(self):
        lead = Lead.objects.create(
            business=self.business,
            phone="+14045550500"
        )
        conversation = Conversation.objects.create(
            business=self.business,
            lead=lead,
            channel="SMS"
        )
        msg = Message.objects.create(
            conversation=conversation,
            sender_type="AI",
            content="Alert",
            provider_message_id="SM_callback_sid_999",
            delivery_status="queued"
        )

        url = reverse('twilio_status_callback')
        data = {
            'MessageSid': 'SM_callback_sid_999',
            'MessageStatus': 'delivered',
            'ErrorCode': '30006'
        }

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        msg.refresh_from_db()
        self.assertEqual(msg.delivery_status, 'delivered')
        self.assertEqual(msg.error_message, 'Twilio Error Code: 30006')


class AIQualificationTests(APITestCase):
    def setUp(self):
        self.business = Business.objects.create(
            company_name="Atlanta Elite Roofing",
            phone_number="+15555551111",
            email="elite@atlanta.com"
        )
        self.lead = Lead.objects.create(
            business=self.business,
            name="Website Guest",
            phone="+14045550600",
            source="WEBSITE",
            status="NEW"
        )
        self.conversation = Conversation.objects.create(
            business=self.business,
            lead=self.lead,
            channel="SMS",
            status="AI_ACTIVE",
            state="NEW"
        )

    def test_ai_qualification_parsing_and_urgency(self):
        Message.objects.create(
            conversation=self.conversation,
            sender_type="LEAD",
            content="My name is Bob. I have an active leak in my ceiling. My address is 123 Pine St."
        )

        success = generate_ai_reply_task(str(self.conversation.id))
        self.assertTrue(success)

        self.lead.refresh_from_db()
        self.conversation.refresh_from_db()

        self.assertEqual(self.lead.name, "Bob")
        self.assertEqual(self.lead.address, "123 Pine St")
        self.assertEqual(self.lead.urgency, "IMMEDIATE_LEAK")
        self.assertEqual(self.lead.priority_score, 95)
        self.assertEqual(self.conversation.state, "WAITING_FOR_INSPECTION_TIME")

    def test_ai_escalation_detection(self):
        Message.objects.create(
            conversation=self.conversation,
            sender_type="LEAD",
            content="This is a scam. I want to cancel and sue you guys!"
        )

        generate_ai_reply_task(str(self.conversation.id))
        self.conversation.refresh_from_db()

        self.assertEqual(self.conversation.status, "HUMAN_HANDOFF")
        self.assertEqual(self.conversation.state, "HUMAN_HANDOFF")

    def test_campaign_follow_up_cancellation(self):
        self.assertTrue(schedule_follow_up_campaign_task(str(self.conversation.id), 1))
        
        tz = timezone.get_current_timezone()
        app = Appointment.objects.create(
            business=self.business,
            lead=self.lead,
            start_time=timezone.make_aware(datetime.now(), tz) + timedelta(days=2),
            end_time=timezone.make_aware(datetime.now(), tz) + timedelta(days=2, hours=1),
            status="CONFIRMED"
        )
        self.assertFalse(schedule_follow_up_campaign_task(str(self.conversation.id), 2))

        app.delete()
        self.conversation.status = 'HUMAN_HANDOFF'
        self.conversation.save()
        self.assertFalse(schedule_follow_up_campaign_task(str(self.conversation.id), 3))


class ObservabilityAndDemoTests(APITestCase):
    def setUp(self):
        call_command('seed_demo_data')
        self.business = Business.objects.get(company_name="StormShield Roofing")
        self.owner = User.objects.get(email="demo@stormshieldroofing.com")
        self.lead = Lead.objects.filter(business=self.business).first()
        self.conversation = Conversation.objects.filter(business=self.business).first()

    def test_seed_demo_data_command_populated(self):
        self.assertEqual(Business.objects.filter(company_name="StormShield Roofing").count(), 1)
        self.assertTrue(User.objects.filter(email="demo@stormshieldroofing.com").exists())
        self.assertTrue(Lead.objects.filter(business=self.business).count() >= 5)
        self.assertTrue(Conversation.objects.filter(business=self.business).count() >= 5)
        self.assertTrue(Appointment.objects.filter(business=self.business).count() >= 1)

    def test_observability_endpoints(self):
        self.client.force_authenticate(user=self.owner)
        
        audit_url = reverse('conversation-audit', kwargs={'pk': self.conversation.id})
        response = self.client.get(audit_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('current_state', response.data)
        self.assertIn('last_ai_confidence', response.data)
        self.assertIn('extracted_details', response.data)

        replay_url = reverse('conversation-replay', kwargs={'pk': self.conversation.id})
        response = self.client.get(replay_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('transcript', response.data)
        self.assertTrue(isinstance(response.data['transcript'], list))

    def test_lead_activity_timeline(self):
        self.client.force_authenticate(user=self.owner)
        
        timeline_url = reverse('lead-timeline', kwargs={'pk': self.lead.id})
        response = self.client.get(timeline_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(isinstance(response.data, list))

    def test_failed_tasks_endpoint(self):
        Message.objects.create(
            conversation=self.conversation,
            sender_type="AI",
            content="Failed test dispatch",
            delivery_status="failed",
            error_message="Twilio Error 30007"
        )
        
        self.client.force_authenticate(user=self.owner)
        url = reverse('conversation-failed-tasks')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) >= 1)
        self.assertEqual(response.data[0]['error_message'], "Twilio Error 30007")
