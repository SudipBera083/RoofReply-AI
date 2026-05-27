import uuid
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import datetime, timedelta
from apps.businesses.models import Business, KnowledgeBase
from apps.authentication.models import User
from apps.leads.models import Lead, LeadActivity
from apps.conversations.models import Conversation, Message
from apps.appointments.models import Appointment
from apps.billing.models import Subscription

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds realistic roofing demo data for StormShield Roofing company.'

    def handle(self, *args, **options):
        self.stdout.write("Starting database seeding...")

        # 1. Clean existing records associated with StormShield Roofing to ensure idempotency
        company_name = "StormShield Roofing"
        Business.objects.filter(company_name=company_name).delete()

        # 2. Create Business (Tenant)
        business = Business.objects.create(
            company_name=company_name,
            phone_number="+15555555555",
            email="demo@stormshieldroofing.com",
            website="https://stormshieldroofing.com",
            timezone="America/New_York",
            working_hours={
                "monday": {"open": "08:00", "close": "17:00"},
                "tuesday": {"open": "08:00", "close": "17:00"},
                "wednesday": {"open": "08:00", "close": "17:00"},
                "thursday": {"open": "08:00", "close": "17:00"},
                "friday": {"open": "08:00", "close": "17:00"},
                "saturday": {"open": "09:00", "close": "12:00"},
                "sunday": {"open": "closed", "close": "closed"}
            },
            onboarding_completed=True
        )

        # 3. Create Subscription (Starter Plan)
        Subscription.objects.create(
            business=business,
            stripe_customer_id="cus_demo_stormshield_999",
            stripe_subscription_id="sub_demo_stormshield_999",
            status="active"
        )

        # 4. Create Owner User
        owner = User.objects.create_user(
            email="demo@stormshieldroofing.com",
            password="password123",
            role="OWNER",
            business=business
        )
        self.stdout.write(self.style.SUCCESS(f"Created demo owner account: demo@stormshieldroofing.com / password123"))

        # 5. Seed Knowledge Base FAQs
        kb_data = [
            ("What roofing services do you offer?", "We specialize in residential and commercial roofing. Our services include complete roof replacements (asphalt shingles, metal roofs, slate), leak repairs, storm damage inspections, tarping, and gutter installations."),
            ("What warranties do you provide?", "We offer a 10-year workmanship warranty on all complete roof replacements, plus the standard lifetime manufacturer warranty on GAF and Owens Corning architectural shingles."),
            ("Do you assist with insurance claims?", "Yes! We specialize in insurance claim negotiations. We will do a free storm damage digital inspection, prepare the estimate report, and coordinate directly with your insurance adjuster."),
            ("What is your service area?", "StormShield Roofing serves the greater metro area, including suburban counties within a 45-mile radius of Atlanta."),
        ]
        
        for question, answer in kb_data:
            KnowledgeBase.objects.create(
                business=business,
                question=question,
                answer=answer,
                active=True
            )
        self.stdout.write("Seeded Knowledge Base FAQs.")

        # ==========================================
        # SCENARIO 1: EMERGENCY LEAK (New Lead, Missed Call Flow)
        # ==========================================
        lead_emergency = Lead.objects.create(
            business=business,
            name="Alice Jenkins",
            phone="+14045550110",
            email="alice.j@outlook.com",
            roof_issue="Active water leaking in living room ceiling after storm.",
            urgency="IMMEDIATE_LEAK",
            priority_score=98,
            source="MISSED_CALL",
            status="NEW"
        )
        LeadActivity.objects.create(
            lead=lead_emergency,
            activity_type="missed_call",
            metadata={"call_sid": "CA_demo_emergency_1"}
        )
        conv_emergency = Conversation.objects.create(
            business=business,
            lead=lead_emergency,
            channel="SMS",
            status="AI_ACTIVE",
            state="WAITING_FOR_ADDRESS",
            last_ai_confidence=0.95
        )
        # Transcript
        Message.objects.create(conversation=conv_emergency, sender_type="AI", content="Hey! Sorry we missed your call. We're currently on a roof helping another customer. What can we help you with today? Leak, storm damage, or estimate?")
        Message.objects.create(conversation=conv_emergency, sender_type="LEAD", content="Yes, I have an active leak in my living room ceiling from the storm last night. Water is dripping onto my couch.")
        Message.objects.create(conversation=conv_emergency, sender_type="AI", content="Oh no, I'm sorry to hear that. Active leaks are a priority. What is the physical address of the property so we can arrange an emergency inspection?")
        
        LeadActivity.objects.create(lead=lead_emergency, activity_type="sms_received", metadata={"body": "Yes, I have an active leak..."})
        LeadActivity.objects.create(lead=lead_emergency, activity_type="ai_response", metadata={"content": "Oh no, I'm sorry to hear..."})

        # ==========================================
        # SCENARIO 2: STORM DAMAGE (Qualifying, Website Widget Flow)
        # ==========================================
        lead_storm = Lead.objects.create(
            business=business,
            name="Marcus Vance",
            phone="+14045550220",
            email="marcus.vance@gmail.com",
            address="456 Oak Ridge Lane, Atlanta GA",
            roof_issue="Hail damage and shingles blown off the roof slope.",
            urgency="ACTIVE_STORM_DAMAGE",
            priority_score=88,
            source="WEBSITE",
            status="QUALIFYING"
        )
        conv_storm = Conversation.objects.create(
            business=business,
            lead=lead_storm,
            channel="WEB_CHAT",
            status="AI_ACTIVE",
            state="WAITING_FOR_INSPECTION_TIME",
            last_ai_confidence=0.98
        )
        Message.objects.create(conversation=conv_storm, sender_type="AI", content="Hi! Thanks for visiting StormShield Roofing. How can we help you with your roofing needs today? (Roof repair, leak inspection, or full replacement?)")
        Message.objects.create(conversation=conv_storm, sender_type="LEAD", content="We had major hail last week and my neighbor said some shingles blew off my roof. I want someone to look at it.")
        Message.objects.create(conversation=conv_storm, sender_type="AI", content="Got it, hail damage can cause leaks down the line. What is the address of the property?")
        Message.objects.create(conversation=conv_storm, sender_type="LEAD", content="It is 456 Oak Ridge Lane, Atlanta GA.")
        Message.objects.create(conversation=conv_storm, sender_type="AI", content="Perfect, thank you! When is the best time for our estimator to come do a free roof inspection? (Mornings or afternoons work best?)")

        LeadActivity.objects.create(lead=lead_storm, activity_type="sms_received", metadata={"body": "It is 456 Oak Ridge Lane..."})
        LeadActivity.objects.create(lead=lead_storm, activity_type="ai_response", metadata={"content": "Perfect, thank you! When is..."})

        # ==========================================
        # SCENARIO 3: BOOKED INSPECTION (Google Ads, Appointment Scheduled)
        # ==========================================
        lead_booked = Lead.objects.create(
            business=business,
            name="Sarah Connor",
            phone="+14045550330",
            email="sconnor@cyberdyne.com",
            address="789 Resistance Way, Marietta GA",
            roof_issue="Aged shingle roof replacement estimate.",
            urgency="STANDARD_ESTIMATE",
            priority_score=65,
            source="GOOGLE_ADS",
            status="BOOKED",
            preferred_inspection_time="Next Wednesday 10 AM"
        )
        conv_booked = Conversation.objects.create(
            business=business,
            lead=lead_booked,
            channel="SMS",
            status="AI_ACTIVE",
            state="BOOKING_REQUESTED",
            last_ai_confidence=0.96
        )
        Message.objects.create(conversation=conv_booked, sender_type="AI", content="Hey! Sorry we missed your call. We're currently on a roof helping another customer. What can we help you today? Leak, storm damage, or estimate?")
        Message.objects.create(conversation=conv_booked, sender_type="LEAD", content="Hi, my shingles are 20 years old and showing curling. I want a quote to replace the whole roof.")
        Message.objects.create(conversation=conv_booked, sender_type="AI", content="We'd love to help you with that. Replacing an aged roof protects your home. What is your address?")
        Message.objects.create(conversation=conv_booked, sender_type="LEAD", content="It's 789 Resistance Way, Marietta GA.")
        Message.objects.create(conversation=conv_booked, sender_type="AI", content="Perfect. What time works best for an inspector? (Mornings or afternoons?)")
        Message.objects.create(conversation=conv_booked, sender_type="LEAD", content="Next Wednesday morning around 10 AM is great.")
        Message.objects.create(conversation=conv_booked, sender_type="AI", content="Excellent. I have logged your request for next Wednesday morning at 10 AM. We will call you shortly to confirm.")

        # Create scheduled Appointment
        tz = timezone.get_current_timezone()
        # Find next Wednesday at 10 AM
        now = datetime.now()
        days_ahead = 2 - now.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        next_wed = now + timedelta(days=days_ahead)
        start_time = timezone.make_aware(datetime(next_wed.year, next_wed.month, next_wed.day, 10, 0), tz)
        end_time = start_time + timedelta(hours=1)

        Appointment.objects.create(
            business=business,
            lead=lead_booked,
            start_time=start_time,
            end_time=end_time,
            status="CONFIRMED",
            notes="GAF Timberline HDZ shingle replacement consultation. Customer wants metal roofing quote comparisons too."
        )
        
        LeadActivity.objects.create(lead=lead_booked, activity_type="appointment_requested", metadata={"time": "Next Wednesday 10 AM"})

        # ==========================================
        # SCENARIO 4: HUMAN TAKEOVER (Dispute/Lawsuit Escalation case)
        # ==========================================
        lead_takeover = Lead.objects.create(
            business=business,
            name="Robert Patrick",
            phone="+14045550440",
            email="t1000@cyberdyne.com",
            roof_issue="Contract billing query, dispute about warranty repair schedule.",
            urgency="STANDARD_ESTIMATE",
            priority_score=40,
            source="WEBSITE",
            status="UNQUALIFIED"
        )
        conv_takeover = Conversation.objects.create(
            business=business,
            lead=lead_takeover,
            channel="SMS",
            status="HUMAN_HANDOFF",
            state="HUMAN_HANDOFF",
            last_ai_confidence=0.45
        )
        Message.objects.create(conversation=conv_takeover, sender_type="AI", content="Hi, how can we help you today?")
        Message.objects.create(conversation=conv_takeover, sender_type="LEAD", content="Your inspector promised a repair yesterday and nobody showed up. If this is not resolved I will contact my lawyer and sue for contract breach.")
        Message.objects.create(conversation=conv_takeover, sender_type="AI", content="I'm sorry for any confusion. I am pulling one of our office estimators into this chat right now to help you directly.")

        LeadActivity.objects.create(lead=lead_takeover, activity_type="sms_received", metadata={"body": "Your inspector promised..."})
        LeadActivity.objects.create(lead=lead_takeover, activity_type="ai_response", metadata={"content": "I am pausing our automated..."})

        # ==========================================
        # SCENARIO 5: CAMPAIGN FOLLOW-UP (Stage 1 Follow-up Sent)
        # ==========================================
        lead_followup = Lead.objects.create(
            business=business,
            name="John Connor",
            phone="+14045550550",
            email="jconnor@resistance.net",
            roof_issue="Wind damage inspection request.",
            urgency="PLANNING",
            priority_score=50,
            source="FACEBOOK",
            status="QUALIFYING"
        )
        conv_followup = Conversation.objects.create(
            business=business,
            lead=lead_followup,
            channel="SMS",
            status="AI_ACTIVE",
            state="QUALIFYING",
            last_ai_confidence=0.92
        )
        Message.objects.create(conversation=conv_followup, sender_type="AI", content="Hey! Sorry we missed your call. What can we help you today?")
        Message.objects.create(conversation=conv_followup, sender_type="LEAD", content="I think the high winds last night blew some shingles off, can someone check it?")
        # Follow-up sent 2 hours later
        followup_content = "Hey John, just checking if you still need a roofing inspection for your wind damage?"
        Message.objects.create(conversation=conv_followup, sender_type="AI", content=followup_content)

        LeadActivity.objects.create(
            lead=lead_followup,
            activity_type="sms_sent",
            metadata={"message_id": "MSG_follow_up_demo", "follow_up_stage": 1, "type": "campaign"}
        )

        self.stdout.write(self.style.SUCCESS("Database seeding complete! Seeded company 'StormShield Roofing' with 5 core scenarios."))
