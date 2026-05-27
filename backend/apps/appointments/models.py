import uuid
from django.db import models
from apps.businesses.models import Business
from apps.leads.models import Lead

class Appointment(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending Confirmation'),
        ('CONFIRMED', 'Confirmed Estimate inspection'),
        ('RESCHEDULED', 'Rescheduled'),
        ('CANCELLED', 'Cancelled'),
        ('COMPLETED', 'Completed inspection'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='appointments', db_index=True)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='appointments', db_index=True)
    start_time = models.DateTimeField(db_index=True)
    end_time = models.DateTimeField(db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_time']

    def __str__(self):
        return f"Roofing Inspection for {self.lead.name or 'Unknown'} on {self.start_time.strftime('%Y-%m-%d %H:%M')}"
