"""
Admin configuration for yields app.
"""

from django.contrib import admin
from .models import YieldPool


@admin.register(YieldPool)
class YieldPoolAdmin(admin.ModelAdmin):
    list_display = [
        "pool_id",
        "chain",
        "project",
        "symbol",
        "apy",
        "tvl_usd",
        "risk_score",
        "updated_at",
    ]
    list_filter = ["chain", "project", "risk_score"]
    search_fields = ["pool_id", "symbol", "project"]
    readonly_fields = ["pool_id", "updated_at"]
    ordering = ["-apy"]
