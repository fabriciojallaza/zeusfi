"""
DeFiLlama client for fetching yield/APY data.

API: https://yields.llama.fi
"""

import logging
from typing import Any

from config.protocols import SUPPORTED_PROTOCOLS, PROTOCOL_RISK_SCORES
from integrations.base import BaseAsyncClient

logger = logging.getLogger(__name__)


# Mapping from DeFiLlama chain names to our chain IDs
DEFILLAMA_CHAIN_MAP = {
    "base": 8453,
    "arbitrum": 42161,
    "avalanche": 43114,
}

# Minimum TVL for pools to be considered ($100k)
MIN_TVL_USD = 100_000


class DeFiLlamaClient(BaseAsyncClient):
    """
    Client for DeFiLlama yields API.

    Fetches yield data for USDC pools on supported chains and protocols.
    """

    BASE_URL = "https://yields.llama.fi"
    DEFAULT_TIMEOUT = 60.0  # DeFiLlama can be slow

    async def get_pools(self) -> list[dict[str, Any]]:
        """
        Fetch all pools from DeFiLlama.

        Returns:
            List of pool data dicts
        """
        response = await self._get("/pools")
        return response.get("data", [])

    def filter_supported_pools(
        self, pools: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """
        Filter pools to supported chains, protocols, and USDC only.

        Criteria:
        - Supported chains: base, arbitrum, avalanche
        - Supported protocols: aave-v3, morpho-v1, euler-v2
        - USDC only (stablecoin=true, symbol contains USDC)
        - Min TVL: $100k

        Args:
            pools: Raw pools from DeFiLlama

        Returns:
            Filtered list of pools with calculated risk scores
        """
        filtered = []

        for pool in pools:
            # Check chain
            chain = pool.get("chain", "").lower()
            if chain not in DEFILLAMA_CHAIN_MAP:
                continue

            # Check protocol
            project = pool.get("project", "").lower()
            if project not in SUPPORTED_PROTOCOLS:
                continue

            # Check symbol (must be USDC)
            symbol = pool.get("symbol", "").upper()
            if "USDC" not in symbol:
                continue

            # Check stablecoin flag
            if not pool.get("stablecoin", False):
                continue

            # Check TVL
            tvl = pool.get("tvlUsd", 0)
            if tvl < MIN_TVL_USD:
                continue

            # Add chain_id and risk score
            pool_data = {
                **pool,
                "chain_id": DEFILLAMA_CHAIN_MAP[chain],
                "risk_score": self._calculate_risk_score(pool),
            }

            filtered.append(pool_data)

        logger.info(f"Filtered {len(filtered)} pools from {len(pools)} total")
        return filtered

    def _calculate_risk_score(self, pool: dict[str, Any]) -> int:
        """
        Calculate risk score for a pool (1-10, lower is safer).

        Factors:
        - Protocol base risk
        - TVL (higher = safer)
        - IL risk
        - Exposure type
        """
        project = pool.get("project", "").lower()
        base_score = PROTOCOL_RISK_SCORES.get(project, 5)

        # Adjust for TVL (higher TVL = lower risk)
        tvl = pool.get("tvlUsd", 0)
        if tvl > 100_000_000:  # $100M+
            base_score = max(1, base_score - 1)
        elif tvl < 1_000_000:  # <$1M
            base_score = min(10, base_score + 1)

        # Adjust for IL risk
        il_risk = pool.get("ilRisk", "none")
        if il_risk == "yes" or il_risk == "high":
            base_score = min(10, base_score + 2)

        # Adjust for exposure type
        exposure = pool.get("exposure", "single")
        if exposure == "multi":
            base_score = min(10, base_score + 1)

        return base_score

    async def get_filtered_pools(self) -> list[dict[str, Any]]:
        """
        Fetch and filter pools in one call.

        Returns:
            List of filtered, supported pools
        """
        pools = await self.get_pools()
        return self.filter_supported_pools(pools)


# Singleton instance
_client: DeFiLlamaClient | None = None


def get_defillama_client() -> DeFiLlamaClient:
    """Get singleton DeFiLlama client instance."""
    global _client
    if _client is None:
        _client = DeFiLlamaClient()
    return _client
