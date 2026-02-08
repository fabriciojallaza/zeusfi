"""
Views for agent API endpoints.

POST /api/v1/agent/trigger/      — Async trigger (Celery) for agent cycle
GET  /api/v1/agent/status/       — Last run, next scheduled, recent actions, pending TXs
POST /api/v1/agent/test-rebalance/ — Synchronous test: runs full cycle inline, returns result
"""

import asyncio
import logging

from rest_framework import status
from rest_framework.exceptions import APIException
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

        result = run_agent_cycle(wallet_address)

        # Check if any wallet action errored
        actions = result.get("actions", [])
        errors = [a for a in actions if a.get("action") == "error"]
        if errors:
            error_msgs = [e.get("error", "Unknown") for e in errors]
            raise APIException(f"Agent cycle failed: {'; '.join(error_msgs)}")

        return Response(
            {
                "status": "completed",
                "wallets_processed": result.get("wallets_processed", 0),
                "actions": actions,
            },
            status=status.HTTP_200_OK,
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
        from core.settings import env_config

        return env_config("AGENT_DRY_RUN", default="FALSE").upper() == "TRUE"


class AgentUnwindView(APIView):
    """
    POST /api/v1/agent/unwind/

    Unwind all protocol positions back to USDC in vault.
    Agent wallet pays gas. After unwind, user can call vault.withdraw().

    Returns list of tx hashes (one per protocol position unwound).
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        result = asyncio.run(self._unwind(request.user.address))
        http_status = (
            status.HTTP_200_OK if "error" not in result else status.HTTP_400_BAD_REQUEST
        )
        return Response(result, status=http_status)

    async def _unwind(self, wallet_address: str) -> dict:
        from apps.wallets.models import Wallet, Vault
        from apps.positions.models import RebalanceHistory
        from apps.yields.models import YieldPool
        from apps.agent.executor import VaultExecutor, VaultExecutionError
        from config.protocols import get_deposit_token
        from integrations.contracts.abis import ERC20_ABI

        # 1. Load wallet + vaults from DB (fast)
        wallet = await asyncio.to_thread(
            lambda: Wallet.objects.filter(address=wallet_address.lower()).first()
        )
        if not wallet:
            return {"error": "Wallet not found"}

        vaults = await asyncio.to_thread(
            lambda: list(Vault.objects.filter(wallet=wallet, is_active=True))
        )
        vault_map = {v.chain_id: v.vault_address for v in vaults}

        if not vault_map:
            return {"error": "No active vaults"}

        # 2. Find latest successful deployment from DB (no RPC needed)
        last_deployment = await asyncio.to_thread(
            lambda: RebalanceHistory.objects.filter(
                wallet=wallet,
                status=RebalanceHistory.Status.SUCCESS,
            )
            .exclude(to_protocol="wallet")
            .order_by("-completed_at")
            .first()
        )

        if not last_deployment:
            # Never deployed to a protocol — USDC is in vault or nowhere
            return {
                "status": "already_idle",
                "vault_usdc_balance": 0,
                "tx_hashes": [],
            }

        chain_id = last_deployment.to_chain_id
        protocol = last_deployment.to_protocol
        vault_addr = vault_map.get(chain_id)

        if not vault_addr:
            return {"error": f"No active vault on chain {chain_id}"}

        # 3. Get deposit token from YieldPool DB (no RPC needed)
        pool = await asyncio.to_thread(
            lambda: YieldPool.objects.filter(
                project=protocol,
                chain_id=chain_id,
                contract_address__isnull=False,
                symbol__icontains="USDC",
            ).first()
        )
        deposit_token = pool.contract_address if pool else None
        if not deposit_token:
            deposit_token = get_deposit_token(protocol, chain_id)
        if not deposit_token:
            return {"error": f"No deposit token for {protocol} on chain {chain_id}"}

        # 4. Single RPC call: check if vault holds any shares/tokens
        executor = VaultExecutor()
        w3 = executor._get_web3(chain_id)

        token_contract = w3.eth.contract(
            address=w3.to_checksum_address(deposit_token),
            abi=ERC20_ABI,
        )
        share_balance = await token_contract.functions.balanceOf(
            w3.to_checksum_address(vault_addr)
        ).call()

        if share_balance == 0:
            # Already unwound — check vault USDC balance (1 more RPC)
            usdc_balance = await executor.get_vault_balance(vault_addr, chain_id)
            total_usdc = usdc_balance / 10**6
            if total_usdc < 0.01:
                return {
                    "status": "no_funds",
                    "vault_usdc_balance": total_usdc,
                    "tx_hashes": [],
                    "message": "No funds found in vault or protocols.",
                }
            return {
                "status": "already_idle",
                "vault_usdc_balance": total_usdc,
                "tx_hashes": [],
            }

        # 5. Execute unwind (the only expensive step — unavoidable on-chain tx)
        try:
            tx_hash = await executor.unwind_position(
                vault_address=vault_addr,
                chain_id=chain_id,
                protocol=protocol,
                amount_wei=share_balance,  # Used for Aave LI.FI quote; Morpho/Euler use shares=0
                deposit_token=deposit_token,
            )
            logger.info(f"Unwound {protocol} on chain {chain_id}: {tx_hash}")
            return {
                "status": "unwound",
                "tx_hashes": [tx_hash],
                "errors": None,
            }
        except VaultExecutionError as e:
            logger.error(f"Unwind failed: {e}")
            return {
                "status": "failed",
                "tx_hashes": [],
                "errors": [str(e)],
            }


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

        result = asyncio.run(self._run_test_cycle(wallet_address, dry_run, force))
        return Response(result)

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

        # 3. Read on-chain positions (with dynamic vault discovery from DB)
        from apps.positions.views import PositionsView

        protocol_vaults = await asyncio.to_thread(PositionsView._get_protocol_vaults)
        reader = ContractReader()
        positions = await reader.get_positions_all_chains(vault_map, protocol_vaults)
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
        is_cross_chain = any(p["chain_id"] != best_pool.chain_id for p in deployed)
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
                "DRY RUN — would execute rebalance. Set dry_run=false to run for real."
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
                    deposit_token=best_pool.contract_address,
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
