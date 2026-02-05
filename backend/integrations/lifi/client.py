"""
LI.FI client for cross-chain bridging and swaps.

API: https://li.quest/v1
Docs: https://docs.li.fi/
"""

import logging
from typing import Any

from django.conf import settings

from integrations.base import BaseAsyncClient, APIError
from .types import QuoteRequest, QuoteResponse, StatusResponse

logger = logging.getLogger(__name__)


class LiFiClient(BaseAsyncClient):
    """
    Client for LI.FI API.

    Provides cross-chain bridging and swap quotes. LI.FI's Composer feature
    can also deposit directly into DeFi protocols (e.g., Aave) in the same tx.
    """

    BASE_URL = "https://li.quest/v1"
    DEFAULT_TIMEOUT = 60.0  # Bridge quotes can be slow

    def __init__(self, api_key: str | None = None):
        """
        Initialize LI.FI client.

        Args:
            api_key: LI.FI API key (optional but recommended for higher rate limits)
        """
        api_key = api_key or settings.LIFI_API_KEY
        headers = {}
        if api_key:
            headers["x-lifi-api-key"] = api_key

        super().__init__(headers=headers)

    async def get_quote(
        self,
        from_chain: int,
        from_token: str,
        from_amount: str,
        to_chain: int,
        to_token: str,
        from_address: str,
        slippage: float = 0.03,
        **kwargs,
    ) -> QuoteResponse:
        """
        Get quote for cross-chain move with optional protocol deposit.

        For Composer integration (depositing into Aave, etc.):
        - Set to_token to the vault token (e.g., aUSDC for Aave)
        - LI.FI handles swap -> bridge -> deposit automatically

        Args:
            from_chain: Source chain ID
            from_token: Source token address
            from_amount: Amount in wei/smallest unit
            to_chain: Destination chain ID
            to_token: Destination token address (use vault token for deposits)
            from_address: Sender address (vault)
            slippage: Slippage tolerance (default 3%)
            **kwargs: Additional parameters (allowBridges, denyBridges, etc.)

        Returns:
            QuoteResponse with transaction data

        Raises:
            APIError: If quote fails
        """
        params = {
            "fromChain": from_chain,
            "fromToken": from_token,
            "fromAmount": from_amount,
            "toChain": to_chain,
            "toToken": to_token,
            "fromAddress": from_address,
            "slippage": slippage,
            **kwargs,
        }

        try:
            response = await self._get("/quote", params=params)
            return QuoteResponse.model_validate(response)
        except Exception as e:
            logger.error(f"Failed to get LI.FI quote: {e}")
            raise APIError(f"Failed to get quote: {e}")

    async def get_quote_request(self, request: QuoteRequest) -> QuoteResponse:
        """
        Get quote using a QuoteRequest object.

        Args:
            request: QuoteRequest with all parameters

        Returns:
            QuoteResponse with transaction data
        """
        return await self.get_quote(
            from_chain=request.fromChain,
            from_token=request.fromToken,
            from_amount=request.fromAmount,
            to_chain=request.toChain,
            to_token=request.toToken,
            from_address=request.fromAddress,
            slippage=request.slippage,
            allowBridges=request.allowBridges,
            denyBridges=request.denyBridges,
            preferBridges=request.preferBridges,
        )

    async def get_status(
        self,
        tx_hash: str,
        from_chain: int | None = None,
        to_chain: int | None = None,
        bridge: str | None = None,
    ) -> StatusResponse:
        """
        Check status of a LI.FI transaction.

        Args:
            tx_hash: Transaction hash to check
            from_chain: Source chain ID (optional)
            to_chain: Destination chain ID (optional)
            bridge: Bridge used (optional)

        Returns:
            StatusResponse with transaction status
        """
        params: dict[str, Any] = {"txHash": tx_hash}
        if from_chain:
            params["fromChain"] = from_chain
        if to_chain:
            params["toChain"] = to_chain
        if bridge:
            params["bridge"] = bridge

        try:
            response = await self._get("/status", params=params)
            return StatusResponse.model_validate(response)
        except Exception as e:
            logger.error(f"Failed to get LI.FI status: {e}")
            raise APIError(f"Failed to get status: {e}")

    async def get_chains(self) -> list[dict[str, Any]]:
        """Get list of supported chains."""
        response = await self._get("/chains")
        return response.get("chains", [])

    async def get_tokens(self, chains: list[int] | None = None) -> dict[str, list[dict]]:
        """
        Get list of supported tokens.

        Args:
            chains: Optional list of chain IDs to filter

        Returns:
            Dict mapping chain ID to list of tokens
        """
        params = {}
        if chains:
            params["chains"] = ",".join(str(c) for c in chains)

        response = await self._get("/tokens", params=params)
        return response.get("tokens", {})

    async def get_connections(
        self,
        from_chain: int,
        from_token: str,
        to_chain: int | None = None,
    ) -> list[dict]:
        """
        Get possible connections from a token.

        Args:
            from_chain: Source chain ID
            from_token: Source token address
            to_chain: Optional destination chain ID

        Returns:
            List of possible connections
        """
        params = {
            "fromChain": from_chain,
            "fromToken": from_token,
        }
        if to_chain:
            params["toChain"] = to_chain

        response = await self._get("/connections", params=params)
        return response.get("connections", [])


# Singleton instance
_client: LiFiClient | None = None


def get_lifi_client() -> LiFiClient:
    """Get singleton LI.FI client instance."""
    global _client
    if _client is None:
        _client = LiFiClient()
    return _client
