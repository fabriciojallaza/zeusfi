from rest_framework.exceptions import ErrorDetail


def flatten_errors(errors):
    """
    Recursively flatten validation errors into a list of messages.

    Handles:
    - Simple ErrorDetail objects
    - String/primitive values
    - Lists of errors
    - Nested dictionaries
    - Mixed structures
    """
    error_messages = []

    if isinstance(errors, ErrorDetail):
        # Single ErrorDetail object
        error_messages.append(str(errors))

    elif isinstance(errors, str):
        # Plain string error
        error_messages.append(errors)

    elif isinstance(errors, (int, float, bool)):
        # Primitive values (like attempt_id, challenge_id)
        error_messages.append(str(errors))

    elif isinstance(errors, list):
        # List of errors
        for error in errors:
            error_messages.extend(flatten_errors(error))

    elif isinstance(errors, dict):
        # Dictionary of errors
        for field, field_errors in errors.items():
            if isinstance(field_errors, dict):
                # Nested dictionary - recurse deeper
                nested_errors = flatten_errors(field_errors)
                for nested_error in nested_errors:
                    error_messages.append(f"{field}.{nested_error}")

            elif isinstance(field_errors, list):
                # List of errors for this field
                for error in field_errors:
                    if isinstance(error, (str, ErrorDetail)):
                        error_messages.append(f"{field}: {error}")
                    else:
                        # Recurse for complex objects in list
                        error_messages.extend(flatten_errors(error))

            elif isinstance(field_errors, (str, ErrorDetail, int, float, bool)):
                # Single value (string, number, or ErrorDetail)
                error_messages.append(f"{field}: {field_errors}")

            else:
                # Fallback for other types - recurse
                nested_errors = flatten_errors(field_errors)
                for nested_error in nested_errors:
                    error_messages.append(f"{field}: {nested_error}")

    else:
        # Fallback for unknown types
        error_messages.append(str(errors))

    return error_messages


def validation_error_handling(e):
    """
    Handle ValidationError exceptions and convert them to user-friendly messages.

    Supports:
    - Simple string errors: ValidationError("Error message")
    - Dict errors: ValidationError(detail={"field": "error"})
    - Dict errors with message field: ValidationError(detail={"message": "...", "technical_details": "..."})
      (only returns the message field to user)
    - List errors: ValidationError(detail=[{"field": "error"}])
    - Nested structures
    """
    errors = e.detail
    error_messages = []

    if isinstance(errors, (str, ErrorDetail)):
        # Simple string error
        error_messages.append(str(errors))

    elif isinstance(errors, list):
        # List of error dictionaries
        for errors_dict in errors:
            if errors_dict:
                error_messages.extend(flatten_errors(errors_dict))

    elif isinstance(errors, dict):
        # Check if this is a structured error with a "message" field
        # In this case, only return the message to the user
        # (technical details will be logged separately in middleware)
        if "message" in errors:
            return str(errors["message"])

        # Dictionary of errors
        error_messages = flatten_errors(errors)

    else:
        # Fallback
        error_messages.append(str(errors))

    # Join messages with proper formatting
    if not error_messages:
        return "Validation error occurred"

    # Return as comma-separated string if multiple messages
    if len(error_messages) == 1:
        return error_messages[0]
    else:
        return ", ".join(error_messages)
