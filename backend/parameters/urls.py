from django.urls import include, path
from rest_framework.routers import DefaultRouter
from parameters.views import (
    ParametersViewSet,
    HealthCheckView,
)

router = DefaultRouter()
router.register(r"", ParametersViewSet)

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health-check"),
    path("", include(router.urls)),
]
