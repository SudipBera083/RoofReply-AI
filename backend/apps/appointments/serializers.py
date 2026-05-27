from rest_framework import serializers
from .models import Appointment
from apps.leads.models import Lead

class AppointmentSerializer(serializers.ModelSerializer):
    lead_name = serializers.CharField(source='lead.name', read_only=True)
    lead_phone = serializers.CharField(source='lead.phone', read_only=True)
    lead_email = serializers.CharField(source='lead.email', read_only=True)

    class Meta:
        model = Appointment
        fields = '__all__'
        read_only_fields = ('id', 'business', 'created_at', 'updated_at')

    def validate(self, attrs):
        start_time = attrs.get('start_time')
        end_time = attrs.get('end_time')
        
        if not start_time or not end_time:
            return attrs
            
        if start_time >= end_time:
            raise serializers.ValidationError("Start time must be before end time.")
            
        # Get business from request context (or from existing instance if updating)
        request = self.context.get('request')
        business = getattr(request.user, 'business', None) if request else None
        
        if not business and self.instance:
            business = self.instance.business
            
        if not business:
            raise serializers.ValidationError("Business context is required.")

        # 1. Double-booking prevention
        queryset = Appointment.objects.filter(
            business=business,
            status__in=['PENDING', 'CONFIRMED', 'RESCHEDULED'],
            start_time__lt=end_time,
            end_time__gt=start_time
        )
        
        if self.instance:
            queryset = queryset.exclude(id=self.instance.id)
            
        if queryset.exists():
            raise serializers.ValidationError("This slot overlaps with an existing booked roof inspection.")
            
        # 2. Business working hours check
        # Convert start_time to the local timezone of the business
        # Let's perform a simple check: extracting hour and day of week
        weekday = start_time.strftime('%A').lower()  # monday, tuesday, etc.
        working_hours = business.working_hours
        
        if working_hours and weekday in working_hours:
            day_config = working_hours[weekday]
            open_str = day_config.get('open', '08:00')
            close_str = day_config.get('close', '17:00')
            
            if open_str == 'closed' or close_str == 'closed':
                raise serializers.ValidationError(f"We are closed on {weekday.capitalize()}. Please schedule for a weekday.")
            
            # Simple HH:MM float compare
            start_hour_min = float(start_time.strftime('%H.%M'))
            
            try:
                open_val = float(open_str.replace(':', '.'))
                close_val = float(close_str.replace(':', '.'))
                if start_hour_min < open_val or start_hour_min > close_val:
                    raise serializers.ValidationError(f"Scheduled time must fall within business hours ({open_str} - {close_str}).")
            except ValueError:
                pass # Fallback if time format is unexpected

        return attrs
