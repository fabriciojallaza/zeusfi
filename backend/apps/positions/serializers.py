"""
Serializers for positions app.
"""

from rest_framework import serializers
from .models import Position, RebalanceHistory


class PositionSerializer(serializers.ModelSerializer):
    """Serializer for Position model."""

    chain_name = serializers.CharField(read_only=True)
    vault_address = serializers.CharField(source="vault.vault_address", read_only=True)

    class Meta:
        model = Position
        fields = [
            "id",
            "vault_address",
            "chain_id",
            "chain_name",
            "protocol",
            "token",
            "amount",
            "amount_usd",
            "current_apy",
            "updated_at",
        ]


class RebalanceHistorySerializer(serializers.ModelSerializer):
    """Serializer for RebalanceHistory model."""

    from_chain_name = serializers.CharField(read_only=True)
    to_chain_name = serializers.CharField(read_only=True)
    is_cross_chain = serializers.BooleanField(read_only=True)

    class Meta:
        model = RebalanceHistory
        fields = [
            "id",
            "from_chain_id",
            "from_chain_name",
            "from_protocol",
            "from_token",
            "to_chain_id",
            "to_chain_name",
            "to_protocol",
            "to_token",
            "amount",
            "amount_usd",
            "tx_hash",
            "status",
            "from_apy",
            "to_apy",
            "apy_improvement",
            "agent_reasoning",
            "is_cross_chain",
            "created_at",
            "completed_at",
        ]


class PositionSummarySerializer(serializers.Serializer):
    """Serializer for position summary."""

    total_value_usd = serializers.DecimalField(max_digits=20, decimal_places=2)
    average_apy = serializers.DecimalField(max_digits=10, decimal_places=4)
    positions = PositionSerializer(many=True)
    by_chain = serializers.DictField()
    by_protocol = serializers.DictField()


class QuoteRequestSerializer(serializers.Serializer):
    """Request serializer for LI.FI quote."""

    from_chain = serializers.IntegerField(help_text="Source chain ID")
    from_token = serializers.CharField(max_length=42, help_text="Source token address")
    from_amount = serializers.CharField(help_text="Amount in wei/smallest unit")
    to_chain = serializers.IntegerField(help_text="Destination chain ID")
    to_token = serializers.CharField(
        max_length=42, help_text="Destination token address"
    )
    vault_address = serializers.CharField(max_length=42, help_text="Vault address")
    slippage = serializers.FloatField(
        default=0.03,
        min_value=0.001,
        max_value=0.5,
        help_text="Slippage tolerance (0.03 = 3%)",
    )

    def validate_from_chain(self, value: int) -> int:
        """Validate source chain ID is supported."""
        from config.chains import is_supported_chain

        if not is_supported_chain(value):
            raise serializers.ValidationError(f"Unsupported chain ID: {value}")
        return value

    def validate_to_chain(self, value: int) -> int:
        """Validate destination chain ID is supported."""
        from config.chains import is_supported_chain

        if not is_supported_chain(value):
            raise serializers.ValidationError(f"Unsupported chain ID: {value}")
        return value

    def validate_from_token(self, value: str) -> str:
        """Validate token address format."""
        if not value.startswith("0x") or len(value) != 42:
            raise serializers.ValidationError("Invalid token address format")
        return value.lower()

    def validate_to_token(self, value: str) -> str:
        """Validate token address format."""
        if not value.startswith("0x") or len(value) != 42:
            raise serializers.ValidationError("Invalid token address format")
        return value.lower()

    def validate_vault_address(self, value: str) -> str:
        """Validate vault address format."""
        if not value.startswith("0x") or len(value) != 42:
            raise serializers.ValidationError("Invalid vault address format")
        return value.lower()

    def validate(self, data):
        if (
            data["from_chain"] == data["to_chain"]
            and data["from_token"].lower() == data["to_token"].lower()
        ):
            raise serializers.ValidationError(
                "from_token and to_token cannot be the same on the same chain. "
                "Use the deposit token address (e.g. aUSDC for Aave, vault shares for Morpho)."
            )
        return data


class TransactionRequestSerializer(serializers.Serializer):
    """Serializer for transaction request data."""

    to = serializers.CharField()
    data = serializers.CharField()
    value = serializers.CharField()
    gas_limit = serializers.CharField(allow_null=True)
    chain_id = serializers.IntegerField(allow_null=True)


class QuoteResponseSerializer(serializers.Serializer):
    """Response serializer for LI.FI quote."""

    quote_id = serializers.CharField()
    type = serializers.CharField()
    tool = serializers.CharField()
    is_cross_chain = serializers.BooleanField()
    from_chain = serializers.IntegerField()
    from_token = serializers.CharField()
    from_amount = serializers.CharField()
    to_chain = serializers.IntegerField()
    to_token = serializers.CharField()
    to_amount = serializers.CharField()
    to_amount_min = serializers.CharField()
    gas_cost_usd = serializers.CharField()
    execution_duration = serializers.IntegerField(allow_null=True)
    transaction_request = TransactionRequestSerializer(allow_null=True)


class ExecuteRebalanceRequestSerializer(serializers.Serializer):
    """Request serializer for executing a rebalance via LI.FI."""

    # Required fields
    from_chain = serializers.IntegerField(help_text="Source chain ID")
    from_token = serializers.CharField(max_length=42, help_text="Source token address")
    from_amount = serializers.CharField(help_text="Amount in wei/smallest unit")
    to_chain = serializers.IntegerField(help_text="Destination chain ID")
    to_token = serializers.CharField(
        max_length=42, help_text="Destination token address"
    )
    vault_address = serializers.CharField(
        max_length=42, help_text="Source vault address"
    )

    # Optional fields
    slippage = serializers.FloatField(
        default=0.03,
        min_value=0.001,
        max_value=0.5,
        required=False,
    )
    from_protocol = serializers.CharField(max_length=100, required=False, default="")
    to_protocol = serializers.CharField(max_length=100, required=False, default="")
    from_token_symbol = serializers.CharField(
        max_length=50, required=False, default="USDC"
    )
    to_token_symbol = serializers.CharField(
        max_length=50, required=False, default="USDC"
    )
    from_apy = serializers.DecimalField(
        max_digits=10, decimal_places=4, required=False, allow_null=True
    )
    to_apy = serializers.DecimalField(
        max_digits=10, decimal_places=4, required=False, allow_null=True
    )
    agent_reasoning = serializers.CharField(required=False, allow_blank=True)

    # Execution mode
    async_execution = serializers.BooleanField(
        default=False,
        required=False,
        source="async",
        help_text="If true, queue for background execution",
    )

    def validate_from_chain(self, value: int) -> int:
        from config.chains import is_supported_chain

        if not is_supported_chain(value):
            raise serializers.ValidationError(f"Unsupported chain ID: {value}")
        return value

    def validate_to_chain(self, value: int) -> int:
        from config.chains import is_supported_chain

        if not is_supported_chain(value):
            raise serializers.ValidationError(f"Unsupported chain ID: {value}")
        return value

    def validate_from_token(self, value: str) -> str:
        if not value.startswith("0x") or len(value) != 42:
            raise serializers.ValidationError("Invalid token address format")
        return value.lower()

    def validate_to_token(self, value: str) -> str:
        if not value.startswith("0x") or len(value) != 42:
            raise serializers.ValidationError("Invalid token address format")
        return value.lower()

    def validate_vault_address(self, value: str) -> str:
        if not value.startswith("0x") or len(value) != 42:
            raise serializers.ValidationError("Invalid vault address format")
        return value.lower()


class ExecuteRebalanceResponseSerializer(serializers.Serializer):
    """Response serializer for rebalance execution."""

    rebalance_id = serializers.IntegerField()
    status = serializers.CharField()
    tx_hash = serializers.CharField(allow_null=True, required=False)
    from_amount = serializers.CharField(required=False)
    to_amount = serializers.CharField(required=False)
    tool = serializers.CharField(required=False)
    message = serializers.CharField(required=False)
