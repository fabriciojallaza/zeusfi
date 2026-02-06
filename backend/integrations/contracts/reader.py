"""
On-chain contract reader for positions and balances.

Reads vault balances across Aave, Morpho, and Euler protocols.
"""

import logging
from decimal import Decimal

from web3 import AsyncWeb3
from web3.providers import AsyncHTTPProvider

from config.chains import SUPPORTED_CHAINS
from config.protocols import (
    AAVE_AUSDC,
    MORPHO_VAULTS,
    EULER_VAULTS,
    USDC_ADDRESSES,
)
from .abis import (
    ERC20_ABI,
    AAVE_ATOKEN_ABI,
    MORPHO_VAULT_ABI,
    EULER_VAULT_ABI,
)

logger = logging.getLogger(__name__)


class PositionInfo:
    """Position information from on-chain reading."""

    def __init__(
        self,
        chain_id: int,
        protocol: str,
        token: str,
        amount: Decimal,
        amount_usd: Decimal,
        vault_token_address: str | None = None,
    ):
        self.chain_id = chain_id
        self.protocol = protocol
        self.token = token
        self.amount = amount  # In token decimals (e.g., 6 for USDC)
        self.amount_usd = amount_usd  # Same as amount for stablecoins
        self.vault_token_address = vault_token_address

    def to_dict(self) -> dict:
        return {
            "chain_id": self.chain_id,
            "protocol": self.protocol,
            "token": self.token,
            "amount": str(self.amount),
            "amount_usd": str(self.amount_usd),
            "vault_token_address": self.vault_token_address,
        }


class ContractReader:
    """
    Read on-chain positions and balances.

    Usage:
        reader = ContractReader()
        positions = await reader.get_all_positions(vault_address, chain_id)
    """

    # USDC has 6 decimals on all chains
    USDC_DECIMALS = 6

    def __init__(self):
        self._web3_clients: dict[int, AsyncWeb3] = {}

    def _get_web3(self, chain_id: int) -> AsyncWeb3:
        """Get or create Web3 client for chain."""
        if chain_id not in self._web3_clients:
            chain_config = SUPPORTED_CHAINS.get(chain_id)
            if not chain_config:
                raise ValueError(f"Unsupported chain: {chain_id}")

            provider = AsyncHTTPProvider(chain_config["rpc"])
            self._web3_clients[chain_id] = AsyncWeb3(provider)

        return self._web3_clients[chain_id]

    async def get_token_balance(
        self,
        chain_id: int,
        token_address: str,
        wallet_address: str,
    ) -> Decimal:
        """
        Get ERC20 token balance.

        Returns balance in human-readable format (divided by decimals).
        """
        w3 = self._get_web3(chain_id)

        contract = w3.eth.contract(
            address=w3.to_checksum_address(token_address),
            abi=ERC20_ABI,
        )

        try:
            balance = await contract.functions.balanceOf(
                w3.to_checksum_address(wallet_address)
            ).call()

            decimals = await contract.functions.decimals().call()

            return Decimal(balance) / Decimal(10**decimals)
        except Exception as e:
            logger.error(f"Error reading balance for {token_address}: {e}")
            return Decimal(0)

    async def get_usdc_balance(
        self,
        chain_id: int,
        wallet_address: str,
    ) -> Decimal:
        """Get USDC balance for wallet on chain."""
        usdc_address = USDC_ADDRESSES.get(chain_id)
        if not usdc_address:
            return Decimal(0)

        return await self.get_token_balance(chain_id, usdc_address, wallet_address)

    async def get_aave_position(
        self,
        chain_id: int,
        vault_address: str,
    ) -> PositionInfo | None:
        """
        Get Aave V3 position (aUSDC balance).

        aUSDC balance automatically includes accrued interest.
        """
        ausdc_address = AAVE_AUSDC.get(chain_id)
        if not ausdc_address:
            return None

        w3 = self._get_web3(chain_id)

        try:
            contract = w3.eth.contract(
                address=w3.to_checksum_address(ausdc_address),
                abi=AAVE_ATOKEN_ABI,
            )

            balance = await contract.functions.balanceOf(
                w3.to_checksum_address(vault_address)
            ).call()

            if balance == 0:
                return None

            # aUSDC has same decimals as USDC (6)
            amount = Decimal(balance) / Decimal(10**self.USDC_DECIMALS)

            return PositionInfo(
                chain_id=chain_id,
                protocol="aave-v3",
                token="USDC",
                amount=amount,
                amount_usd=amount,  # 1:1 for USDC
                vault_token_address=ausdc_address,
            )
        except Exception as e:
            logger.error(f"Error reading Aave position on chain {chain_id}: {e}")
            return None

    async def get_morpho_position(
        self,
        chain_id: int,
        vault_address: str,
    ) -> PositionInfo | None:
        """
        Get Morpho vault position.

        Morpho vaults are ERC4626 - shares need conversion to assets.
        """
        morpho_vault = MORPHO_VAULTS.get(chain_id)
        if not morpho_vault:
            return None

        w3 = self._get_web3(chain_id)

        try:
            contract = w3.eth.contract(
                address=w3.to_checksum_address(morpho_vault),
                abi=MORPHO_VAULT_ABI,
            )

            # Get share balance
            shares = await contract.functions.balanceOf(
                w3.to_checksum_address(vault_address)
            ).call()

            if shares == 0:
                return None

            # Convert shares to underlying assets (USDC)
            assets = await contract.functions.convertToAssets(shares).call()

            amount = Decimal(assets) / Decimal(10**self.USDC_DECIMALS)

            return PositionInfo(
                chain_id=chain_id,
                protocol="morpho-v1",
                token="USDC",
                amount=amount,
                amount_usd=amount,
                vault_token_address=morpho_vault,
            )
        except Exception as e:
            logger.error(f"Error reading Morpho position on chain {chain_id}: {e}")
            return None

    async def get_euler_position(
        self,
        chain_id: int,
        vault_address: str,
    ) -> PositionInfo | None:
        """
        Get Euler vault position.

        Euler vaults are ERC4626 compatible.
        """
        euler_vault = EULER_VAULTS.get(chain_id)
        if not euler_vault:
            return None

        w3 = self._get_web3(chain_id)

        try:
            contract = w3.eth.contract(
                address=w3.to_checksum_address(euler_vault),
                abi=EULER_VAULT_ABI,
            )

            shares = await contract.functions.balanceOf(
                w3.to_checksum_address(vault_address)
            ).call()

            if shares == 0:
                return None

            assets = await contract.functions.convertToAssets(shares).call()

            amount = Decimal(assets) / Decimal(10**self.USDC_DECIMALS)

            return PositionInfo(
                chain_id=chain_id,
                protocol="euler-v2",
                token="USDC",
                amount=amount,
                amount_usd=amount,
                vault_token_address=euler_vault,
            )
        except Exception as e:
            logger.error(f"Error reading Euler position on chain {chain_id}: {e}")
            return None

    async def get_all_positions(
        self,
        vault_address: str,
        chain_id: int,
    ) -> list[PositionInfo]:
        """
        Get all positions for a vault on a specific chain.

        Checks Aave, Morpho, and Euler for any deposited funds.
        """
        positions = []

        # Check each protocol
        aave_pos = await self.get_aave_position(chain_id, vault_address)
        if aave_pos:
            positions.append(aave_pos)

        morpho_pos = await self.get_morpho_position(chain_id, vault_address)
        if morpho_pos:
            positions.append(morpho_pos)

        euler_pos = await self.get_euler_position(chain_id, vault_address)
        if euler_pos:
            positions.append(euler_pos)

        # Also check raw USDC balance (not deployed to any protocol)
        usdc_balance = await self.get_usdc_balance(chain_id, vault_address)
        if usdc_balance > Decimal("0.01"):  # Ignore dust
            positions.append(
                PositionInfo(
                    chain_id=chain_id,
                    protocol="wallet",  # Not deployed
                    token="USDC",
                    amount=usdc_balance,
                    amount_usd=usdc_balance,
                    vault_token_address=USDC_ADDRESSES.get(chain_id),
                )
            )

        return positions

    async def get_positions_all_chains(
        self,
        vault_addresses: dict[int, str],
    ) -> list[PositionInfo]:
        """
        Get positions across all chains for a user.

        Args:
            vault_addresses: Dict of {chain_id: vault_address}

        Returns:
            List of all positions across all chains
        """
        all_positions = []

        for chain_id, vault_address in vault_addresses.items():
            positions = await self.get_all_positions(vault_address, chain_id)
            all_positions.extend(positions)

        return all_positions

    async def get_total_value(
        self,
        vault_addresses: dict[int, str],
    ) -> Decimal:
        """Get total USD value across all positions."""
        positions = await self.get_positions_all_chains(vault_addresses)
        return sum(p.amount_usd for p in positions)


# Singleton for reuse
_reader_instance: ContractReader | None = None


def get_contract_reader() -> ContractReader:
    """Get singleton ContractReader instance."""
    global _reader_instance
    if _reader_instance is None:
        _reader_instance = ContractReader()
    return _reader_instance
