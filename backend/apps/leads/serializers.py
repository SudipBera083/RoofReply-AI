from rest_framework import serializers
from .models import Lead, LeadActivity

class LeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = '__all__'
        read_only_fields = ('id', 'business', 'created_at', 'updated_at')


class LeadActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadActivity
        fields = '__all__'
        read_only_fields = ('id', 'created_at')
