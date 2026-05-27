import uuid
from django.db import models
from apps.businesses.models import Business
from apps.leads.models import Lead

class Conversation(models.Model):
    CHANNEL_CHOICES = [
        ('SMS', 'SMS Texting'),
        ('WEB_CHAT', 'Website Chat Widget'),
    ]

    STATUS_CHOICES = [
        ('AI_ACTIVE', 'AI Responding'),
        ('HUMAN_HANDOFF', 'Human Control Requested'),
        ('COMPLETED', 'Conversation Finished'),
    ]

    STATE_CHOICES = [
        ('NEW', 'New Conversation'),
        ('QUALIFYING', 'Qualifying Lead details'),
        ('WAITING_FOR_ADDRESS', 'Awaiting Address details'),
        ('WAITING_FOR_INSPECTION_TIME', 'Awaiting Preferred Inspection Time'),
        ('BOOKING_REQUESTED', 'Inspection Booking Requested'),
        ('HUMAN_HANDOFF', 'Escalated to Human Takeover'),
        ('CLOSED', 'Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='conversations', db_index=True)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='conversations', db_index=True)
    channel = models.CharField(max_length=15, choices=CHANNEL_CHOICES, default='WEB_CHAT')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='AI_ACTIVE')
    state = models.CharField(max_length=30, choices=STATE_CHOICES, default='NEW', db_index=True)
    
    # AI confidence tracking field
    last_ai_confidence = models.FloatField(default=1.0)
    
    ai_summary = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.channel} Conversation ({self.state}) with {self.lead.name or 'Unknown'} ({self.status})"


class Message(models.Model):
    SENDER_CHOICES = [
        ('LEAD', 'Lead/Customer'),
        ('AI', 'AI Assistant'),
        ('HUMAN', 'Human Representative'),
    ]

    DELIVERY_STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('sending', 'Sending'),
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('undelivered', 'Undelivered'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages', db_index=True)
    sender_type = models.CharField(max_length=10, choices=SENDER_CHOICES)
    content = models.TextField()
    provider_message_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    delivery_status = models.CharField(max_length=20, choices=DELIVERY_STATUS_CHOICES, default='queued')
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.sender_type}] Message ({self.delivery_status}) in {self.conversation_id} at {self.created_at}"
