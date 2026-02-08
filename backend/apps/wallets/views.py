"""
Views for wallet authentication and management.
"""

import logging

from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
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
            raise PermissionDenied("Not authorized to view this wallet")

        try:
            wallet = Wallet.objects.prefetch_related("vaults").get(address=address)
        except Wallet.DoesNotExist:
            raise NotFound("Wallet not found")

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

        # Get or create — idempotent for retries and duplicate calls
        vault, created = Vault.objects.get_or_create(
            wallet=wallet,
            chain_id=chain_id,
            vault_address=vault_address,
            defaults={"is_active": True},
        )

        if not created:
            # Re-activate if it was previously deactivated
            if not vault.is_active:
                vault.is_active = True
                vault.save()
            logger.info(
                f"Vault {vault_address} already registered "
                f"for wallet {wallet.address} on chain {chain_id}"
            )
        else:
            # Deactivate any other vaults on this chain
            Vault.objects.filter(
                wallet=wallet,
                chain_id=chain_id,
                is_active=True,
            ).exclude(pk=vault.pk).update(is_active=False)

            logger.info(
                f"Registered new vault {vault_address} "
                f"for wallet {wallet.address} on chain {chain_id}"
            )

        # Auto-trigger agent cycle for this wallet (deploy idle USDC)
        try:
            from apps.agent.tasks import run_agent_cycle

            run_agent_cycle.delay(wallet.address)
            logger.info(f"Auto-triggered agent cycle for {wallet.address}")
        except Exception as e:
            logger.warning(f"Failed to auto-trigger agent: {e}")

        response_serializer = VaultSerializer(vault)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
