"""
Admin configuration for wallets app.
"""

from django.contrib import admin
from .models import Wallet, Vault, AuthNonce


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = [
        "address",
        "ens_name",
        "ens_auto_rebalance",
        "ens_updated_at",
        "created_at",
    ]
    list_filter = ["ens_auto_rebalance", "created_at"]
    search_fields = ["address", "ens_name"]
    readonly_fields = ["address", "created_at"]


@admin.register(Vault)
class VaultAdmin(admin.ModelAdmin):
    list_display = [
        "vault_address",
        "wallet",
        "chain_id",
        "is_active",
        "created_at",
    ]
    list_filter = ["chain_id", "is_active", "created_at"]
    search_fields = ["vault_address", "wallet__address"]
    readonly_fields = ["created_at"]


@admin.register(AuthNonce)
class AuthNonceAdmin(admin.ModelAdmin):
    list_display = [
        "nonce",
        "wallet_address",
        "used",
        "expires_at",
        "created_at",
    ]
    list_filter = ["used", "created_at"]
    search_fields = ["nonce", "wallet_address"]
    readonly_fields = ["nonce", "created_at"]
