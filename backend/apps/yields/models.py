"""
Yield pool models for caching DeFiLlama data.
"""

from django.db import models


class YieldPool(models.Model):
    """
    Cached yield pool data from DeFiLlama.

    Updated every 30 minutes by Celery beat task.
    """

    pool_id = models.CharField(
        max_length=100,
        primary_key=True,
        help_text="DeFiLlama pool ID",
    )
    chain = models.CharField(
        max_length=50,
        help_text="Chain name (base, arbitrum, optimism)",
    )
    chain_id = models.IntegerField(
        help_text="Chain ID (8453, 42161, 10)",
    )
    project = models.CharField(
        max_length=100,
        help_text="Protocol name (aave-v3, morpho-v1, euler-v2)",
    )
    symbol = models.CharField(
        max_length=50,
        help_text="Token symbol (e.g., USDC)",
    )

    # Yield data
    tvl_usd = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        help_text="Total value locked in USD",
    )
    apy = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        help_text="Total APY (base + reward)",
    )
    apy_base = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Base APY from lending",
    )
    apy_reward = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Reward APY from incentives",
    )

    # Risk metrics
    risk_score = models.IntegerField(
        default=5,
        help_text="Risk score 1-10 (1=lowest risk)",
    )
    stable_coin = models.BooleanField(
        default=True,
        help_text="Whether this is a stablecoin pool",
    )
    il_risk = models.CharField(
        max_length=20,
        default="none",
        help_text="Impermanent loss risk (none, low, medium, high)",
    )

    # On-chain vault / deposit token address (resolved from protocol APIs)
    contract_address = models.CharField(
        max_length=42,
        null=True,
        blank=True,
        db_index=True,
        help_text="Vault or deposit token address for LI.FI (e.g. aUSDC, Morpho vault, Euler vault)",
    )

    # Additional metadata
    pool_meta = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional pool metadata from DeFiLlama",
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Yield Pool"
        verbose_name_plural = "Yield Pools"
        ordering = ["-apy"]
        indexes = [
            models.Index(fields=["chain", "project"]),
            models.Index(fields=["apy"]),
            models.Index(fields=["chain_id"]),
            models.Index(fields=["risk_score"]),
        ]

    def __str__(self) -> str:
        return f"{self.symbol} on {self.project} ({self.chain}) - {self.apy}% APY"

    @property
    def chain_name(self) -> str:
        """Get human-readable chain name."""
        from config.chains import CHAIN_ID_TO_NAME

        return CHAIN_ID_TO_NAME.get(self.chain_id, self.chain)

    @property
    def risk_level(self) -> str:
        """Get risk level from score."""
        if self.risk_score <= 3:
            return "low"
        elif self.risk_score <= 6:
            return "medium"
        else:
            return "high"
