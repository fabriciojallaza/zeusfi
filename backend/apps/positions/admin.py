"""
Admin configuration for positions app.
"""

from django.contrib import admin
from .models import Position, RebalanceHistory


@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = [
        "vault",
        "chain_id",
        "protocol",
        "token",
        "amount",
        "amount_usd",
        "current_apy",
        "updated_at",
    ]
    list_filter = ["chain_id", "protocol", "token"]
    search_fields = ["vault__vault_address", "vault__wallet__address"]
    readonly_fields = ["updated_at", "created_at"]


@admin.register(RebalanceHistory)
class RebalanceHistoryAdmin(admin.ModelAdmin):
    list_display = [
        "wallet",
        "from_chain_id",
        "from_protocol",
        "to_chain_id",
        "to_protocol",
        "amount_usd",
        "status",
        "created_at",
    ]
    list_filter = ["status", "from_chain_id", "to_chain_id", "from_protocol", "to_protocol"]
    search_fields = ["wallet__address", "tx_hash"]
    readonly_fields = ["created_at", "completed_at"]
