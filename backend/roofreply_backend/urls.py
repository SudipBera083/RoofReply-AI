from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

def health_check(request):
    return JsonResponse({
        "status": "healthy",
        "service": "roofreply-api",
        "database": "connected" # basic confirmation view
    })

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health_check, name='health_check'),
    
    # API endpoints
    path('api/auth/', include('apps.authentication.urls')),
    path('api/businesses/', include('apps.businesses.urls')),
    path('api/leads/', include('apps.leads.urls')),
    path('api/conversations/', include('apps.conversations.urls')),
    path('api/appointments/', include('apps.appointments.urls')),
    path('api/billing/', include('apps.billing.urls')),
    
    # OpenAPI Schema & Swagger Docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]
