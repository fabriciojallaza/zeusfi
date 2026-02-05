"""
LI.FI transaction executor service.

Handles the complete flow:
1. Get quote
2. Check/send approval
3. Sign and submit transaction
4. Track status until completion
5. Update database records
"""

import asyncio
import logging
from typing import Any

from web3 import AsyncWeb3
from web3.providers import AsyncHTTPProvider

from config.chains import SUPPORTED_CHAINS
from .client import LiFiClient
from .types import QuoteResponse, StatusResponse

logger = logging.getLogger(__name__)


# ERC20 ABI for approval
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": False,
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function",
    },
]


class LiFiExecutionError(Exception):
    """Error during LI.FI execution."""

    def __init__(self, message: str, step: str, details: dict | None = None):
        super().__init__(message)
        self.step = step
        self.details = details or {}


class LiFiExecutor:
    """
    Executes LI.FI transactions with the Agent Wallet.

    Complete flow:
    1. get_quote() - Get route and transaction data
    2. check_and_approve() - Ensure token approval
    3. execute() - Sign and submit transaction
    4. wait_for_completion() - Poll status until done
    """

    # Maximum time to wait for cross-chain tx (30 minutes)
    MAX_WAIT_TIME = 1800
    # Poll interval for status checks
    POLL_INTERVAL = 10

    def __init__(self, private_key: str | None = None):
        """
        Initialize executor.

        Args:
            private_key: Agent wallet private key. If not provided,
                        reads from AGENT_WALLET_PRIVATE_KEY env var.
        """
        self.private_key = private_key
        self.lifi_client = LiFiClient()
        self._web3_clients: dict[int, AsyncWeb3] = {}

    def _get_private_key(self) -> str:
        """Get private key, raising error if not configured."""
        if self.private_key:
            return self.private_key

        from decouple import config
        pk = config("AGENT_WALLET_PRIVATE_KEY", default="")
        if not pk:
            raise LiFiExecutionError(
                "Agent wallet private key not configured",
                step="init",
            )
        return pk

    def _get_web3(self, chain_id: int) -> AsyncWeb3:
        """Get AsyncWeb3 instance for a chain."""
        if chain_id not in self._web3_clients:
            chain_config = SUPPORTED_CHAINS.get(chain_id)
            if not chain_config:
                raise LiFiExecutionError(
                    f"Unsupported chain: {chain_id}",
                    step="init",
                )
            self._web3_clients[chain_id] = AsyncWeb3(
                AsyncHTTPProvider(chain_config["rpc"])
            )
        return self._web3_clients[chain_id]

    async def get_quote(
        self,
        from_chain: int,
        from_token: str,
        from_amount: str,
        to_chain: int,
        to_token: str,
        from_address: str,
        slippage: float = 0.03,
    ) -> QuoteResponse:
        """
        Step 1: Get LI.FI quote.

        Args:
            from_chain: Source chain ID
            from_token: Source token address
            from_amount: Amount in smallest unit
            to_chain: Destination chain ID
            to_token: Destination token (use aUSDC for Aave deposits)
            from_address: Sender address (vault)
            slippage: Slippage tolerance

        Returns:
            QuoteResponse with transaction data
        """
        async with self.lifi_client:
            quote = await self.lifi_client.get_quote(
                from_chain=from_chain,
                from_token=from_token,
                from_amount=from_amount,
                to_chain=to_chain,
                to_token=to_token,
                from_address=from_address,
                slippage=slippage,
            )

        logger.info(
            f"Got LI.FI quote: {quote.action.fromToken.symbol} -> "
            f"{quote.action.toToken.symbol}, "
            f"tool={quote.tool}, "
            f"estimated={quote.estimate.toAmount}"
        )

        return quote

    async def check_and_approve(
        self,
        chain_id: int,
        token_address: str,
        spender_address: str,
        amount: str,
        from_address: str,
    ) -> str | None:
        """
        Step 2: Check token allowance and approve if needed.

        Args:
            chain_id: Chain ID
            token_address: Token to approve
            spender_address: Spender (LI.FI Diamond)
            amount: Amount to approve
            from_address: Token owner

        Returns:
            Approval tx hash if approval was sent, None if already approved
        """
        web3 = self._get_web3(chain_id)
        token = web3.eth.contract(
            address=web3.to_checksum_address(token_address),
            abi=ERC20_ABI,
        )

        # Check current allowance
        allowance = await token.functions.allowance(
            web3.to_checksum_address(from_address),
            web3.to_checksum_address(spender_address),
        ).call()

        amount_int = int(amount)
        if allowance >= amount_int:
            logger.info(f"Token already approved: allowance={allowance}")
            return None

        # Need to approve
        logger.info(f"Approving token: {token_address} for {spender_address}")

        private_key = self._get_private_key()
        account = web3.eth.account.from_key(private_key)

        # Build approval tx
        approve_tx = await token.functions.approve(
            web3.to_checksum_address(spender_address),
            2**256 - 1,  # Max approval
        ).build_transaction({
            "from": account.address,
            "nonce": await web3.eth.get_transaction_count(account.address),
            "gas": 100000,
            "gasPrice": await web3.eth.gas_price,
        })

        # Sign and send
        signed = account.sign_transaction(approve_tx)
        tx_hash = await web3.eth.send_raw_transaction(signed.raw_transaction)

        logger.info(f"Approval tx sent: {tx_hash.hex()}")

        # Wait for confirmation
        receipt = await web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt["status"] != 1:
            raise LiFiExecutionError(
                "Approval transaction failed",
                step="approve",
                details={"tx_hash": tx_hash.hex()},
            )

        return tx_hash.hex()

    async def execute(
        self,
        quote: QuoteResponse,
    ) -> str:
        """
        Step 3: Sign and submit the LI.FI transaction.

        Args:
            quote: Quote response from get_quote()

        Returns:
            Transaction hash
        """
        if not quote.transactionRequest:
            raise LiFiExecutionError(
                "Quote has no transaction request",
                step="execute",
            )

        tx_request = quote.transactionRequest
        chain_id = tx_request.chainId or quote.action.fromChainId
        web3 = self._get_web3(chain_id)

        private_key = self._get_private_key()
        account = web3.eth.account.from_key(private_key)

        # Check approval first
        if quote.estimate.approvalAddress:
            await self.check_and_approve(
                chain_id=chain_id,
                token_address=quote.action.fromToken.address,
                spender_address=quote.estimate.approvalAddress,
                amount=quote.estimate.fromAmount,
                from_address=account.address,
            )

        # Build transaction
        tx = {
            "to": web3.to_checksum_address(tx_request.to),
            "data": tx_request.data,
            "value": int(tx_request.value, 16) if tx_request.value.startswith("0x") else int(tx_request.value),
            "from": account.address,
            "nonce": await web3.eth.get_transaction_count(account.address),
            "chainId": chain_id,
        }

        # Gas estimation
        if tx_request.gasLimit:
            tx["gas"] = int(tx_request.gasLimit)
        else:
            tx["gas"] = await web3.eth.estimate_gas(tx)

        tx["gasPrice"] = await web3.eth.gas_price

        # Sign and send
        signed = account.sign_transaction(tx)
        tx_hash = await web3.eth.send_raw_transaction(signed.raw_transaction)

        logger.info(f"LI.FI transaction sent: {tx_hash.hex()}")

        return tx_hash.hex()

    async def wait_for_completion(
        self,
        tx_hash: str,
        from_chain: int,
        to_chain: int | None = None,
    ) -> StatusResponse:
        """
        Step 4: Poll status until transaction completes.

        Args:
            tx_hash: Transaction hash from execute()
            from_chain: Source chain ID
            to_chain: Destination chain ID (for cross-chain)

        Returns:
            Final status response
        """
        start_time = asyncio.get_event_loop().time()

        while True:
            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed > self.MAX_WAIT_TIME:
                raise LiFiExecutionError(
                    f"Transaction timeout after {self.MAX_WAIT_TIME}s",
                    step="status",
                    details={"tx_hash": tx_hash},
                )

            async with self.lifi_client:
                status = await self.lifi_client.get_status(
                    tx_hash=tx_hash,
                    from_chain=from_chain,
                    to_chain=to_chain,
                )

            logger.info(f"Transaction status: {status.status} ({status.substatus})")

            if status.is_complete:
                return status

            if status.is_failed:
                raise LiFiExecutionError(
                    f"Transaction failed: {status.substatusMessage}",
                    step="status",
                    details={"tx_hash": tx_hash, "status": status.model_dump()},
                )

            await asyncio.sleep(self.POLL_INTERVAL)

    async def execute_full_flow(
        self,
        from_chain: int,
        from_token: str,
        from_amount: str,
        to_chain: int,
        to_token: str,
        from_address: str,
        slippage: float = 0.03,
    ) -> dict[str, Any]:
        """
        Execute complete LI.FI flow: quote -> approve -> execute -> wait.

        Args:
            from_chain: Source chain ID
            from_token: Source token address
            from_amount: Amount in smallest unit
            to_chain: Destination chain ID
            to_token: Destination token address
            from_address: Sender address (vault)
            slippage: Slippage tolerance

        Returns:
            Dict with execution results
        """
        # Step 1: Get quote
        quote = await self.get_quote(
            from_chain=from_chain,
            from_token=from_token,
            from_amount=from_amount,
            to_chain=to_chain,
            to_token=to_token,
            from_address=from_address,
            slippage=slippage,
        )

        # Step 2 & 3: Approve (if needed) and execute
        tx_hash = await self.execute(quote)

        # Step 4: Wait for completion
        final_status = await self.wait_for_completion(
            tx_hash=tx_hash,
            from_chain=from_chain,
            to_chain=to_chain if from_chain != to_chain else None,
        )

        return {
            "quote_id": quote.id,
            "tx_hash": tx_hash,
            "from_chain": from_chain,
            "to_chain": to_chain,
            "from_token": quote.action.fromToken.symbol,
            "to_token": quote.action.toToken.symbol,
            "from_amount": quote.estimate.fromAmount,
            "to_amount": final_status.receiving.get("amount") if final_status.receiving else quote.estimate.toAmount,
            "status": final_status.status,
            "tool": quote.tool,
        }
