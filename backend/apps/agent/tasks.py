"""
Celery tasks for the agent app.

Main task: run_agent_cycle — daily scan of all wallets with vaults,
decide whether to deploy idle USDC or rebalance positions.
"""

import asyncio
import logging
from decimal import Decimal

from celery import shared_task
from core.settings import env_config
from django.utils import timezone

from parameters.common.logger.logger_service import LoggerService

logger = logging.getLogger(__name__)


@shared_task(name="apps.agent.tasks.monitor_pending_transactions")
def monitor_pending_transactions() -> dict:
    """Check pending/submitted agent TXs and update their status."""
    from apps.agent.monitor import check_pending_transactions

    logger.info("monitor_pending_transactions: Starting pending TX check")
    try:
        result = asyncio.run(check_pending_transactions())
    except Exception as e:
        logger.error(
            "monitor_pending_transactions: Task failed",
            exc_info=True,
            extra={"error": str(e)},
        )
        LoggerService.create__manual_logg(
            "500",
            "tasks/monitor_pending_transactions",
            "TASK",
            str({"timestamp": timezone.now().isoformat()}),
            str({"error": str(e)}),
        )
        raise Exception(f"monitor_pending_transactions: Task failed: {e}")

    LoggerService.create__manual_logg(
        "200",
        "tasks/monitor_pending_transactions",
        "TASK",
        str({"timestamp": timezone.now().isoformat()}),
        str(result),
    )
    logger.info(f"monitor_pending_transactions: Complete - {result}")
    return result


@shared_task(name="apps.agent.tasks.run_agent_cycle")
def run_agent_cycle(wallet_address: str | None = None) -> dict:
    """
    Main agent cycle: check positions, find best pools, deploy/rebalance.

    Args:
        wallet_address: If provided, only process this wallet (manual trigger).
                       If None, process all wallets with active vaults.

    Returns:
        Summary dict with actions taken.
    """
    logger.info(f"run_agent_cycle: Starting (wallet={wallet_address or 'ALL'})")
    try:
        result = asyncio.run(_run_agent_cycle_async(wallet_address))
    except Exception as e:
        logger.error(
            "run_agent_cycle: Task failed",
            exc_info=True,
            extra={"error": str(e), "wallet_address": wallet_address},
        )
        LoggerService.create__manual_logg(
            "500",
            "tasks/run_agent_cycle",
            "TASK",
            str(
                {
                    "wallet_address": wallet_address or "ALL",
                    "timestamp": timezone.now().isoformat(),
                }
            ),
            str({"error": str(e)}),
        )
        raise Exception(f"run_agent_cycle: Task failed: {e}")

    LoggerService.create__manual_logg(
        "200",
        "tasks/run_agent_cycle",
        "TASK",
        str(
            {
                "wallet_address": wallet_address or "ALL",
                "timestamp": timezone.now().isoformat(),
            }
        ),
        str(result),
    )
    logger.info(f"run_agent_cycle: Complete - {result}")
    return result


async def _run_agent_cycle_async(wallet_address: str | None = None) -> dict:
    """Async implementation of the agent cycle."""
    from apps.wallets.models import Wallet
    from apps.yields.models import YieldPool
    from apps.agent.executor import VaultExecutor
    from integrations.contracts.reader import ContractReader

    dry_run = env_config("AGENT_DRY_RUN", default="FALSE").upper() == "TRUE"
    if dry_run:
        logger.info("AGENT DRY RUN MODE — will log decisions but skip execution")

    # Get wallets to process
    if wallet_address:
        wallets = await asyncio.to_thread(
            lambda: list(Wallet.objects.filter(address=wallet_address.lower()))
        )
    else:
        # All wallets that have at least one active vault
        wallets = await asyncio.to_thread(
            lambda: list(Wallet.objects.filter(vaults__is_active=True).distinct())
        )

    if not wallets:
        logger.info("run_agent_cycle: No wallets with active vaults found")
        return {"wallets_processed": 0, "actions": []}

    # Fetch all USDC yield pools
    pools = await asyncio.to_thread(
        lambda: list(
            YieldPool.objects.filter(symbol__icontains="USDC").order_by("-apy")
        )
    )

    if not pools:
        logger.warning("run_agent_cycle: No USDC pools available")
        return {"wallets_processed": len(wallets), "actions": []}

    reader = ContractReader()
    executor = VaultExecutor()
    actions = []

    for wallet in wallets:
        try:
            action = await _process_wallet(wallet, pools, reader, executor, dry_run)
            if action:
                actions.append(action)
        except Exception as e:
            logger.error(
                f"run_agent_cycle: Error processing wallet {wallet.address[:8]}: {e}",
                exc_info=True,
            )
            actions.append(
                {
                    "wallet": wallet.address,
                    "action": "error",
                    "error": str(e),
                }
            )

    summary = {
        "wallets_processed": len(wallets),
        "actions": actions,
        "dry_run": dry_run,
    }
    logger.info(f"run_agent_cycle: Complete — {summary}")
    return summary


async def _process_wallet(
    wallet,
    pools,
    reader,
    executor,
    dry_run: bool,
) -> dict | None:
    """Process a single wallet: read positions, decide, execute."""
    from apps.wallets.models import Vault
    from apps.positions.models import RebalanceHistory
    from apps.agent.engine import find_best_pool, should_rebalance
    from apps.agent.executor import VaultExecutionError
    from apps.agent.gas import estimate_rebalance_gas_cost

    # Get vault addresses for all chains
    vaults = await asyncio.to_thread(
        lambda: list(Vault.objects.filter(wallet=wallet, is_active=True))
    )

    if not vaults:
        return None

    vault_map = {v.chain_id: v.vault_address for v in vaults}

    # Get all known protocol vault addresses from DB
    from apps.positions.views import PositionsView
    protocol_vaults = await asyncio.to_thread(PositionsView._get_protocol_vaults)

    # Read positions across all chains
    positions = await reader.get_positions_all_chains(vault_map, protocol_vaults)
    position_dicts = [p.to_dict() for p in positions]

    if not position_dicts:
        logger.info(f"Wallet {wallet.address[:8]}: No positions, skipping")
        return None

    # Find best pool for this wallet
    best_pool = find_best_pool(pools, wallet)
    if not best_pool:
        return {"wallet": wallet.address, "action": "no_suitable_pool"}

    # Estimate gas cost for potential rebalance
    # Determine if cross-chain by comparing current position chain to best pool chain
    deployed = [p for p in position_dicts if p["protocol"] != "wallet"]
    is_cross_chain = any(p["chain_id"] != best_pool.chain_id for p in deployed)
    gas_cost_usd = await estimate_rebalance_gas_cost(
        best_pool.chain_id, is_cross_chain=is_cross_chain
    )

    # Decide if we should rebalance (sync ORM inside, must run in thread)
    should_move, reasoning = await asyncio.to_thread(
        should_rebalance, position_dicts, best_pool, wallet, gas_cost_usd=gas_cost_usd
    )

    logger.info(
        f"Wallet {wallet.address[:8]}: should_move={should_move}, reasoning={reasoning}"
    )

    if not should_move:
        return {
            "wallet": wallet.address,
            "action": "hold",
            "reasoning": reasoning,
        }

    # --- Execute the move ---

    # Find which vault/chain to act on
    idle_positions = [p for p in position_dicts if p["protocol"] == "wallet"]
    deployed_positions = [p for p in position_dicts if p["protocol"] != "wallet"]

    if idle_positions:
        # Deploy idle USDC to best pool
        target_pos = idle_positions[0]
        target_chain = target_pos["chain_id"]
        target_vault_addr = vault_map.get(target_chain)
        amount = Decimal(target_pos["amount"])
        amount_wei = int(amount * Decimal(10**6))

        # Create history record
        rebalance = await asyncio.to_thread(
            lambda: RebalanceHistory.objects.create(
                wallet=wallet,
                from_chain_id=target_chain,
                from_protocol="wallet",
                from_token="USDC",
                from_vault=next(
                    (v for v in vaults if v.chain_id == target_chain), None
                ),
                to_chain_id=best_pool.chain_id,
                to_protocol=best_pool.project,
                to_token="USDC",
                to_vault=next(
                    (v for v in vaults if v.chain_id == best_pool.chain_id), None
                ),
                amount=amount,
                amount_usd=amount,
                to_apy=best_pool.apy,
                agent_reasoning=reasoning,
                status=RebalanceHistory.Status.PENDING,
            )
        )

        if dry_run:
            logger.info(
                f"DRY RUN: Would deploy {amount} USDC to "
                f"{best_pool.project} on chain {best_pool.chain_id}"
            )
            return {
                "wallet": wallet.address,
                "action": "deploy (dry_run)",
                "amount": str(amount),
                "protocol": best_pool.project,
                "chain_id": best_pool.chain_id,
                "reasoning": reasoning,
            }

        try:
            tx_hash = await executor.deploy_to_protocol(
                vault_address=target_vault_addr,
                chain_id=target_chain,
                protocol=best_pool.project,
                amount_wei=amount_wei,
                deposit_token=best_pool.contract_address,
            )
            await asyncio.to_thread(rebalance.mark_submitted, tx_hash)
            await asyncio.to_thread(rebalance.mark_success)
            return {
                "wallet": wallet.address,
                "action": "deployed",
                "tx_hash": tx_hash,
                "amount": str(amount),
                "protocol": best_pool.project,
                "chain_id": best_pool.chain_id,
            }
        except Exception as e:
            await asyncio.to_thread(rebalance.mark_failed, str(e))
            raise

    elif deployed_positions:
        # Rebalance from current protocol to best pool
        current = deployed_positions[0]
        from_chain = current["chain_id"]
        from_vault_addr = vault_map.get(from_chain)
        amount = Decimal(current["amount"])
        amount_wei = int(amount * Decimal(10**6))

        current_pool = await asyncio.to_thread(
            lambda: next(
                (
                    p
                    for p in pools
                    if p.project == current["protocol"]
                    and p.chain_id == from_chain
                    and p.contract_address
                ),
                next(
                    (
                        p
                        for p in pools
                        if p.project == current["protocol"] and p.chain_id == from_chain
                    ),
                    pools[0],
                ),
            )
        )

        rebalance = await asyncio.to_thread(
            lambda: RebalanceHistory.objects.create(
                wallet=wallet,
                from_chain_id=from_chain,
                from_protocol=current["protocol"],
                from_token="USDC",
                from_vault=next((v for v in vaults if v.chain_id == from_chain), None),
                to_chain_id=best_pool.chain_id,
                to_protocol=best_pool.project,
                to_token="USDC",
                to_vault=next(
                    (v for v in vaults if v.chain_id == best_pool.chain_id), None
                ),
                amount=amount,
                amount_usd=amount,
                from_apy=getattr(current_pool, "apy", None),
                to_apy=best_pool.apy,
                agent_reasoning=reasoning,
                status=RebalanceHistory.Status.PENDING,
            )
        )

        if dry_run:
            logger.info(
                f"DRY RUN: Would rebalance {amount} USDC from "
                f"{current['protocol']}@{from_chain} to "
                f"{best_pool.project}@{best_pool.chain_id}"
            )
            return {
                "wallet": wallet.address,
                "action": "rebalance (dry_run)",
                "amount": str(amount),
                "from_protocol": current["protocol"],
                "to_protocol": best_pool.project,
                "reasoning": reasoning,
            }

        try:
            tx_hash = await executor.rebalance(
                from_vault=from_vault_addr,
                from_chain=from_chain,
                from_protocol=current["protocol"],
                to_chain=best_pool.chain_id,
                to_protocol=best_pool.project,
                amount_wei=amount_wei,
                from_deposit_token=getattr(current_pool, "contract_address", None),
                to_deposit_token=best_pool.contract_address,
            )
            await asyncio.to_thread(rebalance.mark_submitted, tx_hash)
            await asyncio.to_thread(rebalance.mark_success)
            return {
                "wallet": wallet.address,
                "action": "rebalanced",
                "tx_hash": tx_hash,
                "amount": str(amount),
                "from_protocol": current["protocol"],
                "to_protocol": best_pool.project,
            }
        except Exception as e:
            await asyncio.to_thread(rebalance.mark_failed, str(e))
            raise

    return None
