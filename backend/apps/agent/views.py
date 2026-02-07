"""
Views for agent API endpoints.

POST /api/v1/agent/trigger/ — Manual trigger for agent cycle
GET  /api/v1/agent/status/  — Last run, next scheduled, recent actions
"""

import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.wallets.authentication import JWTAuthentication
from apps.positions.models import RebalanceHistory

logger = logging.getLogger(__name__)


class AgentTriggerView(APIView):
    """
    POST /api/v1/agent/trigger/

    Manually trigger the agent cycle for the authenticated wallet.
    Dispatches a Celery task and returns the task ID.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        from apps.agent.tasks import run_agent_cycle

        wallet_address = request.data.get("wallet_address") or request.user.address

        result = run_agent_cycle.delay(wallet_address)

        return Response(
            {"task_id": str(result.id), "status": "queued"},
            status=status.HTTP_202_ACCEPTED,
        )


class AgentStatusView(APIView):
    """
    GET /api/v1/agent/status/

    Returns last run info and recent rebalance actions for the authenticated wallet.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        wallet = request.user

        # Recent rebalance history for this wallet
        recent = RebalanceHistory.objects.filter(wallet=wallet).order_by("-created_at")[
            :10
        ]

        recent_actions = [
            {
                "id": r.id,
                "from_protocol": r.from_protocol,
                "from_chain_id": r.from_chain_id,
                "to_protocol": r.to_protocol,
                "to_chain_id": r.to_chain_id,
                "amount": str(r.amount),
                "status": r.status,
                "agent_reasoning": r.agent_reasoning,
                "tx_hash": r.tx_hash,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in recent
        ]

        # Last completed run
        last_completed = (
            RebalanceHistory.objects.filter(
                wallet=wallet, status__in=["success", "failed"]
            )
            .order_by("-completed_at")
            .first()
        )

        return Response(
            {
                "last_run": last_completed.completed_at.isoformat()
                if last_completed and last_completed.completed_at
                else None,
                "next_scheduled": "Daily at 06:00 UTC",
                "recent_actions": recent_actions,
            }
        )
