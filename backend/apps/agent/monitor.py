"""
Pending transaction monitor.

Detects stuck agent transactions (low gas, network congestion) and updates
their status in RebalanceHistory.
"""

import logging
from datetime import timedelta

from django.utils import timezone
from web3 import AsyncWeb3
from web3.providers import AsyncHTTPProvider

from config.chains import SUPPORTED_CHAINS

logger = logging.getLogger(__name__)

# Transactions older than this without a receipt are marked FAILED
STUCK_TX_THRESHOLD = timedelta(minutes=30)


async def check_pending_transactions() -> dict:
    """
    Check all pending/submitted RebalanceHistory entries and update their status.

    - Receipt found with status 1 -> SUCCESS
    - Receipt found with status 0 -> FAILED
    - No receipt + older than 30 min -> FAILED (stuck)

    Returns:
        Summary dict with counts of updated transactions.
    """
    from apps.positions.models import RebalanceHistory

    cutoff = timezone.now() - timedelta(minutes=10)
    pending_entries = list(
        RebalanceHistory.objects.filter(
            status__in=[
                RebalanceHistory.Status.PENDING,
                RebalanceHistory.Status.SUBMITTED,
            ],
            created_at__lt=cutoff,
        ).select_related("wallet")
    )

    if not pending_entries:
        logger.debug("monitor: No pending transactions to check")
        return {"checked": 0, "updated": 0}

    logger.info(f"monitor: Checking {len(pending_entries)} pending transactions")

    web3_clients: dict[int, AsyncWeb3] = {}
    updated = 0

    for entry in pending_entries:
        try:
            if entry.tx_hash:
                # Has a TX hash — check receipt
                chain_id = entry.to_chain_id
                if chain_id not in web3_clients:
                    chain_config = SUPPORTED_CHAINS.get(chain_id)
                    if not chain_config:
                        continue
                    web3_clients[chain_id] = AsyncWeb3(
                        AsyncHTTPProvider(chain_config["rpc"])
                    )

                w3 = web3_clients[chain_id]
                try:
                    receipt = await w3.eth.get_transaction_receipt(entry.tx_hash)
                    if receipt["status"] == 1:
                        entry.mark_success()
                        logger.info(
                            f"monitor: TX {entry.tx_hash[:10]}... confirmed SUCCESS"
                        )
                    else:
                        entry.mark_failed("Transaction reverted on-chain")
                        logger.warning(f"monitor: TX {entry.tx_hash[:10]}... REVERTED")
                    updated += 1
                except Exception:
                    # No receipt yet — check if stuck
                    age = timezone.now() - entry.created_at
                    if age > STUCK_TX_THRESHOLD:
                        entry.mark_failed(
                            f"Transaction stuck: no receipt after {age.total_seconds() / 60:.0f} minutes"
                        )
                        logger.warning(
                            f"monitor: TX {entry.tx_hash[:10]}... stuck for "
                            f"{age.total_seconds() / 60:.0f}min, marked FAILED"
                        )
                        updated += 1
            else:
                # No TX hash and older than threshold — mark failed
                age = timezone.now() - entry.created_at
                if age > STUCK_TX_THRESHOLD:
                    entry.mark_failed("No transaction hash after 30 minutes")
                    logger.warning(
                        f"monitor: Entry {entry.id} has no tx_hash after "
                        f"{age.total_seconds() / 60:.0f}min, marked FAILED"
                    )
                    updated += 1

        except Exception as e:
            logger.error(
                f"monitor: Error checking entry {entry.id}: {e}", exc_info=True
            )

    summary = {"checked": len(pending_entries), "updated": updated}
    logger.info(f"monitor: Complete — {summary}")
    return summary
