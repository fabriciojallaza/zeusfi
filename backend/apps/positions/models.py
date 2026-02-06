"""
Position and rebalancing history models.
"""

from django.db import models


class Position(models.Model):
    """
    Current position for a vault.

    Tracks where user funds are currently deployed.
    """

    vault = models.ForeignKey(
        "wallets.Vault",
        on_delete=models.CASCADE,
        related_name="positions",
    )
    yield_pool = models.ForeignKey(
        "yields.YieldPool",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="positions",
    )

    chain_id = models.IntegerField(
        help_text="Chain ID where position is held",
    )
    protocol = models.CharField(
        max_length=100,
        help_text="Protocol name (aave-v3, morpho, euler)",
    )
    token = models.CharField(
        max_length=50,
        help_text="Token symbol (e.g., USDC)",
    )

    amount = models.DecimalField(
        max_digits=30,
        decimal_places=18,
        help_text="Amount in token's native decimals",
    )
    amount_usd = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        default=0,
        help_text="Amount in USD",
    )
    current_apy = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        default=0,
        help_text="Current APY for this position",
    )

    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Position"
        verbose_name_plural = "Positions"
        ordering = ["-amount_usd"]

    def __str__(self) -> str:
        return f"{self.amount} {self.token} on {self.protocol} ({self.chain_id})"

    @property
    def chain_name(self) -> str:
        """Get human-readable chain name."""
        from config.chains import CHAIN_ID_TO_NAME

        return CHAIN_ID_TO_NAME.get(self.chain_id, str(self.chain_id))


class RebalanceHistory(models.Model):
    """
    Log of rebalancing actions.

    Records every time funds are moved between protocols/chains.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUBMITTED = "submitted", "Submitted"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"

    wallet = models.ForeignKey(
        "wallets.Wallet",
        on_delete=models.CASCADE,
        related_name="rebalance_history",
    )

    # Source
    from_chain_id = models.IntegerField(
        help_text="Source chain ID",
    )
    from_protocol = models.CharField(
        max_length=100,
        help_text="Source protocol name",
    )
    from_token = models.CharField(
        max_length=50,
        help_text="Source token symbol",
    )
    from_vault = models.ForeignKey(
        "wallets.Vault",
        on_delete=models.SET_NULL,
        null=True,
        related_name="rebalances_from",
    )

    # Destination
    to_chain_id = models.IntegerField(
        help_text="Destination chain ID",
    )
    to_protocol = models.CharField(
        max_length=100,
        help_text="Destination protocol name",
    )
    to_token = models.CharField(
        max_length=50,
        help_text="Destination token symbol",
    )
    to_vault = models.ForeignKey(
        "wallets.Vault",
        on_delete=models.SET_NULL,
        null=True,
        related_name="rebalances_to",
    )

    # Amount
    amount = models.DecimalField(
        max_digits=30,
        decimal_places=18,
        help_text="Amount moved in token's native decimals",
    )
    amount_usd = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        default=0,
        help_text="Amount in USD at time of rebalance",
    )

    # Transaction
    tx_hash = models.CharField(
        max_length=66,
        null=True,
        blank=True,
        help_text="Transaction hash (0x...)",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    # APY at time of rebalance
    from_apy = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="APY of source pool at time of rebalance",
    )
    to_apy = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="APY of destination pool at time of rebalance",
    )
    apy_improvement = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="APY improvement (to_apy - from_apy)",
    )

    # AI reasoning
    agent_reasoning = models.TextField(
        null=True,
        blank=True,
        help_text="Why AI decided to make this rebalance",
    )

    # Error info
    error_message = models.TextField(
        null=True,
        blank=True,
        help_text="Error message if failed",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the rebalance completed",
    )

    class Meta:
        verbose_name = "Rebalance History"
        verbose_name_plural = "Rebalance History"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["wallet", "created_at"]),
            models.Index(fields=["status"]),
            models.Index(fields=["tx_hash"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.amount} {self.from_token} "
            f"from {self.from_protocol}@{self.from_chain_id} "
            f"to {self.to_protocol}@{self.to_chain_id}"
        )

    @property
    def from_chain_name(self) -> str:
        """Get human-readable source chain name."""
        from config.chains import CHAIN_ID_TO_NAME

        return CHAIN_ID_TO_NAME.get(self.from_chain_id, str(self.from_chain_id))

    @property
    def to_chain_name(self) -> str:
        """Get human-readable destination chain name."""
        from config.chains import CHAIN_ID_TO_NAME

        return CHAIN_ID_TO_NAME.get(self.to_chain_id, str(self.to_chain_id))

    @property
    def is_cross_chain(self) -> bool:
        """Check if this is a cross-chain rebalance."""
        return self.from_chain_id != self.to_chain_id

    def mark_submitted(self, tx_hash: str) -> None:
        """Mark rebalance as submitted with transaction hash."""
        self.tx_hash = tx_hash
        self.status = self.Status.SUBMITTED
        self.save(update_fields=["tx_hash", "status"])

    def mark_success(self) -> None:
        """Mark rebalance as successful."""
        from django.utils import timezone

        self.status = self.Status.SUCCESS
        self.completed_at = timezone.now()
        self.save(update_fields=["status", "completed_at"])

    def mark_failed(self, error: str) -> None:
        """Mark rebalance as failed with error message."""
        from django.utils import timezone

        self.status = self.Status.FAILED
        self.error_message = error
        self.completed_at = timezone.now()
        self.save(update_fields=["status", "error_message", "completed_at"])
