"""
Agent decision engine — pure functions, no side effects.

find_best_pool: filters YieldPools by wallet ENS preferences, returns best.
should_rebalance: compares current positions vs best pool, decides if move is worth it.
"""

import logging
from decimal import Decimal

from apps.wallets.models import Wallet
from apps.yields.models import YieldPool
from config.chains import NAME_TO_CHAIN_ID
from config.protocols import map_ens_protocols

logger = logging.getLogger(__name__)


def find_best_pool(pools: list[YieldPool], wallet: Wallet) -> YieldPool | None:
    """
    Return the single best YieldPool for this wallet, respecting ENS preferences.

    Filtering order:
    1. ens_chains   — keep only pools on allowed chains
    2. ens_protocols — keep only pools on allowed protocols
    3. ens_min_apy  — drop pools below minimum APY
    4. ens_max_risk — drop pools above maximum risk
    5. Sort by APY descending, return first
    """
    # 0. Only consider pools with a resolved contract address
    filtered = [p for p in pools if p.contract_address]

    # 1. Filter by chain preference
    if wallet.ens_chains:
        allowed_chain_ids = set()
        for name in wallet.ens_chains:
            cid = NAME_TO_CHAIN_ID.get(name.lower())
            if cid:
                allowed_chain_ids.add(cid)
        if allowed_chain_ids:
            filtered = [p for p in filtered if p.chain_id in allowed_chain_ids]

    # 2. Filter by protocol preference
    if wallet.ens_protocols:
        allowed_protocols = set(map_ens_protocols(wallet.ens_protocols))
        if allowed_protocols:
            filtered = [p for p in filtered if p.project in allowed_protocols]

    # 3. Filter by minimum APY
    if wallet.ens_min_apy is not None:
        min_apy = Decimal(str(wallet.ens_min_apy))
        filtered = [p for p in filtered if p.apy >= min_apy]

    # 4. Filter by max risk
    max_risk = wallet.ens_max_risk
    if not max_risk:
        # Default: low-medium risk for users without ENS preferences
        max_risk = "medium"

    if max_risk == "low":
        max_score = 3
    elif max_risk == "medium":
        max_score = 6
    else:  # "high" or anything else — no filter
        max_score = 10

    filtered = [p for p in filtered if p.risk_score <= max_score]

    if not filtered:
        logger.info(f"No pools match preferences for wallet {wallet.address[:8]}")
        return None

    # Sort by APY descending, pick first
    filtered.sort(key=lambda p: p.apy, reverse=True)
    best = filtered[0]
    logger.info(
        f"Best pool for {wallet.address[:8]}: "
        f"{best.project} on {best.chain} — {best.apy}% APY"
    )
    return best


def should_rebalance(
    current_positions: list[dict],
    best_pool: YieldPool,
    wallet: Wallet,
    threshold: Decimal = Decimal("1.0"),
    gas_cost_usd: float = 0.0,
) -> tuple[bool, str]:
    """
    Decide whether to rebalance from current positions into best_pool.

    Args:
        current_positions: List of PositionInfo dicts from ContractReader
        best_pool: The best YieldPool from find_best_pool()
        wallet: Wallet model with ENS preferences
        threshold: Minimum APY improvement to justify a move (default 1%)
        gas_cost_usd: Estimated gas cost in USD for this rebalance

    Returns:
        (should_move: bool, reasoning: str)
    """
    if not current_positions:
        return False, "No current positions found."

    # Separate idle USDC (protocol="wallet") from deployed positions
    idle_positions = [p for p in current_positions if p["protocol"] == "wallet"]
    deployed_positions = [p for p in current_positions if p["protocol"] != "wallet"]

    # --- Case 1: Idle USDC in vault — ALWAYS deploy, no opt-in needed ---
    total_idle = sum(Decimal(p["amount"]) for p in idle_positions)
    if total_idle > Decimal("0.10"):  # more than $0.10 idle
        return True, (
            f"Idle USDC detected: ${total_idle:.2f}. "
            f"Deploying to {best_pool.project} on {best_pool.chain} "
            f"at {best_pool.apy}% APY."
        )

    # --- Case 2: Already deployed — rebalance only if user opted in ---
    if not wallet.ens_auto_rebalance:
        return False, "Auto-rebalance not enabled for this wallet."

    if not deployed_positions:
        if total_idle > 0:
            return False, f"Idle USDC (${total_idle:.2f}) below deployment threshold."
        return False, "No deployed positions and no idle USDC."

    # Calculate current weighted APY
    total_value = Decimal("0")
    weighted_apy = Decimal("0")
    for pos in deployed_positions:
        amount = Decimal(pos["amount"])
        total_value += amount
        # Look up current APY for this protocol+chain from YieldPool
        pool = YieldPool.objects.filter(
            project=pos["protocol"],
            chain_id=pos["chain_id"],
            symbol__icontains="USDC",
        ).first()
        if pool:
            weighted_apy += amount * pool.apy

    if total_value > 0:
        current_apy = weighted_apy / total_value
    else:
        return False, "No deployed value to rebalance."

    # Check if best pool IS the current position (no point moving)
    for pos in deployed_positions:
        if (
            pos["protocol"] == best_pool.project
            and pos["chain_id"] == best_pool.chain_id
        ):
            return False, (
                f"Already in best pool: {best_pool.project} on {best_pool.chain} "
                f"at {current_apy:.2f}% APY."
            )

    # Check if improvement exceeds threshold
    improvement = best_pool.apy - current_apy
    if improvement < threshold:
        return False, (
            f"Improvement too small: {current_apy:.2f}% -> {best_pool.apy}% "
            f"(+{improvement:.2f}%, threshold={threshold}%)."
        )

    # Check if yield gain over 30 days exceeds gas cost
    if gas_cost_usd > 0 and total_value > 0:
        monthly_gain = float(improvement) / 100 * float(total_value) * (30 / 365)
        if monthly_gain < gas_cost_usd:
            return False, (
                f"Gas cost (${gas_cost_usd:.2f}) exceeds 30-day yield gain "
                f"(${monthly_gain:.2f}). Skipping rebalance."
            )

    return True, (
        f"Rebalancing: {current_apy:.2f}% -> {best_pool.apy}% "
        f"(+{improvement:.2f}%) from current to "
        f"{best_pool.project} on {best_pool.chain}."
    )
