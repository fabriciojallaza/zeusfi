"""
Celery tasks for yields app.
"""

import asyncio
import logging
from datetime import timedelta
from decimal import Decimal

from celery import shared_task
from django.utils import timezone

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

    # Step 1: Fetch data async
    async def fetch_pools():
        client = DeFiLlamaClient()
        async with client:
            return await client.get_filtered_pools()

    try:
        pools = asyncio.run(fetch_pools())
    except Exception as e:
        logger.error(f"Error fetching yields from DeFiLlama: {e}")
        return {
            "error": str(e),
            "timestamp": timezone.now().isoformat(),
        }

    logger.info(f"Fetched {len(pools)} filtered pools from DeFiLlama")

    # Step 2: Update database (sync)
    updated = 0
    created = 0
    errors = 0

    for pool_data in pools:
        try:
            pool_id = pool_data.get("pool")
            if not pool_id:
                continue

            # Prepare data for model
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
            errors += 1
            logger.error(f"Error processing pool {pool_data.get('pool')}: {e}")

    # Clean up old pools that no longer exist
    # (pools not updated in the last 2 hours)
    cutoff = timezone.now() - timedelta(hours=2)
    deleted = YieldPool.objects.filter(updated_at__lt=cutoff).delete()[0]

    result = {
        "created": created,
        "updated": updated,
        "deleted": deleted,
        "errors": errors,
        "total_pools": YieldPool.objects.count(),
        "timestamp": timezone.now().isoformat(),
    }

    logger.info(f"Yield fetch complete: {result}")
    return result
