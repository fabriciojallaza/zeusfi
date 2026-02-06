"""
Views for wallet authentication and management.
"""

import logging

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import JWTAuthentication
from .models import Wallet, Vault
from .serializers import (
    NonceRequestSerializer,
    NonceResponseSerializer,
    VerifyRequestSerializer,
    VerifyResponseSerializer,
    WalletSerializer,
    RegisterVaultRequestSerializer,
    VaultSerializer,
)
from .services.auth_service import AuthService, AuthError

logger = logging.getLogger(__name__)


# =============================================================================
# Auth Views
# =============================================================================


class NonceView(APIView):
    """
    Generate nonce for SIWE authentication.

    POST /api/v1/auth/nonce/
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = NonceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wallet_address = serializer.validated_data["wallet_address"]

        auth_service = AuthService()
        result = auth_service.generate_nonce(wallet_address)

        response_serializer = NonceResponseSerializer(result)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class VerifyView(APIView):
    """
    Verify SIWE signature and return JWT token.

    POST /api/v1/auth/verify/
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        from rest_framework.exceptions import ValidationError

        serializer = VerifyRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        auth_service = AuthService()

        try:
            wallet = auth_service.verify_siwe(
                wallet_address=serializer.validated_data["wallet_address"],
                message=serializer.validated_data["message"],
                signature=serializer.validated_data["signature"],
                nonce=serializer.validated_data["nonce"],
            )
        except AuthError as e:
            raise ValidationError(f"SIWE verification failed: {str(e)}")

        token = auth_service.create_jwt(wallet)

        response_data = {
            "token": token,
            "wallet": WalletSerializer(wallet).data,
        }

        response_serializer = VerifyResponseSerializer(response_data)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


# =============================================================================
# Wallet Views
# =============================================================================


class WalletDetailView(APIView):
    """
    Get wallet details including vaults and ENS preferences.

    GET /api/v1/wallet/{address}/
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, address: str) -> Response:
        address = address.lower()

        # Users can only view their own wallet
        if request.user.address != address:
            return Response(
                {"error": "Not authorized to view this wallet"},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            wallet = Wallet.objects.prefetch_related("vaults").get(address=address)
        except Wallet.DoesNotExist:
            return Response(
                {"error": "Wallet not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = WalletSerializer(wallet)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RegisterVaultView(APIView):
    """
    Register a new vault address for the authenticated wallet.

    POST /api/v1/wallet/register-vault/
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        serializer = RegisterVaultRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wallet = request.user
        chain_id = serializer.validated_data["chain_id"]
        vault_address = serializer.validated_data["vault_address"]

        # Check if vault already exists for this wallet on this chain
        existing_vault = Vault.objects.filter(
            wallet=wallet,
            chain_id=chain_id,
            is_active=True,
        ).first()

        if existing_vault:
            # Deactivate old vault if registering a new one
            existing_vault.is_active = False
            existing_vault.save()
            logger.info(
                f"Deactivated old vault {existing_vault.vault_address} "
                f"for wallet {wallet.address} on chain {chain_id}"
            )

        # Create new vault
        vault = Vault.objects.create(
            wallet=wallet,
            chain_id=chain_id,
            vault_address=vault_address,
            is_active=True,
        )

        logger.info(
            f"Registered new vault {vault_address} "
            f"for wallet {wallet.address} on chain {chain_id}"
        )

        response_serializer = VaultSerializer(vault)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
