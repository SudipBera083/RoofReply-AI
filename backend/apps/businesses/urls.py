from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BusinessViewSet, KnowledgeBaseViewSet

router = DefaultRouter()
router.register(r'profile', BusinessViewSet, basename='business')
router.register(r'knowledge-base', KnowledgeBaseViewSet, basename='knowledgebase')

urlpatterns = [
    path('', include(router.urls)),
]
