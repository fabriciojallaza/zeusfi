"""
ENS client for reading user preferences from ENS text records.

ENS is read from Ethereum mainnet using web3.py AsyncWeb3.
"""

import logging
from typing import Any

from django.conf import settings
from web3 import AsyncWeb3
from web3.providers import AsyncHTTPProvider

logger = logging.getLogger(__name__)


class ENSClient:
    """
    Read ENS text records using web3.py AsyncWeb3.

    Preferences are stored as ENS text records:
    - yield.minAPY: Minimum APY percentage (e.g., "5")
    - yield.maxRisk: Risk level (low/medium/high)
    - yield.chains: Comma-separated chains (e.g., "base,arbitrum")
    - yield.protocols: Comma-separated protocols (e.g., "aave,morpho,euler")
    - yield.autoRebalance: Auto-rebalance flag ("true"/"false")
    """

    TEXT_RECORDS = [
        "yield.minAPY",
        "yield.maxRisk",
        "yield.chains",
        "yield.protocols",
        "yield.autoRebalance",
    ]

    def __init__(self, rpc_url: str | None = None):
        """
        Initialize ENS client.

        Args:
            rpc_url: Ethereum mainnet RPC URL. Defaults to settings.ETHEREUM_RPC_URL.
        """
        self.rpc_url = rpc_url or settings.ETHEREUM_RPC_URL
        self._web3: AsyncWeb3 | None = None

    @property
    def web3(self) -> AsyncWeb3:
        """Get AsyncWeb3 instance."""
        if self._web3 is None:
            self._web3 = AsyncWeb3(AsyncHTTPProvider(self.rpc_url))
        return self._web3

    async def resolve_address(self, ens_name: str) -> str | None:
        """
        Resolve ENS name to address.

        Args:
            ens_name: ENS name (e.g., "vitalik.eth")

        Returns:
            Ethereum address or None if not found
        """
        try:
            address = await self.web3.eth.ens.address(ens_name)
            return address.lower() if address else None
        except Exception as e:
            logger.warning(f"Failed to resolve ENS name {ens_name}: {e}")
            return None

    async def reverse_resolve(self, address: str) -> str | None:
        """
        Get ENS name for address (if set as primary).

        Args:
            address: Ethereum address

        Returns:
            ENS name or None if not set
        """
        try:
            ens_name = await self.web3.eth.ens.name(address)
            return ens_name
        except Exception as e:
            logger.warning(f"Failed to reverse resolve address {address}: {e}")
            return None

    async def get_text_record(self, ens_name: str, key: str) -> str | None:
        """
        Get a single text record from ENS name.

        Args:
            ens_name: ENS name (e.g., "vitalik.eth")
            key: Text record key (e.g., "yield.minAPY")

        Returns:
            Text record value or None if not found
        """
        try:
            # Get resolver for the ENS name
            resolver = await self.web3.eth.ens.resolver(ens_name)
            if not resolver:
                return None

            # Get text record
            value = await resolver.functions.text(
                self.web3.eth.ens.namehash(ens_name),
                key,
            ).call()

            return value if value else None
        except Exception as e:
            logger.debug(f"Failed to get text record {key} for {ens_name}: {e}")
            return None

    async def get_preferences(self, ens_name: str) -> dict[str, Any]:
        """
        Read all yield.* text records for an ENS name.

        Args:
            ens_name: ENS name (e.g., "vitalik.eth")

        Returns:
            Dict with parsed preferences:
            {
                "min_apy": float | None,
                "max_risk": str | None,
                "chains": list[str],
                "protocols": list[str],
                "auto_rebalance": bool,
            }
        """
        preferences: dict[str, Any] = {
            "min_apy": None,
            "max_risk": None,
            "chains": [],
            "protocols": [],
            "auto_rebalance": False,
        }

        try:
            # Get resolver once for efficiency
            resolver = await self.web3.eth.ens.resolver(ens_name)
            if not resolver:
                logger.debug(f"No resolver found for {ens_name}")
                return preferences

            namehash = self.web3.eth.ens.namehash(ens_name)

            # Fetch all text records
            for key in self.TEXT_RECORDS:
                try:
                    value = await resolver.functions.text(namehash, key).call()
                    if value:
                        self._parse_preference(preferences, key, value)
                except Exception as e:
                    logger.debug(f"Failed to get {key} for {ens_name}: {e}")

        except Exception as e:
            logger.warning(f"Failed to get preferences for {ens_name}: {e}")

        return preferences

    def _parse_preference(
        self,
        preferences: dict[str, Any],
        key: str,
        value: str,
    ) -> None:
        """Parse a single preference value into the preferences dict."""
        if key == "yield.minAPY":
            try:
                preferences["min_apy"] = float(value)
            except ValueError:
                logger.warning(f"Invalid minAPY value: {value}")

        elif key == "yield.maxRisk":
            value_lower = value.lower()
            if value_lower in ["low", "medium", "high"]:
                preferences["max_risk"] = value_lower
            else:
                logger.warning(f"Invalid maxRisk value: {value}")

        elif key == "yield.chains":
            # Parse comma-separated list
            chains = [c.strip().lower() for c in value.split(",") if c.strip()]
            preferences["chains"] = chains

        elif key == "yield.protocols":
            # Parse comma-separated list
            protocols = [p.strip().lower() for p in value.split(",") if p.strip()]
            preferences["protocols"] = protocols

        elif key == "yield.autoRebalance":
            preferences["auto_rebalance"] = value.lower() in ["true", "1", "yes"]


# Singleton instance for convenience
_client: ENSClient | None = None


def get_ens_client() -> ENSClient:
    """Get singleton ENS client instance."""
    global _client
    if _client is None:
        _client = ENSClient()
    return _client
