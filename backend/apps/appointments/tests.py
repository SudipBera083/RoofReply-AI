from datetime import datetime, timedelta
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.businesses.models import Business
from apps.leads.models import Lead
from apps.appointments.models import Appointment

User = get_user_model()

class AppointmentSchedulingTests(APITestCase):
    def setUp(self):
        # 1. Setup Business with working hours
        self.business = Business.objects.create(
            company_name="Atlanta Elite Roofing",
            phone_number="+15555550100",
            email="office@elite.com",
            working_hours={
                "monday": {"open": "08:00", "close": "17:00"},
                "tuesday": {"open": "08:00", "close": "17:00"},
                "wednesday": {"open": "08:00", "close": "17:00"},
                "thursday": {"open": "08:00", "close": "17:00"},
                "friday": {"open": "08:00", "close": "17:00"},
                "saturday": {"open": "closed", "close": "closed"},
                "sunday": {"open": "closed", "close": "closed"}
            }
        )
        self.user = User.objects.create_user(
            email="office@elite.com",
            password="password123",
            role="OWNER",
            business=self.business
        )
        
        # 2. Setup Lead
        self.lead = Lead.objects.create(
            business=self.business,
            name="Alice Cooper",
            phone="+14045550199"
        )
        
        # 3. Choose a Wednesday during working hours
        tz = timezone.get_current_timezone()
        self.start_time = timezone.make_aware(datetime(2026, 6, 3, 10, 0), tz) # Wednesday 10:00 AM
        self.end_time = self.start_time + timedelta(hours=1)
        
        # 4. Create an existing appointment
        self.existing_appointment = Appointment.objects.create(
            business=self.business,
            lead=self.lead,
            start_time=self.start_time,
            end_time=self.end_time,
            status="CONFIRMED"
        )

    def test_prevent_double_booking(self):
        """
        Verify that booking an overlapping appointment in the same slot returns a validation error
        """
        self.client.force_authenticate(user=self.user)
        url = reverse('appointment-list')
        
        # Try to schedule another inspection at the exact same hour
        data = {
            'lead': str(self.lead.id),
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat(),
            'status': 'PENDING'
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('non_field_errors', response.data)
        self.assertTrue(any("overlaps" in err for err in response.data['non_field_errors']))

    def test_enforce_working_hours(self):
        """
        Verify that scheduling an inspection on a day when the business is closed (e.g. Saturday) is rejected
        """
        self.client.force_authenticate(user=self.user)
        url = reverse('appointment-list')
        
        # Saturday afternoon
        tz = timezone.get_current_timezone()
        saturday_start = timezone.make_aware(datetime(2026, 6, 6, 14, 0), tz)
        saturday_end = saturday_start + timedelta(hours=1)
        
        data = {
            'lead': str(self.lead.id),
            'start_time': saturday_start.isoformat(),
            'end_time': saturday_end.isoformat(),
            'status': 'PENDING'
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(any("closed" in err for err in response.data['non_field_errors']))
