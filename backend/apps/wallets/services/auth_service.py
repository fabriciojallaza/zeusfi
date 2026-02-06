"""
Authentication service for SIWE (Sign-In with Ethereum) and JWT management.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from django.conf import settings
from eth_account.messages import encode_defunct
from web3 import Web3

from apps.wallets.models import AuthNonce, Wallet

logger = logging.getLogger(__name__)


class AuthError(Exception):
    """Authentication error."""

    pass


class AuthService:
    """
    Service for wallet-based authentication using SIWE pattern.

    Flow:
    1. generate_nonce(wallet_address) - Create random nonce, store in DB
    2. verify_siwe(message, signature, nonce) - Verify signature
    3. create_jwt(wallet_address) - Create JWT token
    4. decode_jwt(token) - Validate and decode JWT
    """

    SIWE_MESSAGE_TEMPLATE = """ZeusFi wants you to sign in with your Ethereum account:
{address}

Sign in to ZeusFi yield farming agent.

URI: {uri}
Version: 1
Chain ID: 1
Nonce: {nonce}
Issued At: {issued_at}"""

    def __init__(self):
        self.jwt_secret = settings.JWT_SECRET_KEY
        self.jwt_algorithm = settings.JWT_ALGORITHM
        self.jwt_expiry_hours = settings.JWT_EXPIRY_HOURS
        self.w3 = Web3()

    def generate_nonce(self, wallet_address: str) -> dict[str, Any]:
        """
        Generate a new nonce for SIWE authentication.

        Args:
            wallet_address: Ethereum wallet address

        Returns:
            Dict with nonce and SIWE message to sign
        """
        # Clean up old nonces for this wallet
        AuthNonce.objects.filter(
            wallet_address=wallet_address.lower(),
            used=False,
        ).delete()

        # Generate new nonce
        auth_nonce = AuthNonce.generate(wallet_address)

        # Generate SIWE message
        message = self.SIWE_MESSAGE_TEMPLATE.format(
            address=Web3.to_checksum_address(wallet_address),
            uri="https://zeusfi.xyz",
            nonce=auth_nonce.nonce,
            issued_at=datetime.now(timezone.utc).isoformat(),
        )

        return {
            "nonce": auth_nonce.nonce,
            "message": message,
            "expires_at": auth_nonce.expires_at.isoformat(),
        }

    def verify_siwe(
        self,
        wallet_address: str,
        message: str,
        signature: str,
        nonce: str,
    ) -> Wallet:
        """
        Verify SIWE signature and return/create wallet.

        Args:
            wallet_address: Expected wallet address
            message: SIWE message that was signed
            signature: Signature from wallet
            nonce: Nonce from the SIWE message

        Returns:
            Wallet instance

        Raises:
            AuthError: If verification fails
        """
        wallet_address = wallet_address.lower()

        # Verify nonce exists and is valid
        try:
            auth_nonce = AuthNonce.objects.get(
                nonce=nonce,
                wallet_address=wallet_address,
            )
        except AuthNonce.DoesNotExist:
            raise AuthError("Invalid nonce")

        if not auth_nonce.is_valid:
            raise AuthError("Nonce expired or already used")

        # Verify signature
        try:
            message_hash = encode_defunct(text=message)
            recovered_address = self.w3.eth.account.recover_message(
                message_hash,
                signature=signature,
            )
        except Exception as e:
            logger.error(f"Signature verification failed: {e}")
            raise AuthError("Invalid signature")

        if recovered_address.lower() != wallet_address:
            raise AuthError("Signature does not match wallet address")

        # Mark nonce as used
        auth_nonce.mark_used()

        # Get or create wallet
        wallet, created = Wallet.objects.get_or_create(
            address=wallet_address,
        )

        if created:
            logger.info(f"New wallet registered: {wallet_address}")

        return wallet

    def create_jwt(self, wallet: Wallet) -> str:
        """
        Create JWT token for authenticated wallet.

        Args:
            wallet: Wallet instance

        Returns:
            JWT token string
        """
        now = datetime.now(timezone.utc)
        payload = {
            "sub": wallet.address,
            "ens": wallet.ens_name,
            "iat": now,
            "exp": now + timedelta(hours=self.jwt_expiry_hours),
        }

        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)

    def decode_jwt(self, token: str) -> dict[str, Any]:
        """
        Decode and validate JWT token.

        Args:
            token: JWT token string

        Returns:
            Decoded payload

        Raises:
            AuthError: If token is invalid or expired
        """
        try:
            payload = jwt.decode(
                token,
                self.jwt_secret,
                algorithms=[self.jwt_algorithm],
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise AuthError("Token expired")
        except jwt.InvalidTokenError as e:
            raise AuthError(f"Invalid token: {e}")

    def get_wallet_from_token(self, token: str) -> Wallet:
        """
        Get wallet instance from JWT token.

        Args:
            token: JWT token string

        Returns:
            Wallet instance

        Raises:
            AuthError: If token is invalid or wallet doesn't exist
        """
        payload = self.decode_jwt(token)
        wallet_address = payload.get("sub")

        if not wallet_address:
            raise AuthError("Invalid token: missing wallet address")

        try:
            return Wallet.objects.get(address=wallet_address)
        except Wallet.DoesNotExist:
            raise AuthError("Wallet not found")
