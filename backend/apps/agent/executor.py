"""
Vault strategy executor — calls executeStrategy on YieldVault via agent wallet.

The agent wallet signs transactions that tell a user's vault to:
1. Approve USDC to LI.FI Diamond
2. Execute the LI.FI calldata (swap/bridge/deposit into protocol)
"""

import logging

from web3 import AsyncWeb3
from web3.providers import AsyncHTTPProvider

from config.chains import SUPPORTED_CHAINS
from config.protocols import USDC_ADDRESSES, get_deposit_token
from integrations.contracts.abis import YIELD_VAULT_ABI
from integrations.lifi.client import LiFiClient

logger = logging.getLogger(__name__)


class VaultExecutionError(Exception):
    """Error during vault strategy execution."""

    def __init__(self, message: str, step: str, details: dict | None = None):
        super().__init__(message)
        self.step = step
        self.details = details or {}


class VaultExecutor:
    """
    Executes strategies on YieldVault contracts as the agent wallet.

    Flow for deploy_to_protocol:
    1. Get LI.FI quote: USDC -> deposit token (aUSDC / vault shares)
    2. Build vault.executeStrategy(usdc, amount, lifi_calldata) tx
    3. Sign as agent wallet, send tx, wait for receipt
    """

    def __init__(self, private_key: str | None = None):
        self.private_key = private_key
        self._web3_clients: dict[int, AsyncWeb3] = {}

    def _get_private_key(self) -> str:
        if self.private_key:
            return self.private_key
        from decouple import config

        pk = config("AGENT_WALLET_PRIVATE_KEY", default="")
        if not pk:
            raise VaultExecutionError(
                "Agent wallet private key not configured", step="init"
            )
        return pk

    def _get_web3(self, chain_id: int) -> AsyncWeb3:
        if chain_id not in self._web3_clients:
            chain_config = SUPPORTED_CHAINS.get(chain_id)
            if not chain_config:
                raise VaultExecutionError(f"Unsupported chain: {chain_id}", step="init")
            self._web3_clients[chain_id] = AsyncWeb3(
                AsyncHTTPProvider(chain_config["rpc"])
            )
        return self._web3_clients[chain_id]

    async def deploy_to_protocol(
        self,
        vault_address: str,
        chain_id: int,
        protocol: str,
        amount_wei: int,
    ) -> str:
        """
        Move idle USDC from vault into a DeFi protocol via LI.FI.

        Args:
            vault_address: YieldVault contract address
            chain_id: Chain where the vault lives
            protocol: Target protocol (aave-v3, morpho-v1, euler-v2)
            amount_wei: Amount of USDC in wei (6 decimals)

        Returns:
            Transaction hash
        """
        usdc_address = USDC_ADDRESSES.get(chain_id)
        deposit_token = get_deposit_token(protocol, chain_id)
        if not usdc_address or not deposit_token:
            raise VaultExecutionError(
                f"No USDC or deposit token for {protocol} on chain {chain_id}",
                step="config",
            )

        # 1. Get LI.FI quote: USDC -> deposit token (same chain)
        lifi_calldata = await self._get_lifi_calldata(
            from_chain=chain_id,
            from_token=usdc_address,
            from_amount=str(amount_wei),
            to_chain=chain_id,
            to_token=deposit_token,
            from_address=vault_address,
        )

        # 2. Call executeStrategy on the vault
        tx_hash = await self._call_execute_strategy(
            vault_address=vault_address,
            chain_id=chain_id,
            approve_token=usdc_address,
            approve_amount=amount_wei,
            lifi_data=lifi_calldata,
        )

        logger.info(
            f"Deployed {amount_wei} USDC to {protocol} on chain {chain_id}: {tx_hash}"
        )
        return tx_hash

    async def unwind_position(
        self,
        vault_address: str,
        chain_id: int,
        protocol: str,
        amount_wei: int,
    ) -> str:
        """
        Move funds from protocol back to USDC in vault (for withdrawal).

        Args:
            vault_address: YieldVault contract address
            chain_id: Chain where the vault lives
            protocol: Source protocol (aave-v3, morpho-v1, euler-v2)
            amount_wei: Amount of protocol tokens to unwind (in token wei)

        Returns:
            Transaction hash
        """
        usdc_address = USDC_ADDRESSES.get(chain_id)
        deposit_token = get_deposit_token(protocol, chain_id)
        if not usdc_address or not deposit_token:
            raise VaultExecutionError(
                f"No USDC or deposit token for {protocol} on chain {chain_id}",
                step="config",
            )

        # LI.FI quote: deposit token -> USDC (reverse of deploy)
        lifi_calldata = await self._get_lifi_calldata(
            from_chain=chain_id,
            from_token=deposit_token,
            from_amount=str(amount_wei),
            to_chain=chain_id,
            to_token=usdc_address,
            from_address=vault_address,
        )

        tx_hash = await self._call_execute_strategy(
            vault_address=vault_address,
            chain_id=chain_id,
            approve_token=deposit_token,
            approve_amount=amount_wei,
            lifi_data=lifi_calldata,
        )

        logger.info(f"Unwound {protocol} position on chain {chain_id}: {tx_hash}")
        return tx_hash

    async def rebalance(
        self,
        from_vault: str,
        from_chain: int,
        from_protocol: str,
        to_chain: int,
        to_protocol: str,
        amount_wei: int,
    ) -> str:
        """
        Move from protocol A to protocol B (same or cross chain).

        For same-chain: unwind A -> USDC -> deploy B (two txs).
        For cross-chain: unwind A -> bridge USDC -> deploy B.

        Returns:
            Transaction hash of the final operation
        """
        # Step 1: Unwind current position to USDC in vault
        unwind_hash = await self.unwind_position(
            vault_address=from_vault,
            chain_id=from_chain,
            protocol=from_protocol,
            amount_wei=amount_wei,
        )
        logger.info(f"Rebalance step 1 — unwind tx: {unwind_hash}")

        # Read USDC balance in vault after unwind
        w3 = self._get_web3(from_chain)
        vault_contract = w3.eth.contract(
            address=w3.to_checksum_address(from_vault),
            abi=YIELD_VAULT_ABI,
        )
        usdc_balance = await vault_contract.functions.getBalance().call()

        if usdc_balance == 0:
            raise VaultExecutionError("No USDC in vault after unwind", step="rebalance")

        # Step 2: Deploy to new protocol
        deploy_hash = await self.deploy_to_protocol(
            vault_address=from_vault,
            chain_id=to_chain if from_chain == to_chain else from_chain,
            protocol=to_protocol,
            amount_wei=usdc_balance,
        )
        logger.info(f"Rebalance step 2 — deploy tx: {deploy_hash}")

        return deploy_hash

    async def get_vault_balance(self, vault_address: str, chain_id: int) -> int:
        """Read USDC balance held in a vault (not in any protocol)."""
        w3 = self._get_web3(chain_id)
        vault = w3.eth.contract(
            address=w3.to_checksum_address(vault_address),
            abi=YIELD_VAULT_ABI,
        )
        return await vault.functions.getBalance().call()

    # --- Internal helpers ---

    async def _get_lifi_calldata(
        self,
        from_chain: int,
        from_token: str,
        from_amount: str,
        to_chain: int,
        to_token: str,
        from_address: str,
    ) -> bytes:
        """Get LI.FI transaction calldata for executeStrategy."""
        async with LiFiClient() as client:
            quote = await client.get_quote(
                from_chain=from_chain,
                from_token=from_token,
                from_amount=from_amount,
                to_chain=to_chain,
                to_token=to_token,
                from_address=from_address,
            )

        if not quote.transactionRequest:
            raise VaultExecutionError(
                "LI.FI quote has no transaction request", step="quote"
            )

        # The calldata is what gets passed to vault.executeStrategy
        data = quote.transactionRequest.data
        if isinstance(data, str):
            return bytes.fromhex(data.replace("0x", ""))
        return data

    async def _call_execute_strategy(
        self,
        vault_address: str,
        chain_id: int,
        approve_token: str,
        approve_amount: int,
        lifi_data: bytes,
    ) -> str:
        """Build, sign, and send executeStrategy transaction as agent wallet."""
        w3 = self._get_web3(chain_id)
        private_key = self._get_private_key()
        account = w3.eth.account.from_key(private_key)

        vault = w3.eth.contract(
            address=w3.to_checksum_address(vault_address),
            abi=YIELD_VAULT_ABI,
        )

        tx = await vault.functions.executeStrategy(
            w3.to_checksum_address(approve_token),
            approve_amount,
            lifi_data,
        ).build_transaction(
            {
                "from": account.address,
                "nonce": await w3.eth.get_transaction_count(account.address),
                "chainId": chain_id,
                "gasPrice": await w3.eth.gas_price,
            }
        )

        # Estimate gas with buffer
        try:
            gas_estimate = await w3.eth.estimate_gas(tx)
            tx["gas"] = int(gas_estimate * 1.2)
        except Exception as e:
            logger.warning(f"Gas estimation failed, using default: {e}")
            tx["gas"] = 500_000

        signed = account.sign_transaction(tx)
        tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)

        # Wait for receipt
        receipt = await w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt["status"] != 1:
            raise VaultExecutionError(
                "executeStrategy transaction reverted",
                step="execute",
                details={"tx_hash": tx_hash.hex(), "chain_id": chain_id},
            )

        return tx_hash.hex()
