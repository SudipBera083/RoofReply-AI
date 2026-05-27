from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConversationViewSet
from .twilio_views import twilio_sms_webhook, twilio_call_webhook, twilio_status_callback

router = DefaultRouter()
router.register(r'', ConversationViewSet, basename='conversation')

urlpatterns = [
    # Twilio Webhook Endpoints
    path('twilio/sms/', twilio_sms_webhook, name='twilio_sms_webhook'),
    path('twilio/voice/', twilio_call_webhook, name='twilio_call_webhook'),
    path('twilio/status-callback/', twilio_status_callback, name='twilio_status_callback'),
    
    path('', include(router.urls)),
]
