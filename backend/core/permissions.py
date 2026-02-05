from rest_framework.exceptions import PermissionDenied, Throttled
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import exception_handler

from members.models import Member


ADMIN = 1
MEMBER = 2


class SuperuserFilterMixin:
    """
    Custom mixin to filter queryset based on user type (superuser or non-superuser).
    """

    def get_queryset(self):
        queryset = super().get_queryset()

        # Override queryset to filter for non-superusers
        if (
            not self.request.user.is_authenticated
            or not self.request.user.platform_role.identifier == ADMIN
        ):
            queryset = queryset.filter(is_active=True)

        return queryset


class IsMemberOrAdmin(BasePermission):
    message = "Not Allowed"
    """
    Custom permission to only allow talents or admins to access the view.
    """
    allowed_read_write_roles = [ADMIN, MEMBER]

    def has_permission(self, request, view):
        """Works in every HTTP method"""
        role = request.user.platform_role.identifier
        if role not in self.allowed_read_roles:
            return False
        elif role == ADMIN:
            return True

        member_id = view.kwargs.get("member_id")
        if member_id is not None:
            return Member.objects.filter(user=request.user, id=member_id).exists()
        else:
            return True

    def has_object_permission(self, request, view, obj):
        """Only works in GET, PUT, PATCH, DELETE when get_object() is called"""
        if request.user.platform_role.identifier == ADMIN:
            return True
        # see if obj has user attribute
        if hasattr(obj, "user"):
            if obj.user != request.user:
                raise PermissionDenied(detail="Not Allowed")
        if hasattr(obj, "talent"):
            if obj.talent.user != request.user:
                raise PermissionDenied(detail="Not Allowed")
        return True


def check_email_domain(email):
    # if email.split('@')[1] in get_forbidden_domains():
    #     raise NonCriticalValidationError({'error': ['Only company email domains are allowed']})
    return True


def custom_exception_handler(exc, context):
    # Use the default exception handler for all exceptions except Throttled
    response = exception_handler(exc, context)

    if isinstance(exc, Throttled):
        # Customize the response data for throttling error
        minutes = int((exc.wait / 60) % 60)
        custom_data = {
            "error": f"Please come back in {minutes} minutes. You have exceeded the amount of requests allowed."
        }
        # Create a new Response instance with the custom data
        response = Response(custom_data, status=429)

    return response
