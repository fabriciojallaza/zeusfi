from rest_framework import status
from rest_framework.exceptions import APIException, _get_error_details
from rest_framework.pagination import PageNumberPagination


class NonCriticalValidationError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "A non-critical input validation error occurred."
    default_code = "invalid"

    """Exception raised for errors that are non-critical."""

    def __init__(self, detail=None, code=None):
        if detail is None:
            detail = self.default_detail
        if code is None:
            code = self.default_code

        if isinstance(detail, tuple):
            detail = list(detail)
        elif not isinstance(detail, dict) and not isinstance(detail, list):
            detail = [detail]

        self.detail = _get_error_details(detail, code)


class CustomPagination(PageNumberPagination):
    page_size = 10  # Number of items to display per page
    page_size_query_param = "page_size"
    max_page_size = 100  # Maximum number of items allowed per page

    def paginate_queryset(self, queryset, request, view=None):
        if request.query_params.get("paginate", "true").lower() == "false":
            return None
        return super().paginate_queryset(queryset, request, view)
