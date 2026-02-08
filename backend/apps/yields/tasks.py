"""
Celery tasks for yields app.
"""

import asyncio
import logging
from datetime import timedelta
from decimal import Decimal

from celery import shared_task
from django.db import models
from django.utils import timezone

from parameters.common.logger.logger_service import LoggerService

logger = logging.getLogger(__name__)


@shared_task(name="apps.yields.tasks.fetch_yields")
def fetch_yields() -> dict:
    """
    Fetch yield data from DeFiLlama and update database.

    Runs every 30 minutes via Celery beat.

    Returns:
        Dict with task results
    """
    from apps.yields.models import YieldPool
    from integrations.defillama.client import DeFiLlamaClient

    logger.info("fetch_yields: Starting yield data sync from DeFiLlama")

    # Step 1: Fetch data async
    async def fetch_pools():
        client = DeFiLlamaClient()
        async with client:
            return await client.get_filtered_pools()

    try:
        pools = asyncio.run(fetch_pools())
    except Exception as e:
        logger.error(
            "fetch_yields: Failed to fetch pools from DeFiLlama",
            exc_info=True,
            extra={"error": str(e)},
        )
        LoggerService.create__manual_logg(
            "500",
            "tasks/fetch_yields",
            "TASK",
            str({"timestamp": timezone.now().isoformat()}),
            str({"error": str(e)}),
        )
        raise Exception(f"fetch_yields: Failed to fetch pools from DeFiLlama: {e}")

    logger.info(f"fetch_yields: Fetched {len(pools)} filtered pools from DeFiLlama")

    # Step 2: Update database (sync)
    updated = 0
    created = 0
    errors = []

    for pool_data in pools:
        try:
            pool_id = pool_data.get("pool")
            if not pool_id:
                continue

            # Prepare data for model
            # NOTE: contract_address is NOT set here — it's resolved in Step 3
            # via protocol-native APIs (Morpho GraphQL, Euler Goldsky, Aave hardcoded)
            defaults = {
                "chain": pool_data.get("chain", "").lower(),
                "chain_id": pool_data.get("chain_id"),
                "project": pool_data.get("project", "").lower(),
                "symbol": pool_data.get("symbol", ""),
                "tvl_usd": Decimal(str(pool_data.get("tvlUsd", 0))),
                "apy": Decimal(str(pool_data.get("apy", 0))),
                "apy_base": Decimal(str(pool_data.get("apyBase", 0) or 0)),
                "apy_reward": Decimal(str(pool_data.get("apyReward", 0) or 0)),
                "risk_score": pool_data.get("risk_score", 5),
                "stable_coin": pool_data.get("stablecoin", True),
                "il_risk": pool_data.get("ilRisk", "none") or "none",
                "pool_meta": {
                    "exposure": pool_data.get("exposure"),
                    "underlyingTokens": pool_data.get("underlyingTokens"),
                    "rewardTokens": pool_data.get("rewardTokens"),
                    "pool": pool_data.get("pool"),
                    "poolMeta": pool_data.get("poolMeta"),
                },
            }

            pool, was_created = YieldPool.objects.update_or_create(
                pool_id=pool_id,
                defaults=defaults,
            )

            if was_created:
                created += 1
            else:
                updated += 1

        except Exception as e:
            errors.append(
                {
                    "pool_id": pool_data.get("pool"),
                    "project": pool_data.get("project"),
                    "chain": pool_data.get("chain"),
                    "error": str(e),
                }
            )
            logger.error(
                f"fetch_yields: Error processing pool {pool_data.get('pool')}",
                exc_info=True,
                extra={
                    "pool_id": pool_data.get("pool"),
                    "project": pool_data.get("project"),
                    "chain": pool_data.get("chain"),
                },
            )

    # Step 3: Resolve vault contract addresses via protocol-native APIs
    resolved_count = 0
    try:
        resolved_count += _resolve_aave_addresses()
    except Exception as e:
        logger.warning(
            f"fetch_yields: Aave address resolution failed: {e}", exc_info=True
        )
    try:
        resolved_count += _resolve_morpho_addresses()
    except Exception as e:
        logger.warning(
            f"fetch_yields: Morpho address resolution failed: {e}", exc_info=True
        )
    try:
        resolved_count += _resolve_euler_addresses()
    except Exception as e:
        logger.warning(
            f"fetch_yields: Euler address resolution failed: {e}", exc_info=True
        )

    # Step 4: Delete pools that couldn't get a contract address resolved
    # (useless to the agent — can't deposit without knowing the vault address)
    unresolvable = YieldPool.objects.filter(
        project__in=["morpho-v1", "euler-v2"],
    ).filter(models.Q(contract_address__isnull=True) | models.Q(contract_address=""))
    unresolvable_count = unresolvable.count()
    if unresolvable_count:
        logger.info(
            f"fetch_yields: Deleting {unresolvable_count} pool(s) "
            f"with no resolved contract address"
        )
        unresolvable.delete()

    # Clean up old pools that no longer exist
    # (pools not updated in the last 2 hours)
    cutoff = timezone.now() - timedelta(hours=2)
    deleted = YieldPool.objects.filter(updated_at__lt=cutoff).delete()[0]
    deleted += unresolvable_count

    result = {
        "created": created,
        "updated": updated,
        "deleted": deleted,
        "resolved": resolved_count,
        "errors": len(errors),
        "total_pools": YieldPool.objects.count(),
        "timestamp": timezone.now().isoformat(),
    }

    if errors:
        logger.error(
            f"fetch_yields: Completed with {len(errors)} error(s)",
            extra={"error_count": len(errors), "errors": errors, **result},
        )
        LoggerService.create__manual_logg(
            "500",
            "tasks/fetch_yields",
            "TASK",
            str({"pool_count": len(pools)}),
            str({"errors": errors}),
        )
        raise Exception(
            f"fetch_yields: Completed with {len(errors)} error(s). Details: {errors}"
        )

    LoggerService.create__manual_logg(
        "200",
        "tasks/fetch_yields",
        "TASK",
        str({"pool_count": len(pools)}),
        str(result),
    )
    logger.info(f"fetch_yields: Complete - {result}")
    return result


def _resolve_aave_addresses() -> int:
    """
    Resolve Aave deposit token (aUSDC) addresses from hardcoded config.

    Aave URLs point to USDC (underlying), not aUSDC (deposit token),
    so we override with the hardcoded aUSDC address per chain.

    Returns:
        Number of Aave pools updated.
    """
    from apps.yields.models import YieldPool
    from config.protocols import AAVE_AUSDC

    resolved = 0
    for chain_id, ausdc_address in AAVE_AUSDC.items():
        count = (
            YieldPool.objects.filter(
                project="aave-v3",
                chain_id=chain_id,
            )
            .exclude(
                contract_address=ausdc_address,
            )
            .update(contract_address=ausdc_address)
        )
        resolved += count

    if resolved:
        logger.info(f"_resolve_aave_addresses: Updated {resolved} Aave pools")
    return resolved


def _resolve_morpho_addresses() -> int:
    """
    Resolve Morpho vault addresses via their public GraphQL API.

    Matches DeFiLlama pools to Morpho vaults by (symbol, chain_id).
    When multiple Morpho vaults share the same symbol on a chain,
    picks the one whose TVL is closest to DeFiLlama's tvl_usd.

    Returns:
        Number of Morpho pools updated.
    """
    from apps.yields.models import YieldPool
    from integrations.defillama.vault_resolver import fetch_morpho_vault_mapping

    mapping = asyncio.run(fetch_morpho_vault_mapping())
    if not mapping:
        logger.warning("_resolve_morpho_addresses: No vaults returned from Morpho API")
        return 0

    pools = YieldPool.objects.filter(project="morpho-v1")

    resolved = 0
    for pool in pools:
        candidates = mapping.get((pool.symbol.upper(), pool.chain_id))
        if not candidates:
            logger.warning(
                f"_resolve_morpho: No match for symbol='{pool.symbol}' "
                f"chain={pool.chain_id} pool_id={pool.pool_id}"
            )
            continue

        if len(candidates) == 1:
            # Unique symbol — direct match
            address = candidates[0][0]
        else:
            # Duplicate symbols — pick closest TVL to DeFiLlama's value
            dl_tvl = float(pool.tvl_usd)
            address = min(candidates, key=lambda c: abs(c[1] - dl_tvl))[0]
            logger.info(
                f"_resolve_morpho: '{pool.symbol}' chain={pool.chain_id} "
                f"has {len(candidates)} vaults, matched by TVL proximity "
                f"(DeFiLlama=${dl_tvl:,.0f}) -> {address}"
            )

        if pool.contract_address != address:
            pool.contract_address = address
            pool.save(update_fields=["contract_address"])
            resolved += 1

    if resolved:
        logger.info(f"_resolve_morpho_addresses: Updated {resolved} Morpho pools")
    return resolved


def _resolve_euler_addresses() -> int:
    """
    Resolve Euler vault addresses via Goldsky subgraph.

    Matches DeFiLlama pools to Euler vaults by (poolMeta name, chain_id).
    DeFiLlama's poolMeta field contains the vault name (e.g. "EVK Vault eUSDC-5")
    which matches the on-chain name() returned by the subgraph.

    Returns:
        Number of Euler pools updated.
    """
    from apps.yields.models import YieldPool
    from integrations.defillama.vault_resolver import fetch_euler_vault_mapping

    mapping = asyncio.run(fetch_euler_vault_mapping())
    if not mapping:
        logger.warning(
            "_resolve_euler_addresses: No vaults returned from Euler subgraph"
        )
        return 0

    pools = YieldPool.objects.filter(project="euler-v2")

    resolved = 0
    for pool in pools:
        # DeFiLlama stores vault name in poolMeta field
        pool_meta_name = ""
        if pool.pool_meta and isinstance(pool.pool_meta, dict):
            pool_meta_name = pool.pool_meta.get("poolMeta", "") or ""

        address = mapping.get((pool_meta_name, pool.chain_id))
        if address and pool.contract_address != address:
            pool.contract_address = address
            pool.save(update_fields=["contract_address"])
            resolved += 1
        elif not address and pool_meta_name:
            logger.warning(
                f"_resolve_euler: No match for name='{pool_meta_name}' "
                f"chain={pool.chain_id} pool_id={pool.pool_id}"
            )
        elif not pool_meta_name:
            logger.warning(
                f"_resolve_euler: Missing poolMeta for pool_id={pool.pool_id} "
                f"chain={pool.chain_id}"
            )

    if resolved:
        logger.info(f"_resolve_euler_addresses: Updated {resolved} Euler pools")
    return resolved
