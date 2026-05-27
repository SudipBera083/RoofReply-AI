from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Business, KnowledgeBase
from .serializers import BusinessSerializer, KnowledgeBaseSerializer

class BusinessViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BusinessSerializer

    def get_queryset(self):
        # Users can only query their own business profile
        if self.request.user.is_superuser:
            return Business.objects.all()
        if self.request.user.business:
            return Business.objects.filter(id=self.request.user.business.id)
        return Business.objects.none()

    def get_object(self):
        # Override to ensure users retrieve only their own business
        if self.request.user.is_superuser:
            return super().get_object()
        return self.request.user.business

    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        """
        Retrieves or updates the authenticated user's business profile
        """
        business = self.get_object()
        if not business:
            return Response({"detail": "No business linked to this user profile."}, status=status.HTTP_400_BAD_REQUEST)
        
        if request.method == 'GET':
            serializer = self.get_serializer(business)
            return Response(serializer.data)
        
        serializer = self.get_serializer(business, data=request.data, partial=(request.method == 'PATCH'))
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class KnowledgeBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = KnowledgeBaseSerializer

    def get_queryset(self):
        # Strict tenant isolation
        if self.request.user.is_superuser:
            return KnowledgeBase.objects.all()
        if self.request.user.business:
            return KnowledgeBase.objects.filter(business=self.request.user.business, active=True)
        return KnowledgeBase.objects.none()

    def perform_create(self, serializer):
        # Automatically bind knowledge base record to current tenant business
        serializer.save(business=self.request.user.business)
