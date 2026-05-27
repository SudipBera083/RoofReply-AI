from django.contrib import admin
from .models import Appointment

@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ('lead', 'start_time', 'end_time', 'status', 'created_at')
    list_filter = ('status', 'business')
    search_fields = ('lead__name', 'notes')
    ordering = ('start_time',)
