"""Serializers for agent API endpoints."""

from rest_framework import serializers


class AgentTriggerSerializer(serializers.Serializer):
    wallet_address = serializers.CharField(
        required=False,
        max_length=42,
        help_text="Wallet address to process. If omitted, processes authenticated wallet.",
    )


class AgentTriggerResponseSerializer(serializers.Serializer):
    task_id = serializers.CharField()
    status = serializers.CharField()


class AgentStatusResponseSerializer(serializers.Serializer):
    last_run = serializers.DateTimeField(allow_null=True)
    next_scheduled = serializers.CharField()
    recent_actions = serializers.ListField(child=serializers.DictField())
