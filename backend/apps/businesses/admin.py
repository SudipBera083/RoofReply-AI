from django.contrib import admin
from .models import Business, KnowledgeBase

@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'phone_number', 'email', 'timezone', 'onboarding_completed')
    search_fields = ('company_name', 'email')

@admin.register(KnowledgeBase)
class KnowledgeBaseAdmin(admin.ModelAdmin):
    list_display = ('business', 'question', 'active')
    list_filter = ('active', 'business')
    search_fields = ('question', 'answer')
