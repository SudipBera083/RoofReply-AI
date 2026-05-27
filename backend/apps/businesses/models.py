import uuid
from django.db import models

class Business(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=30, blank=True, default='+15555555555') # Twilio SMS number for automation
    email = models.EmailField()
    website = models.URLField(blank=True, default='')
    timezone = models.CharField(max_length=100, default='America/New_York')
    working_hours = models.JSONField(default=dict) # e.g. {"monday": {"open": "08:00", "close": "17:00"}}
    onboarding_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.company_name


class KnowledgeBase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='knowledge_base')
    question = models.TextField()
    answer = models.TextField()
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.business.company_name} - Q: {self.question[:50]}"
