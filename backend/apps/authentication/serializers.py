from rest_framework import serializers
from django.db import transaction
from django.contrib.auth import get_user_model
from apps.businesses.models import Business
from apps.billing.models import Subscription

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='business.company_name', read_only=True)
    business_id = serializers.UUIDField(source='business.id', read_only=True)

    class Meta:
        model = User
        fields = ('id', 'email', 'role', 'business_id', 'company_name', 'is_staff')
        read_only_fields = ('id', 'is_staff')


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    company_name = serializers.CharField(max_length=255)
    phone_number = serializers.CharField(max_length=30, required=False, default='+15555555555')
    website = serializers.URLField(required=False, allow_blank=True, default="")
    timezone = serializers.CharField(max_length=100, required=False, default="America/New_York")

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        email = validated_data['email']
        password = validated_data['password']
        company_name = validated_data['company_name']
        phone_number = validated_data.get('phone_number', '+15555555555')
        website = validated_data.get('website', '')
        timezone = validated_data.get('timezone', 'America/New_York')

        with transaction.atomic():
            # 1. Create Business
            business = Business.objects.create(
                company_name=company_name,
                phone_number=phone_number,
                email=email,
                website=website,
                timezone=timezone,
                working_hours={
                    "monday": {"open": "08:00", "close": "17:00"},
                    "tuesday": {"open": "08:00", "close": "17:00"},
                    "wednesday": {"open": "08:00", "close": "17:00"},
                    "thursday": {"open": "08:00", "close": "17:00"},
                    "friday": {"open": "08:00", "close": "17:00"},
                    "saturday": {"open": "09:00", "close": "12:00"},
                    "sunday": {"open": "closed", "close": "closed"}
                },
                onboarding_completed=False
            )

            # 2. Create User linked to Business with role OWNER
            user = User.objects.create_user(
                email=email,
                password=password,
                role='OWNER',
                business=business
            )

            # 3. Create Subscription in Trialling status for Phase 1
            Subscription.objects.create(
                business=business,
                stripe_customer_id=f"cus_mock_{uuid_suffix()}",
                stripe_subscription_id=f"sub_mock_{uuid_suffix()}",
                status='trialing'
            )

        return user

def uuid_suffix():
    import uuid
    return str(uuid.uuid4())[:8]
