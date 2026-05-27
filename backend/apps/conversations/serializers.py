from rest_framework import serializers
from .models import Conversation, Message
from apps.leads.serializers import LeadSerializer

class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = '__all__'
        read_only_fields = ('id', 'created_at')


class ConversationSerializer(serializers.ModelSerializer):
    lead_name = serializers.CharField(source='lead.name', read_only=True)
    lead_phone = serializers.CharField(source='lead.phone', read_only=True)
    lead_email = serializers.CharField(source='lead.email', read_only=True)
    lead_status = serializers.CharField(source='lead.status', read_only=True)
    lead_urgency = serializers.CharField(source='lead.urgency', read_only=True)
    lead_priority_score = serializers.IntegerField(source='lead.priority_score', read_only=True)
    lead_address = serializers.CharField(source='lead.address', read_only=True)
    lead_roof_issue = serializers.CharField(source='lead.roof_issue', read_only=True)
    lead_preferred_inspection_time = serializers.CharField(source='lead.preferred_inspection_time', read_only=True)
    
    class Meta:
        model = Conversation
        fields = '__all__'
        read_only_fields = ('id', 'business', 'lead', 'created_at', 'updated_at')
