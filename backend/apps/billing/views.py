from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from .models import Subscription
from .serializers import SubscriptionSerializer

class SubscriptionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet to view subscription details for Phase 1.
    All stripe modifications and portals are handled in Phase 6.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SubscriptionSerializer

    def get_queryset(self):
        # Strict tenant isolation
        if self.request.user.is_superuser:
            return Subscription.objects.all()
        if self.request.user.business:
            return Subscription.objects.filter(business=self.request.user.business)
        return Subscription.objects.none()

    def get_object(self):
        if self.request.user.is_superuser:
            return super().get_object()
        return getattr(self.request.user.business, 'subscription', None)
