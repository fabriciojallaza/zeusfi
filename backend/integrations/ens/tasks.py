"""
Celery tasks for ENS integration.
"""

import asyncio
import logging

from celery import shared_task
from django.utils import timezone

from parameters.common.logger.logger_service import LoggerService

logger = logging.getLogger(__name__)


@shared_task(name="integrations.ens.tasks.warm_ens_cache")
def warm_ens_cache() -> dict:
    """
    Warm ENS cache by fetching preferences for all wallets with ENS names.

    Runs every 30 minutes (offset by 15 min from yields fetch).

    Returns:
        Dict with task results
    """
    logger.info("warm_ens_cache: Starting ENS preferences sync")
    return asyncio.run(_warm_ens_cache_async())


async def _warm_ens_cache_async() -> dict:
    """Async implementation of ENS cache warming."""
    from apps.wallets.models import Wallet
    from integrations.ens.client import ENSClient

    client = ENSClient()
    updated = 0
    resolved = 0
    errors = []

    # Get all wallets with ENS names
    wallets = Wallet.objects.exclude(ens_name__isnull=True).exclude(ens_name="")
    logger.info(f"warm_ens_cache: Found {wallets.count()} wallets with ENS names")

    for wallet in wallets:
        try:
            preferences = await client.get_preferences(wallet.ens_name)

            # Update wallet with fetched preferences
            wallet.ens_min_apy = preferences.get("min_apy")
            wallet.ens_max_risk = preferences.get("max_risk")
            wallet.ens_chains = preferences.get("chains", [])
            wallet.ens_protocols = preferences.get("protocols", [])
            wallet.ens_auto_rebalance = preferences.get("auto_rebalance", False)
            wallet.ens_updated_at = timezone.now()
            wallet.save()

            updated += 1
            logger.debug(f"warm_ens_cache: Updated preferences for {wallet.ens_name}")

        except Exception as e:
            errors.append(
                {
                    "wallet": wallet.address,
                    "ens_name": wallet.ens_name,
                    "step": "preferences",
                    "error": str(e),
                }
            )
            logger.error(
                f"warm_ens_cache: Failed to update preferences for {wallet.ens_name}",
                exc_info=True,
                extra={"wallet": wallet.address, "ens_name": wallet.ens_name},
            )

    # Also try to resolve ENS names for wallets without them
    wallets_without_ens = Wallet.objects.filter(ens_name__isnull=True)

    for wallet in wallets_without_ens:
        try:
            ens_name = await client.reverse_resolve(wallet.address)
            if ens_name:
                wallet.ens_name = ens_name
                wallet.save(update_fields=["ens_name"])
                resolved += 1
                logger.info(
                    f"warm_ens_cache: Resolved ENS name {ens_name} for {wallet.address}"
                )

                # Now fetch preferences for the newly resolved name
                preferences = await client.get_preferences(ens_name)
                wallet.ens_min_apy = preferences.get("min_apy")
                wallet.ens_max_risk = preferences.get("max_risk")
                wallet.ens_chains = preferences.get("chains", [])
                wallet.ens_protocols = preferences.get("protocols", [])
                wallet.ens_auto_rebalance = preferences.get("auto_rebalance", False)
                wallet.ens_updated_at = timezone.now()
                wallet.save()

                updated += 1

        except Exception as e:
            errors.append(
                {
                    "wallet": wallet.address,
                    "step": "reverse_resolve",
                    "error": str(e),
                }
            )
            logger.debug(
                f"warm_ens_cache: Failed to reverse resolve {wallet.address}: {e}"
            )

    result = {
        "updated": updated,
        "resolved": resolved,
        "errors": len(errors),
        "timestamp": timezone.now().isoformat(),
    }

    if errors:
        logger.error(
            f"warm_ens_cache: Completed with {len(errors)} error(s)",
            extra={"error_count": len(errors), "errors": errors, **result},
        )
        await asyncio.to_thread(
            LoggerService.create__manual_logg,
            "500",
            "tasks/warm_ens_cache",
            "TASK",
            str({"wallet_count": wallets.count()}),
            str({"errors": errors}),
        )
        raise Exception(
            f"warm_ens_cache: Completed with {len(errors)} error(s). Details: {errors}"
        )

    await asyncio.to_thread(
        LoggerService.create__manual_logg,
        "200",
        "tasks/warm_ens_cache",
        "TASK",
        str({"wallet_count": wallets.count()}),
        str(result),
    )
    logger.info(f"warm_ens_cache: Complete - {result}")
    return result


@shared_task(name="integrations.ens.tasks.update_wallet_ens")
def update_wallet_ens(wallet_address: str) -> dict:
    """
    Update ENS preferences for a single wallet.

    Args:
        wallet_address: Wallet address to update

    Returns:
        Dict with task results
    """
    logger.info(f"update_wallet_ens: Starting ENS update for {wallet_address[:10]}...")
    return asyncio.run(_update_wallet_ens_async(wallet_address))


async def _update_wallet_ens_async(wallet_address: str) -> dict:
    """Async implementation of single wallet ENS update."""
    from apps.wallets.models import Wallet
    from integrations.ens.client import ENSClient

    client = ENSClient()
    wallet_address = wallet_address.lower()

    try:
        wallet = await asyncio.to_thread(
            Wallet.objects.get,
            address=wallet_address,
        )
    except Wallet.DoesNotExist:
        logger.warning(
            f"update_wallet_ens: Wallet not found: {wallet_address}",
            extra={"wallet": wallet_address},
        )
        await asyncio.to_thread(
            LoggerService.create__manual_logg,
            "404",
            "tasks/update_wallet_ens",
            "TASK",
            str({"address": wallet_address}),
            str({"error": f"Wallet not found: {wallet_address}"}),
        )
        return {"error": f"Wallet not found: {wallet_address}"}

    # Try to resolve ENS name if not set
    if not wallet.ens_name:
        ens_name = await client.reverse_resolve(wallet_address)
        if ens_name:
            wallet.ens_name = ens_name
            logger.info(
                f"update_wallet_ens: Resolved ENS name {ens_name} for {wallet_address}"
            )

    # Fetch preferences if we have an ENS name
    if wallet.ens_name:
        try:
            preferences = await client.get_preferences(wallet.ens_name)
            wallet.ens_min_apy = preferences.get("min_apy")
            wallet.ens_max_risk = preferences.get("max_risk")
            wallet.ens_chains = preferences.get("chains", [])
            wallet.ens_protocols = preferences.get("protocols", [])
            wallet.ens_auto_rebalance = preferences.get("auto_rebalance", False)
            wallet.ens_updated_at = timezone.now()

            await asyncio.to_thread(wallet.save)

            logger.info(
                f"update_wallet_ens: Updated preferences for {wallet.ens_name}",
                extra={"wallet": wallet_address, "ens_name": wallet.ens_name},
            )

            await asyncio.to_thread(
                LoggerService.create__manual_logg,
                "200",
                "tasks/update_wallet_ens",
                "TASK",
                str({"address": wallet_address}),
                str({"preferences": preferences}),
            )
            return {
                "wallet_address": wallet_address,
                "ens_name": wallet.ens_name,
                "preferences": preferences,
                "timestamp": timezone.now().isoformat(),
            }
        except Exception as e:
            logger.error(
                f"update_wallet_ens: Failed to fetch preferences for {wallet.ens_name}",
                exc_info=True,
                extra={"wallet": wallet_address, "ens_name": wallet.ens_name},
            )
            await asyncio.to_thread(
                LoggerService.create__manual_logg,
                "500",
                "tasks/update_wallet_ens",
                "TASK",
                str({"address": wallet_address, "ens_name": wallet.ens_name}),
                str({"error": str(e)}),
            )
            raise Exception(f"update_wallet_ens: Failed for {wallet.ens_name}: {e}")

    logger.info(
        f"update_wallet_ens: No ENS name found for {wallet_address}",
        extra={"wallet": wallet_address},
    )
    return {
        "wallet_address": wallet_address,
        "ens_name": None,
        "message": "No ENS name found",
    }
