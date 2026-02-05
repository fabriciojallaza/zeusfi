"""
Base async HTTP client with retry logic for external API integrations.
"""

import logging
from typing import Any

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

logger = logging.getLogger(__name__)


class BaseAsyncClient:
    """
    Base class for async HTTP clients with built-in retry logic.

    Features:
    - Automatic retries with exponential backoff
    - Configurable timeout
    - JSON response handling
    - Error logging
    """

    BASE_URL: str = ""
    DEFAULT_TIMEOUT: float = 30.0
    MAX_RETRIES: int = 3

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float | None = None,
        headers: dict[str, str] | None = None,
    ):
        self.base_url = base_url or self.BASE_URL
        self.timeout = timeout or self.DEFAULT_TIMEOUT
        self.headers = headers or {}
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "BaseAsyncClient":
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            headers=self.headers,
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    @property
    def client(self) -> httpx.AsyncClient:
        """Get the HTTP client, creating one if needed."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
                headers=self.headers,
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
    )
    async def _get(
        self,
        endpoint: str,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Make a GET request with automatic retry.

        Args:
            endpoint: API endpoint (appended to base_url)
            params: Query parameters

        Returns:
            JSON response as dict

        Raises:
            httpx.HTTPStatusError: For non-2xx responses
        """
        response = await self.client.get(endpoint, params=params)
        response.raise_for_status()
        return response.json()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
    )
    async def _post(
        self,
        endpoint: str,
        json_data: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Make a POST request with automatic retry.

        Args:
            endpoint: API endpoint (appended to base_url)
            json_data: JSON body
            params: Query parameters

        Returns:
            JSON response as dict

        Raises:
            httpx.HTTPStatusError: For non-2xx responses
        """
        response = await self.client.post(endpoint, json=json_data, params=params)
        response.raise_for_status()
        return response.json()


class APIError(Exception):
    """Custom exception for API errors."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        response_data: dict | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data
