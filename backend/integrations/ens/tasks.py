"""
Celery tasks for ENS integration.
"""

import asyncio
import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="integrations.ens.tasks.warm_ens_cache")
def warm_ens_cache() -> dict:
    """
    Warm ENS cache by fetching preferences for all wallets with ENS names.

    Runs every 30 minutes (offset by 15 min from yields fetch).

    Returns:
        Dict with task results
    """
    return asyncio.run(_warm_ens_cache_async())


async def _warm_ens_cache_async() -> dict:
    """Async implementation of ENS cache warming."""
    from apps.wallets.models import Wallet
    from integrations.ens.client import ENSClient

    client = ENSClient()
    updated = 0
    errors = 0

    # Get all wallets with ENS names
    wallets = Wallet.objects.exclude(ens_name__isnull=True).exclude(ens_name="")

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
            logger.debug(f"Updated ENS preferences for {wallet.ens_name}")

        except Exception as e:
            errors += 1
            logger.error(f"Failed to update ENS preferences for {wallet.ens_name}: {e}")

    # Also try to resolve ENS names for wallets without them
    wallets_without_ens = Wallet.objects.filter(ens_name__isnull=True)

    for wallet in wallets_without_ens:
        try:
            ens_name = await client.reverse_resolve(wallet.address)
            if ens_name:
                wallet.ens_name = ens_name
                wallet.save(update_fields=["ens_name"])
                logger.info(f"Resolved ENS name {ens_name} for {wallet.address}")

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
            logger.debug(f"Failed to reverse resolve {wallet.address}: {e}")

    result = {
        "updated": updated,
        "errors": errors,
        "timestamp": timezone.now().isoformat(),
    }

    logger.info(f"ENS cache warming complete: {result}")
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
        return {"error": f"Wallet not found: {wallet_address}"}

    # Try to resolve ENS name if not set
    if not wallet.ens_name:
        ens_name = await client.reverse_resolve(wallet_address)
        if ens_name:
            wallet.ens_name = ens_name

    # Fetch preferences if we have an ENS name
    if wallet.ens_name:
        preferences = await client.get_preferences(wallet.ens_name)
        wallet.ens_min_apy = preferences.get("min_apy")
        wallet.ens_max_risk = preferences.get("max_risk")
        wallet.ens_chains = preferences.get("chains", [])
        wallet.ens_protocols = preferences.get("protocols", [])
        wallet.ens_auto_rebalance = preferences.get("auto_rebalance", False)
        wallet.ens_updated_at = timezone.now()

        await asyncio.to_thread(wallet.save)

        return {
            "wallet_address": wallet_address,
            "ens_name": wallet.ens_name,
            "preferences": preferences,
            "timestamp": timezone.now().isoformat(),
        }

    return {
        "wallet_address": wallet_address,
        "ens_name": None,
        "message": "No ENS name found",
    }
