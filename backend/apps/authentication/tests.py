from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from apps.businesses.models import Business

User = get_user_model()

class AuthenticationTests(APITestCase):
    def test_health_check(self):
        """
        Verify the system health status API is healthy
        """
        url = reverse('health_check')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['status'], 'healthy')

    def test_user_registration(self):
        """
        Verify new user registration creates linked Business and User models
        """
        url = reverse('auth_register')
        data = {
            'email': 'roofing_pro@atlanta-roofs.com',
            'password': 'securepassword123',
            'company_name': 'Atlanta Professional Roofing',
            'phone_number': '+14045550199',
            'website': 'https://atlanta-roofs.com',
            'timezone': 'America/New_York'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Assert database updates
        self.assertTrue(User.objects.filter(email='roofing_pro@atlanta-roofs.com').exists())
        user = User.objects.get(email='roofing_pro@atlanta-roofs.com')
        self.assertEqual(user.role, 'OWNER')
        self.assertIsNotNone(user.business)
        self.assertEqual(user.business.company_name, 'Atlanta Professional Roofing')
        self.assertEqual(user.business.phone_number, '+14045550199')
        
        # Assert tokens returned
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])

    def test_jwt_login(self):
        """
        Verify token generation via standard username/password login
        """
        # Create mock business and user
        business = Business.objects.create(
            company_name='Test Roof Co',
            phone_number='+15555555555',
            email='test@roofco.com'
        )
        user = User.objects.create_user(
            email='test@roofco.com',
            password='loginpassword123',
            role='OWNER',
            business=business
        )
        
        url = reverse('token_obtain_pair')
        data = {
            'email': 'test@roofco.com',
            'password': 'loginpassword123'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
