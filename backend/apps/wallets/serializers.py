"""
Serializers for wallets app.
"""

from rest_framework import serializers
from .models import Wallet, Vault


class VaultSerializer(serializers.ModelSerializer):
    """Serializer for Vault model."""

    chain_name = serializers.SerializerMethodField()

    class Meta:
        model = Vault
        fields = [
            "id",
            "chain_id",
            "chain_name",
            "vault_address",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_chain_name(self, obj: Vault) -> str:
        from config.chains import CHAIN_ID_TO_NAME
        return CHAIN_ID_TO_NAME.get(obj.chain_id, "unknown")


class WalletSerializer(serializers.ModelSerializer):
    """Serializer for Wallet model with nested vaults."""

    vaults = VaultSerializer(many=True, read_only=True)

    class Meta:
        model = Wallet
        fields = [
            "address",
            "ens_name",
            "created_at",
            "ens_min_apy",
            "ens_max_risk",
            "ens_chains",
            "ens_protocols",
            "ens_auto_rebalance",
            "ens_updated_at",
            "vaults",
        ]
        read_only_fields = [
            "address",
            "created_at",
            "ens_updated_at",
        ]


class WalletPreferencesSerializer(serializers.Serializer):
    """Serializer for ENS preferences."""

    min_apy = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        required=False,
        allow_null=True,
    )
    max_risk = serializers.ChoiceField(
        choices=["low", "medium", "high"],
        required=False,
        allow_null=True,
    )
    chains = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    protocols = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    auto_rebalance = serializers.BooleanField(required=False, default=False)


# Auth serializers

class NonceRequestSerializer(serializers.Serializer):
    """Request serializer for nonce generation."""

    wallet_address = serializers.CharField(
        max_length=42,
        help_text="Ethereum wallet address (0x...)",
    )

    def validate_wallet_address(self, value: str) -> str:
        """Validate Ethereum address format."""
        if not value.startswith("0x") or len(value) != 42:
            raise serializers.ValidationError("Invalid Ethereum address format")
        try:
            # Validate it's a valid hex address
            int(value, 16)
        except ValueError:
            raise serializers.ValidationError("Invalid Ethereum address")
        return value.lower()


class NonceResponseSerializer(serializers.Serializer):
    """Response serializer for nonce generation."""

    nonce = serializers.CharField()
    message = serializers.CharField()
    expires_at = serializers.CharField()


class VerifyRequestSerializer(serializers.Serializer):
    """Request serializer for SIWE verification."""

    wallet_address = serializers.CharField(max_length=42)
    message = serializers.CharField()
    signature = serializers.CharField()
    nonce = serializers.CharField(max_length=32)

    def validate_wallet_address(self, value: str) -> str:
        """Validate Ethereum address format."""
        if not value.startswith("0x") or len(value) != 42:
            raise serializers.ValidationError("Invalid Ethereum address format")
        return value.lower()

    def validate_signature(self, value: str) -> str:
        """Validate signature format."""
        if not value.startswith("0x"):
            raise serializers.ValidationError("Signature must start with 0x")
        return value


class VerifyResponseSerializer(serializers.Serializer):
    """Response serializer for SIWE verification."""

    token = serializers.CharField()
    wallet = WalletSerializer()


class RegisterVaultRequestSerializer(serializers.Serializer):
    """Request serializer for vault registration."""

    chain_id = serializers.IntegerField()
    vault_address = serializers.CharField(max_length=42)

    def validate_chain_id(self, value: int) -> int:
        """Validate chain ID is supported."""
        from config.chains import is_supported_chain
        if not is_supported_chain(value):
            raise serializers.ValidationError(
                f"Unsupported chain ID: {value}. Supported: 8453, 42161, 43114"
            )
        return value

    def validate_vault_address(self, value: str) -> str:
        """Validate vault address format."""
        if not value.startswith("0x") or len(value) != 42:
            raise serializers.ValidationError("Invalid vault address format")
        return value.lower()
