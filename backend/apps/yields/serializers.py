"""
Serializers for yields app.
"""

from rest_framework import serializers
from .models import YieldPool


class YieldPoolSerializer(serializers.ModelSerializer):
    """Serializer for YieldPool model."""

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
            "updated_at",
        ]


class YieldPoolDetailSerializer(YieldPoolSerializer):
    """Detailed serializer for YieldPool including metadata."""

    class Meta(YieldPoolSerializer.Meta):
        fields = YieldPoolSerializer.Meta.fields + ["pool_meta"]
