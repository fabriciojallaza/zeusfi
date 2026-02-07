"""
Views for agent API endpoints.

POST /api/v1/agent/trigger/      — Async trigger (Celery) for agent cycle
GET  /api/v1/agent/status/       — Last run, next scheduled, recent actions, pending TXs
POST /api/v1/agent/test-rebalance/ — Synchronous test: runs full cycle inline, returns result
"""

import asyncio
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

    Returns last run info, recent rebalance actions, pending TX count,
    and estimated gas costs for the authenticated wallet.
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

        # Pending/submitted transactions
        pending_count = RebalanceHistory.objects.filter(
            wallet=wallet,
            status__in=[
                RebalanceHistory.Status.PENDING,
                RebalanceHistory.Status.SUBMITTED,
            ],
        ).count()

        # Estimate gas costs for each supported chain
        gas_estimates = self._get_gas_estimates()

        return Response(
            {
                "last_run": last_completed.completed_at.isoformat()
                if last_completed and last_completed.completed_at
                else None,
                "next_scheduled": "Daily at 06:00 UTC",
                "recent_actions": recent_actions,
                "pending_transactions": pending_count,
                "gas_estimates": gas_estimates,
                "dry_run": self._is_dry_run(),
            }
        )

    def _get_gas_estimates(self) -> dict[str, float]:
        """Fetch gas cost estimates for each supported chain."""
        from apps.agent.gas import estimate_rebalance_gas_cost
        from config.chains import SUPPORTED_CHAINS

        estimates = {}
        try:
            for chain_id, config in SUPPORTED_CHAINS.items():
                cost = asyncio.run(estimate_rebalance_gas_cost(chain_id))
                estimates[config["name"]] = round(cost, 4)
        except Exception as e:
            logger.warning(f"Failed to fetch gas estimates: {e}")
        return estimates

    def _is_dry_run(self) -> bool:
        from decouple import config

        return config("AGENT_DRY_RUN", default="FALSE").upper() == "TRUE"


class AgentTestRebalanceView(APIView):
    """
    POST /api/v1/agent/test-rebalance/

    Runs the full agent cycle **synchronously** for the authenticated wallet
    and returns the complete result inline. For manual testing — no Celery needed.

    Body params:
        dry_run (bool, optional): Force dry run regardless of env. Default true.
        force (bool, optional): Skip should_rebalance check — always execute. Default false.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        dry_run = request.data.get("dry_run", True)
        force = request.data.get("force", False)
        wallet_address = request.user.address

        try:
            result = asyncio.run(
                self._run_test_cycle(wallet_address, dry_run, force)
            )
            return Response(result)
        except Exception as e:
            logger.error(f"test-rebalance failed: {e}", exc_info=True)
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    async def _run_test_cycle(
        self, wallet_address: str, dry_run: bool, force: bool
    ) -> dict:
        from apps.wallets.models import Wallet, Vault
        from apps.yields.models import YieldPool
        from apps.agent.engine import find_best_pool, should_rebalance
        from apps.agent.gas import estimate_rebalance_gas_cost
        from apps.agent.executor import VaultExecutor
        from integrations.contracts.reader import ContractReader

        # 1. Load wallet
        wallet = await asyncio.to_thread(
            lambda: Wallet.objects.filter(address=wallet_address.lower()).first()
        )
        if not wallet:
            return {"error": "Wallet not found"}

        # 2. Load vaults
        vaults = await asyncio.to_thread(
            lambda: list(Vault.objects.filter(wallet=wallet, is_active=True))
        )
        vault_map = {v.chain_id: v.vault_address for v in vaults}

        if not vaults:
            return {
                "wallet": wallet_address,
                "step": "vaults",
                "result": "No active vaults found",
            }

        # 3. Read on-chain positions
        reader = ContractReader()
        positions = await reader.get_positions_all_chains(vault_map)
        position_dicts = [p.to_dict() for p in positions]

        if not position_dicts:
            return {
                "wallet": wallet_address,
                "step": "positions",
                "result": "No positions (no USDC in any vault)",
                "vaults": vault_map,
            }

        # 4. Fetch best pool
        pools = await asyncio.to_thread(
            lambda: list(
                YieldPool.objects.filter(symbol__icontains="USDC").order_by("-apy")
            )
        )

        best_pool = find_best_pool(pools, wallet) if pools else None

        if not best_pool:
            return {
                "wallet": wallet_address,
                "step": "find_best_pool",
                "result": "No suitable pool found",
                "pools_count": len(pools),
                "positions": position_dicts,
            }

        # 5. Gas estimation
        deployed = [p for p in position_dicts if p["protocol"] != "wallet"]
        is_cross_chain = any(
            p["chain_id"] != best_pool.chain_id for p in deployed
        )
        gas_cost_usd = await estimate_rebalance_gas_cost(
            best_pool.chain_id, is_cross_chain=is_cross_chain
        )

        # 6. Should rebalance?
        should_move, reasoning = should_rebalance(
            position_dicts, best_pool, wallet, gas_cost_usd=gas_cost_usd
        )

        decision = {
            "wallet": wallet_address,
            "best_pool": {
                "pool_id": best_pool.pool_id,
                "project": best_pool.project,
                "chain": best_pool.chain,
                "chain_id": best_pool.chain_id,
                "apy": str(best_pool.apy),
            },
            "positions": position_dicts,
            "gas_cost_usd": round(gas_cost_usd, 6),
            "is_cross_chain": is_cross_chain,
            "should_rebalance": should_move,
            "reasoning": reasoning,
            "dry_run": dry_run,
            "force": force,
        }

        if not should_move and not force:
            decision["step"] = "decision"
            decision["result"] = "Hold — rebalance not justified"
            return decision

        # 7. Execute (or dry-run)
        if dry_run:
            decision["step"] = "execute"
            decision["result"] = (
                "DRY RUN — would execute rebalance. "
                "Set dry_run=false to run for real."
            )
            return decision

        # Real execution
        executor = VaultExecutor()
        idle = [p for p in position_dicts if p["protocol"] == "wallet"]

        if idle:
            target = idle[0]
            vault_addr = vault_map.get(target["chain_id"])
            from decimal import Decimal

            amount = Decimal(target["amount"])
            amount_wei = int(amount * Decimal(10**6))

            # Create history record
            rebalance = await asyncio.to_thread(
                lambda: RebalanceHistory.objects.create(
                    wallet=wallet,
                    from_chain_id=target["chain_id"],
                    from_protocol="wallet",
                    from_token="USDC",
                    from_vault=next(
                        (v for v in vaults if v.chain_id == target["chain_id"]),
                        None,
                    ),
                    to_chain_id=best_pool.chain_id,
                    to_protocol=best_pool.project,
                    to_token="USDC",
                    to_vault=next(
                        (v for v in vaults if v.chain_id == best_pool.chain_id),
                        None,
                    ),
                    amount=amount,
                    amount_usd=amount,
                    to_apy=best_pool.apy,
                    agent_reasoning=reasoning,
                    status=RebalanceHistory.Status.PENDING,
                )
            )

            try:
                tx_hash = await executor.deploy_to_protocol(
                    vault_address=vault_addr,
                    chain_id=target["chain_id"],
                    protocol=best_pool.project,
                    amount_wei=amount_wei,
                )
                await asyncio.to_thread(rebalance.mark_submitted, tx_hash)
                decision["step"] = "execute"
                decision["result"] = "Deployed"
                decision["tx_hash"] = tx_hash
                decision["amount"] = str(amount)
            except Exception as e:
                await asyncio.to_thread(rebalance.mark_failed, str(e))
                decision["step"] = "execute"
                decision["result"] = f"Execution failed: {e}"
        else:
            decision["step"] = "execute"
            decision["result"] = (
                "No idle USDC to deploy. Full rebalance (withdraw + redeploy) "
                "not yet implemented in test endpoint."
            )

        return decision
