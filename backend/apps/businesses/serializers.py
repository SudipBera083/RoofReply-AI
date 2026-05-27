from rest_framework import serializers
from .models import Business, KnowledgeBase

class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')


class KnowledgeBaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeBase
        fields = '__all__'
        read_only_fields = ('id', 'business', 'created_at')
