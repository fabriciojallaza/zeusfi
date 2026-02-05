from rest_framework.views import APIView

from rest_framework import viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from parameters.models import Parameters
from parameters.serializers.parameters import (
    ParametersSerializer,
)


class HealthCheckView(APIView):
    """Health check endpoint for ALB."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        """Check readiness by validating database and cache connectivity."""
        from django.db import connection
        from django.db.utils import OperationalError, DatabaseError
        from django.core.cache import cache
        import logging

        # Guarded import: keep compatible when Redis isn't installed/backing cache
        try:
            from redis.exceptions import RedisError, TimeoutError as RedisTimeoutError
        except Exception:  # pragma: no cover
            RedisError: type[BaseException] = Exception
            RedisTimeoutError: type[BaseException] = Exception

        logger = logging.getLogger(__name__)
        checks = {}

        # Check database connectivity
        try:
            connection.ensure_connection()
            checks["database"] = "ok"
        except (OperationalError, DatabaseError):
            checks["database"] = "error"
        except Exception:
            checks["database"] = "unexpected error"

        # Check Redis cache connectivity
        try:
            cache.set("readiness_check", "ok", timeout=5)
            cache_value = cache.get("readiness_check")
            checks["cache"] = "ok" if cache_value == "ok" else "error: value mismatch"
        except (RedisError, RedisTimeoutError):
            checks["cache"] = "error"
        except Exception:
            checks["cache"] = "unexpected error"

        # Determine overall status
        all_ok = all(v == "ok" for v in checks.values())
        status_code = 200 if all_ok else 503

        if not all_ok:
            logger.warning(
                "Readiness check failed: %s",
                ", ".join(f"{k}={v}" for k, v in checks.items() if v != "ok"),
            )

        return Response(
            {"status": "ready" if all_ok else "not_ready", "checks": checks},
            status=status_code,
        )


class ParametersViewSet(viewsets.ModelViewSet):
    queryset = Parameters.objects.all()
    serializer_class = ParametersSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]
