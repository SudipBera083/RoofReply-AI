from django.contrib import admin
from .models import Subscription

@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('business', 'stripe_customer_id', 'stripe_subscription_id', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('stripe_customer_id', 'stripe_subscription_id', 'business__company_name')
    ordering = ('-created_at',)
