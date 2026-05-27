from django.contrib import admin
from .models import Lead

@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'email', 'urgency', 'priority_score', 'status', 'source', 'created_at')
    list_filter = ('urgency', 'status', 'source', 'business')
    search_fields = ('name', 'phone', 'email', 'address')
    ordering = ('-created_at',)
