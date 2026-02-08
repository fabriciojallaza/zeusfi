"""
Chain configurations for ZeusFi.

Supported chains: Base, Arbitrum, Optimism (NOT Ethereum mainnet for vaults)
ENS is always read from Ethereum mainnet.
"""

import os

from typing import TypedDict


class ChainConfig(TypedDict):
    name: str
    rpc: str
    explorer: str
    usdc: str


SUPPORTED_CHAINS: dict[int, ChainConfig] = {
    8453: {
        "name": "base",
        "rpc": os.environ.get("BASE_RPC_URL", "https://base-rpc.publicnode.com"),
        "explorer": "https://basescan.org",
        "usdc": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
    42161: {
        "name": "arbitrum",
        "rpc": os.environ.get("ARBITRUM_RPC_URL", "https://arbitrum-one-rpc.publicnode.com"),
        "explorer": "https://arbiscan.io",
        "usdc": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    },
    10: {
        "name": "optimism",
        "rpc": os.environ.get("OPTIMISM_RPC_URL", "https://optimism-rpc.publicnode.com"),
        "explorer": "https://optimistic.etherscan.io",
        "usdc": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    },
}

# ENS is always read from Ethereum mainnet
ETHEREUM_RPC = "https://eth.llamarpc.com"

# Chain ID to name mapping for easy lookup
CHAIN_ID_TO_NAME: dict[int, str] = {
    chain_id: config["name"] for chain_id, config in SUPPORTED_CHAINS.items()
}

# Name to chain ID mapping
NAME_TO_CHAIN_ID: dict[str, int] = {
    config["name"]: chain_id for chain_id, config in SUPPORTED_CHAINS.items()
}


def get_chain_config(chain_id: int) -> ChainConfig | None:
    """Get chain configuration by chain ID."""
    return SUPPORTED_CHAINS.get(chain_id)


def get_usdc_address(chain_id: int) -> str | None:
    """Get USDC address for a specific chain."""
    config = SUPPORTED_CHAINS.get(chain_id)
    return config["usdc"] if config else None


def is_supported_chain(chain_id: int) -> bool:
    """Check if a chain is supported."""
    return chain_id in SUPPORTED_CHAINS
