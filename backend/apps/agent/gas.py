"""
Gas cost estimation for agent rebalance decisions.

Estimates USD cost of a rebalance transaction so the agent can skip
moves where gas exceeds the projected yield gain.
"""

import logging

from web3 import AsyncWeb3
from web3.providers import AsyncHTTPProvider

from config.chains import SUPPORTED_CHAINS

logger = logging.getLogger(__name__)

# Typical gas units for vault operations
GAS_UNITS_SAME_CHAIN = 300_000
GAS_UNITS_CROSS_CHAIN = 600_000

# Native token prices in USD (hardcoded for MVP — avoids extra API dependency)
# ETH is used on Base, Arbitrum, and Optimism (all L2s)
NATIVE_TOKEN_PRICE_USD = 2500.0


async def estimate_rebalance_gas_cost(
    chain_id: int,
    is_cross_chain: bool = False,
) -> float:
    """
    Estimate the USD cost of a rebalance transaction on a given chain.

    Args:
        chain_id: The chain where the transaction will execute.
        is_cross_chain: Whether this is a cross-chain rebalance (higher gas).

    Returns:
        Estimated gas cost in USD.
    """
    chain_config = SUPPORTED_CHAINS.get(chain_id)
    if not chain_config:
        logger.warning(f"Unknown chain {chain_id}, returning 0 gas cost")
        return 0.0

    gas_units = GAS_UNITS_CROSS_CHAIN if is_cross_chain else GAS_UNITS_SAME_CHAIN

    try:
        w3 = AsyncWeb3(AsyncHTTPProvider(chain_config["rpc"]))
        gas_price_wei = await w3.eth.gas_price
        gas_price_eth = float(gas_price_wei) / 1e18
        gas_cost_eth = gas_price_eth * gas_units
        gas_cost_usd = gas_cost_eth * NATIVE_TOKEN_PRICE_USD

        logger.info(
            f"Gas estimate for chain {chain_id}: "
            f"{gas_units} units * {gas_price_wei} wei = ${gas_cost_usd:.4f}"
        )
        return gas_cost_usd

    except Exception as e:
        logger.error(f"Gas estimation failed for chain {chain_id}: {e}")
        # Return a conservative estimate so the agent doesn't skip checks
        return 1.0
