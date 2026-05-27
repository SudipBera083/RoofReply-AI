import uuid
from django.db import models
from apps.businesses.models import Business

class Lead(models.Model):
    URGENCY_CHOICES = [
        ('IMMEDIATE_LEAK', 'Immediate Active Leak'),
        ('ACTIVE_DAMAGE', 'Active Storm Damage'),
        ('STANDARD_ESTIMATE', 'Standard Replacement/Repair Estimate'),
        ('PLANNING', 'General Planning / Inquiry'),
    ]

    STATUS_CHOICES = [
        ('NEW', 'New Lead'),
        ('QUALIFYING', 'Qualifying In-Progress'),
        ('QUALIFIED', 'Qualified'),
        ('BOOKED', 'Booked Inspection'),
        ('UNQUALIFIED', 'Unqualified'),
        ('ARCHIVED', 'Archived'),
    ]

    SOURCE_CHOICES = [
        ('GOOGLE_ADS', 'Google Ads'),
        ('FACEBOOK', 'Facebook Ads'),
        ('WEBSITE', 'Website Widget'),
        ('MISSED_CALL', 'Missed Call SMS Auto-Text'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='leads', db_index=True)
    name = models.CharField(max_length=255, blank=True, default='')
    phone = models.CharField(max_length=30, db_index=True)
    email = models.EmailField(blank=True, default='')
    address = models.CharField(max_length=500, blank=True, default='')
    roof_issue = models.TextField(blank=True, default='')
    urgency = models.CharField(max_length=20, choices=URGENCY_CHOICES, default='STANDARD_ESTIMATE')
    priority_score = models.IntegerField(default=50)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='WEBSITE')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='NEW')
    preferred_inspection_time = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name or 'Unknown'} ({self.phone}) - {self.status}"


class LeadActivity(models.Model):
    ACTIVITY_CHOICES = [
        ('missed_call', 'Missed Call Received'),
        ('sms_sent', 'SMS Message Sent'),
        ('sms_received', 'SMS Message Received'),
        ('ai_response', 'AI Autoreply Generated'),
        ('appointment_requested', 'Appointment Slot Requested'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='activities', db_index=True)
    activity_type = models.CharField(max_length=30, choices=ACTIVITY_CHOICES)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = "Lead Activities"

    def __str__(self):
        return f"{self.lead.name or self.lead.phone} - {self.activity_type} at {self.created_at}"
