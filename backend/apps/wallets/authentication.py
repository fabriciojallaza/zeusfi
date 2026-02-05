"""
JWT authentication backend for DRF.
"""

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request

from apps.wallets.models import Wallet
from apps.wallets.services.auth_service import AuthService, AuthError


class JWTAuthentication(BaseAuthentication):
    """
    JWT-based authentication for wallet addresses.

    Expects Authorization header: Bearer <token>
    """

    keyword = "Bearer"

    def authenticate(self, request: Request) -> tuple[Wallet, str] | None:
        """
        Authenticate the request and return a tuple of (wallet, token).
        """
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return None

        parts = auth_header.split()

        if len(parts) != 2 or parts[0] != self.keyword:
            return None

        token = parts[1]

        try:
            auth_service = AuthService()
            wallet = auth_service.get_wallet_from_token(token)
            return (wallet, token)
        except AuthError as e:
            raise AuthenticationFailed(str(e))

    def authenticate_header(self, request: Request) -> str:
        """
        Return the WWW-Authenticate header value.
        """
        return self.keyword
