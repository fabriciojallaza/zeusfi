from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError
from django.db.models import ProtectedError
from django.http import Http404

from core.drf import NonCriticalValidationError


from parameters.common.error_handling.validation_error import (
    validation_error_handling,
)
from rest_framework.exceptions import (
    ValidationError,
    PermissionDenied,
    NotFound,
    APIException,
    AuthenticationFailed,
)
from rest_framework.response import Response
from rest_framework import status
from parameters.common.logger.logger_service import LoggerService


def custom_exception_handler(exc, context):
    """
    Sends unexpected ones.
    """

    if isinstance(exc, ValidationError):
        # Validation errors are user errors, not system errors
        # Get user-friendly message for response
        error_messages = validation_error_handling(exc)

        # Log full details to database (includes technical_details, error_code, IDs, etc.)
        log_message = {
            "error": error_messages,
            "full_details": exc.detail,
        }

        LoggerService.create_logg(
            status.HTTP_400_BAD_REQUEST, context["request"], log_message
        )
        return Response({"error": error_messages}, status=status.HTTP_400_BAD_REQUEST)

    elif isinstance(exc, IntegrityError):
        # Database integrity errors - extract useful information
        error_str = str(exc)

        # Try to extract constraint name and details from the error message
        user_message = "Database integrity error: "

        if "unique constraint" in error_str.lower():
            # Extract constraint name for context-specific messages
            constraint_name = None
            if "violates unique constraint" in error_str:
                # Instead of try-except, use explicit checking
                constraint_parts = (
                    error_str.split('"') if isinstance(error_str, str) else []
                )
                if len(constraint_parts) >= 2:
                    constraint_name = constraint_parts[1]

            # Provide specific messages for known constraints
            if constraint_name and "season_id_order_in_season" in constraint_name:
                user_message += "A challenge with this order already exists in this season. Challenge orders must be unique within each season."
            elif constraint_name and "season_persona" in constraint_name:
                user_message += "This AI persona is already assigned to this season."
            elif constraint_name and "member_id_date" in constraint_name:
                user_message += "A record for this member and date already exists."
            elif constraint_name:
                # Generic message with extracted constraint info
                user_message += "Duplicate entry detected. "
                # Extract the duplicate key details if available
                if "Key (" in error_str:
                    # Use explicit validation instead of try-except
                    key_parts = error_str.split("Key (")
                    if len(key_parts) > 1 and ")=(" in key_parts[1]:
                        key_info = key_parts[1].split(")=")[0]
                        val_parts = error_str.split(")=(")
                        if len(val_parts) > 1 and ")" in val_parts[1]:
                            key_value = val_parts[1].split(")")[0]
                            user_message += f"The combination of '{key_info}' with values '{key_value}' already exists."
                        else:
                            user_message += "This combination of values already exists."
                    else:
                        user_message += "This combination of values already exists."
                else:
                    user_message += "This combination of values already exists."
            else:
                user_message += (
                    "Duplicate entry detected. Please ensure all values are unique."
                )

        elif "check constraint" in error_str.lower():
            # Handle CHECK constraint violations
            constraint_name = None
            # Use explicit validation instead of try-except
            if 'violates check constraint "' in error_str:
                parts = error_str.split('violates check constraint "')
                if len(parts) > 1 and '"' in parts[1]:
                    constraint_name = parts[1].split('"')[0]

            # Provide specific messages for known check constraints
            if constraint_name and "order_in_season_check" in constraint_name:
                user_message += "Challenge order must be a positive number or null. Negative values are not allowed."
            elif constraint_name and any(
                keyword in constraint_name.lower()
                for keyword in ["positive", "_check", "gt", "gte"]
            ):
                # Extract field name from constraint
                field_name = (
                    constraint_name.replace("_check", "")
                    .replace("challenges_challenge_", "")
                    .replace("_", " ")
                )
                user_message += f"Invalid value for '{field_name}'. The value must meet the field's validation requirements (e.g., must be positive, within range, etc.)."
            elif constraint_name:
                user_message += f"The value violates validation rules for constraint '{constraint_name}'."
            else:
                user_message += "The provided value does not meet the field's validation requirements."

            # Try to extract detail about the failing value
            # Use explicit validation instead of try-except
            if "DETAIL:" in error_str:
                parts = error_str.split("DETAIL:")
                if len(parts) > 1 and parts[1].strip():
                    # Don't show the full row, just mention there's a validation issue
                    user_message += " Please check the values you're trying to save."

        elif "foreign key constraint" in error_str.lower():
            user_message += "Referenced record does not exist or cannot be deleted due to dependencies."

        elif "not null constraint" in error_str.lower():
            # Extract column name if possible
            # Use explicit validation instead of try-except
            if "null value in column" in error_str.lower() and 'column "' in error_str:
                parts = error_str.split('column "')
                if len(parts) > 1 and '"' in parts[1]:
                    column_name = parts[1].split('"')[0]
                    user_message += (
                        f"The field '{column_name}' is required and cannot be empty."
                    )
                else:
                    user_message += "A required field is missing. Please provide all necessary information."
            else:
                user_message += "A required field is missing. Please provide all necessary information."

        else:
            # Fallback - try to extract any useful info from the error
            user_message += "The operation violates database constraints. "
            # Try to find any constraint name in quotes
            # Use explicit validation instead of try-except
            if '"' in error_str and isinstance(error_str, str):
                parts = error_str.split('"')
                if len(parts) >= 2:
                    user_message += f"Issue with: {parts[:3]}... "
            user_message += "Please check your data."

        # Log full technical details
        log_message = {
            "error": user_message,
            "full_technical_details": error_str,
        }

        LoggerService.create_logg(
            status.HTTP_400_BAD_REQUEST, context["request"], log_message
        )
        return Response({"error": user_message}, status=status.HTTP_400_BAD_REQUEST)

    elif isinstance(exc, ProtectedError):
        # Handle ProtectedError from foreign key constraints
        error_message = f"Cannot delete this object because it would affect related objects: {str(exc)}"
        LoggerService.create_logg(
            status.HTTP_400_BAD_REQUEST, context["request"], error_message
        )
        return Response({"error": error_message}, status=status.HTTP_400_BAD_REQUEST)

    elif isinstance(exc, NonCriticalValidationError):
        error_messages = validation_error_handling(exc)
        LoggerService.create_logg(
            status.HTTP_400_BAD_REQUEST, context["request"], error_messages
        )
        return Response({"error": error_messages}, status=status.HTTP_400_BAD_REQUEST)

    elif isinstance(exc, ValueError):
        # Handle ValueError properly - not as a database error
        error_message = f"Invalid value: {str(exc)}"
        LoggerService.create_logg(
            status.HTTP_400_BAD_REQUEST, context["request"], error_message
        )
        return Response({"error": error_message}, status=status.HTTP_400_BAD_REQUEST)

    elif isinstance(exc, AuthenticationFailed):
        LoggerService.create_logg(
            status.HTTP_401_UNAUTHORIZED, context["request"], str(exc)
        )
        return Response({"error": str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

    elif isinstance(exc, PermissionDenied):
        LoggerService.create_logg(
            status.HTTP_403_FORBIDDEN, context["request"], str(exc)
        )
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)

    elif isinstance(exc, (Http404, NotFound, ObjectDoesNotExist)):
        LoggerService.create_logg(
            status.HTTP_404_NOT_FOUND, context["request"], str(exc)
        )
        return Response({"error": str(exc)}, status=status.HTTP_404_NOT_FOUND)

    elif isinstance(exc, KeyError):
        error_message = f"Internal configuration error: missing key {str(exc)}"
        LoggerService.create_logg(
            status.HTTP_500_INTERNAL_SERVER_ERROR, context["request"], error_message
        )
        return Response(
            {"error": "Internal server error"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    elif isinstance(exc, APIException):
        # API exceptions with 5xx status codes are unexpected
        status_code = getattr(exc, "status_code", status.HTTP_500_INTERNAL_SERVER_ERROR)

        LoggerService.create_logg(status_code, context["request"], str(exc))
        return Response({"error": str(exc)}, status=status_code)

    else:
        LoggerService.create_logg(
            status.HTTP_500_INTERNAL_SERVER_ERROR, context["request"], str(exc)
        )
        return Response(
            {"error": f"An unexpected error occurred. Error: {str(exc)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
