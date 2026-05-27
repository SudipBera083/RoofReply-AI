from datetime import datetime, timedelta, time
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Appointment
from .serializers import AppointmentSerializer
from apps.businesses.models import Business

class AppointmentViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        # Strict tenant isolation
        if self.request.user.is_superuser:
            return Appointment.objects.all()
        if self.request.user.business:
            return Appointment.objects.filter(business=self.request.user.business)
        return Appointment.objects.none()

    def perform_create(self, serializer):
        # Automatically set business tenant
        serializer.save(business=self.request.user.business)

    @action(detail=False, methods=['get'], url_path='available-slots')
    def available_slots(self, request):
        """
        Calculates available 1-hour inspection slots for a given date.
        Query params: ?date=YYYY-MM-DD
        """
        date_str = request.query_params.get('date')
        if not date_str:
            return Response({"detail": "date parameter is required (YYYY-MM-DD)."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"detail": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        business = self.request.user.business
        if not business:
            return Response({"detail": "User has no business profiles linked."}, status=status.HTTP_400_BAD_REQUEST)

        # Get business hours for target day
        weekday = target_date.strftime('%A').lower()
        working_hours = business.working_hours or {}
        
        day_config = working_hours.get(weekday, {"open": "08:00", "close": "17:00"})
        open_str = day_config.get('open', '08:00')
        close_str = day_config.get('close', '17:00')

        if open_str == 'closed' or close_str == 'closed':
            return Response([]) # Closed on this day

        try:
            open_hour, open_min = map(int, open_str.split(':'))
            close_hour, close_min = map(int, close_str.split(':'))
        except ValueError:
            # Fallback in case of incorrect JSON structure
            open_hour, open_min = 8, 0
            close_hour, close_min = 17, 0

        # Construct slot range
        tz = timezone.get_current_timezone()
        start_dt = timezone.make_aware(datetime.combine(target_date, time(open_hour, open_min)), tz)
        end_dt = timezone.make_aware(datetime.combine(target_date, time(close_hour, close_min)), tz)

        # Generate 1-hour slots
        slots = []
        current_slot_start = start_dt
        
        # Get all appointments scheduled for this day to perform cache matches
        existing_appointments = Appointment.objects.filter(
            business=business,
            status__in=['PENDING', 'CONFIRMED', 'RESCHEDULED'],
            start_time__date=target_date
        )

        while current_slot_start + timedelta(hours=1) <= end_dt:
            current_slot_end = current_slot_start + timedelta(hours=1)
            
            # Check overlap
            is_booked = any(
                app.start_time < current_slot_end and app.end_time > current_slot_start
                for app in existing_appointments
            )

            if not is_booked:
                slots.append({
                    "start_time": current_slot_start.isoformat(),
                    "end_time": current_slot_end.isoformat(),
                    "label": f"{current_slot_start.strftime('%I:%M %p')} - {current_slot_end.strftime('%I:%M %p')}"
                })

            current_slot_start += timedelta(hours=1)

        return Response(slots)
