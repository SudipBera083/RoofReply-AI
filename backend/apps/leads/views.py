import csv
from django.http import HttpResponse
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Lead, LeadActivity
from .serializers import LeadSerializer, LeadActivitySerializer

class LeadViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LeadSerializer

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Lead.objects.all()
        if self.request.user.business:
            return Lead.objects.filter(business=self.request.user.business)
        return Lead.objects.none()

    def perform_create(self, serializer):
        serializer.save(business=self.request.user.business)

    @action(detail=True, methods=['get'], url_path='timeline')
    def timeline(self, request, pk=None):
        """
        Fetches the complete history of activities for a given lead.
        Enforces tenant isolation by using the filtered get_object().
        """
        lead = self.get_object()
        activities = lead.activities.all()
        serializer = LeadActivitySerializer(activities, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        leads = self.get_queryset()
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="roofreply_leads.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Name', 'Phone', 'Email', 'Address', 
            'Roof Issue', 'Urgency', 'Priority Score', 
            'Source', 'Status', 'Preferred Time', 'Created At'
        ])
        
        for lead in leads:
            writer.writerow([
                str(lead.id),
                lead.name,
                lead.phone,
                lead.email,
                lead.address,
                lead.roof_issue,
                lead.get_urgency_display(),
                lead.priority_score,
                lead.get_source_display(),
                lead.get_status_display(),
                lead.preferred_inspection_time,
                lead.created_at.strftime('%Y-%m-%d %H:%M:%S')
            ])
            
        return response
