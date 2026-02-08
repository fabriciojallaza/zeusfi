"""
Serializers for yields app.
"""

from rest_framework import serializers
from .models import YieldPool


class YieldPoolSerializer(serializers.ModelSerializer):
    """Full serializer for YieldPool model."""

    chain_name = serializers.CharField(read_only=True)
    risk_level = serializers.CharField(read_only=True)

    class Meta:
        model = YieldPool
        fields = [
            "pool_id",
            "chain",
            "chain_id",
            "chain_name",
            "project",
            "symbol",
            "tvl_usd",
            "apy",
            "apy_base",
            "apy_reward",
            "risk_score",
            "risk_level",
            "stable_coin",
            "il_risk",
            "contract_address",
            "pool_meta",
            "updated_at",
        ]
