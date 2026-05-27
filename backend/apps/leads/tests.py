from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from apps.businesses.models import Business
from apps.leads.models import Lead

User = get_user_model()

class LeadTenantIsolationTests(APITestCase):
    def setUp(self):
        # 1. Setup Tenant A
        self.business_a = Business.objects.create(
            company_name="Business A Roofing",
            phone_number="+15555550111",
            email="owner@businessa.com"
        )
        self.user_a = User.objects.create_user(
            email="owner@businessa.com",
            password="passwordA123",
            role="OWNER",
            business=self.business_a
        )
        
        # 2. Setup Tenant B
        self.business_b = Business.objects.create(
            company_name="Business B Roofing",
            phone_number="+15555550222",
            email="owner@businessb.com"
        )
        self.user_b = User.objects.create_user(
            email="owner@businessb.com",
            password="passwordB123",
            role="OWNER",
            business=self.business_b
        )
        
        # 3. Create leads for Business A
        self.lead_a = Lead.objects.create(
            business=self.business_a,
            name="John Doe",
            phone="+14045550101",
            email="john@gmail.com",
            roof_issue="Tree limb fell on roof, leaking",
            urgency="IMMEDIATE_LEAK",
            source="WEBSITE",
            status="NEW"
        )
        
        # 4. Create leads for Business B
        self.lead_b = Lead.objects.create(
            business=self.business_b,
            name="Jane Smith",
            phone="+14045550202",
            email="jane@gmail.com",
            roof_issue="Needs simple asphalt shingle repair",
            urgency="STANDARD_ESTIMATE",
            source="WEBSITE",
            status="NEW"
        )

    def test_tenant_a_can_view_own_leads(self):
        """
        Verify Tenant A can list their own leads
        """
        self.client.force_authenticate(user=self.user_a)
        url = reverse('lead-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return exactly 1 lead (John Doe)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['name'], 'John Doe')

    def test_tenant_a_cannot_view_tenant_b_leads(self):
        """
        Verify Tenant A cannot access Tenant B's lead details
        """
        self.client.force_authenticate(user=self.user_a)
        url = reverse('lead-detail', kwargs={'pk': self.lead_b.id})
        response = self.client.get(url)
        
        # Should return 404 because Lead B queryset is filtered out of Tenant A's view
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_tenant_b_cannot_update_tenant_a_leads(self):
        """
        Verify Tenant B cannot update Tenant A's lead data
        """
        self.client.force_authenticate(user=self.user_b)
        url = reverse('lead-detail', kwargs={'pk': self.lead_a.id})
        
        data = {'name': 'Hacker Override'}
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        # Verify lead A was not modified
        self.lead_a.refresh_from_db()
        self.assertEqual(self.lead_a.name, 'John Doe')
