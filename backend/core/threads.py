import threading
from functools import wraps
import logging

from rest_framework import status

from parameters.common.logger.logger_service import LoggerService
from core.sentry_utils import set_sentry_tags, set_sentry_extras

logger = logging.getLogger(__name__)


def run_in_background(manual_log=False):
    """
    A decorator to execute a function in a separate thread as a background task.
    Allows enabling or disabling manual logging.

    IMPORTANT: All exceptions are re-raised to ensure Sentry captures them.
    The exception is raised in the background thread, so it won't affect the main flow,
    but Sentry will still capture it for alerting.
    """

    # If the decorator is used without parentheses
    if callable(manual_log):
        func = manual_log
        manual_log = False
        return run_in_background(manual_log)(func)

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            def background_task():
                # Set Sentry context for background tasks
                set_sentry_tags(
                    {
                        "task_type": "background",
                        "is_background_task": "true",
                        "function_name": func.__name__,
                    }
                )

                try:
                    func(*args, **kwargs)
                    if manual_log:
                        LoggerService.create__manual_logg(
                            status.HTTP_200_OK,
                            f"Background task {func.__name__} executed successfully",
                            "POST",
                            str({"args": args, "kwargs": kwargs}),
                            str({"error": None}),
                        )
                    else:
                        LoggerService.create_logg(
                            status.HTTP_200_OK,
                            kwargs.get("request", None) or args[0],
                            f"Background task {func.__name__} executed successfully",
                            background_task=True,
                        )
                except Exception as e:
                    # Log the error first
                    if manual_log:
                        LoggerService.create__manual_logg(
                            status.HTTP_500_INTERNAL_SERVER_ERROR,
                            f"Background error while executing {func.__name__}",
                            "POST",
                            str({"args": args, "kwargs": kwargs}),
                            str({"error": str(e)}),
                        )
                    else:
                        LoggerService.create_logg(
                            status.HTTP_400_BAD_REQUEST,
                            kwargs.get("request", None) or args[0],
                            f"Background error while executing {func.__name__}: {e}",
                            background_task=True,
                        )

                    # Add additional context to Sentry before capturing
                    set_sentry_extras(
                        {
                            "args": str(args),
                            "kwargs": str(kwargs),
                            "error_message": str(e),
                            "function": func.__name__,
                            "module": func.__module__,
                        }
                    )

                    # CRITICAL: Re-raise the exception so Sentry captures it
                    # This happens in the background thread, so it won't affect the main flow
                    logger.error(
                        f"Background task {func.__name__} failed with error: {e}",
                        exc_info=True,
                        extra={
                            "function": func.__name__,
                            "module": func.__module__,
                            "is_background_task": True,
                        },
                    )
                    raise

            thread = threading.Thread(target=background_task, daemon=True)
            thread.start()

        return wrapper

    return decorator
