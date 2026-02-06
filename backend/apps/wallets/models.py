"""
Wallet and authentication models for ZeusFi.

No traditional AUTH_USER_MODEL - wallet address is the primary identifier.
"""

import secrets
from datetime import timedelta
from django.db import models
from django.utils import timezone


class Wallet(models.Model):
    """
    Main user identity - identified by Ethereum wallet address.

    ENS preferences are cached from ENS text records and updated periodically.
    """

    address = models.CharField(
        max_length=42,
        primary_key=True,
        help_text="Ethereum wallet address (0x...)",
    )
    ens_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Primary ENS name for this wallet",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    # ENS preferences (cached from ENS text records)
    ens_min_apy = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Minimum APY preference (e.g., 5.00 for 5%)",
    )
    ens_max_risk = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        help_text="Maximum risk level: low, medium, high",
    )
    ens_chains = models.JSONField(
        default=list,
        blank=True,
        help_text='Allowed chains: ["base", "arbitrum", "avalanche"]',
    )
    ens_protocols = models.JSONField(
        default=list,
        blank=True,
        help_text='Allowed protocols: ["aave", "morpho", "euler"]',
    )
    ens_auto_rebalance = models.BooleanField(
        default=False,
        help_text="Whether to auto-rebalance positions",
    )
    ens_updated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last time ENS preferences were fetched",
    )

    class Meta:
        verbose_name = "Wallet"
        verbose_name_plural = "Wallets"

    @property
    def is_authenticated(self) -> bool:
        """Required by DRF's IsAuthenticated permission."""
        return True

    @property
    def is_anonymous(self) -> bool:
        """Required by DRF for user checks."""
        return False

    def __str__(self) -> str:
        if self.ens_name:
            return f"{self.ens_name} ({self.address[:8]}...)"
        return f"{self.address[:8]}...{self.address[-4:]}"

    def save(self, *args, **kwargs):
        # Normalize address to lowercase
        self.address = self.address.lower()
        super().save(*args, **kwargs)


class Vault(models.Model):
    """
    User's vault on a specific chain.

    Each user can have one vault per chain. Vaults are deployed via VaultFactory
    smart contract when user first deposits on that chain.
    """

    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.CASCADE,
        related_name="vaults",
    )
    chain_id = models.IntegerField(
        help_text="Chain ID (8453=Base, 42161=Arbitrum, 43114=Avalanche)",
    )
    vault_address = models.CharField(
        max_length=42,
        help_text="Vault contract address on this chain",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this vault is active (false after cross-chain migration)",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["wallet", "chain_id", "vault_address"]
        verbose_name = "Vault"
        verbose_name_plural = "Vaults"

    def __str__(self) -> str:
        return f"Vault {self.vault_address[:8]}... on chain {self.chain_id}"

    def save(self, *args, **kwargs):
        # Normalize address to lowercase
        self.vault_address = self.vault_address.lower()
        super().save(*args, **kwargs)


class AuthNonce(models.Model):
    """
    Nonce for SIWE (Sign-In with Ethereum) authentication.

    Flow:
    1. Frontend requests nonce for wallet address
    2. Nonce is stored with expiry (5 minutes)
    3. User signs SIWE message containing nonce
    4. Backend verifies signature and marks nonce as used
    5. JWT token is issued
    """

    nonce = models.CharField(
        max_length=32,
        unique=True,
        help_text="Random nonce for SIWE message",
    )
    wallet_address = models.CharField(
        max_length=42,
        help_text="Wallet address requesting authentication",
    )
    expires_at = models.DateTimeField(
        help_text="Nonce expiry time",
    )
    used = models.BooleanField(
        default=False,
        help_text="Whether this nonce has been used",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Auth Nonce"
        verbose_name_plural = "Auth Nonces"
        indexes = [
            models.Index(fields=["wallet_address", "nonce"]),
            models.Index(fields=["expires_at"]),
        ]

    def __str__(self) -> str:
        return f"Nonce for {self.wallet_address[:8]}... (used={self.used})"

    @classmethod
    def generate(cls, wallet_address: str, expiry_minutes: int = 5) -> "AuthNonce":
        """Generate a new nonce for SIWE authentication."""
        nonce = secrets.token_hex(16)
        expires_at = timezone.now() + timedelta(minutes=expiry_minutes)
        return cls.objects.create(
            nonce=nonce,
            wallet_address=wallet_address.lower(),
            expires_at=expires_at,
        )

    @property
    def is_valid(self) -> bool:
        """Check if nonce is still valid (not expired and not used)."""
        return not self.used and timezone.now() < self.expires_at

    def mark_used(self) -> None:
        """Mark nonce as used."""
        self.used = True
        self.save(update_fields=["used"])
