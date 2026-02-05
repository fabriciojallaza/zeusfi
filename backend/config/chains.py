"""
Chain configurations for ZeusFi.

Supported chains: Base, Arbitrum, Avalanche (NOT Ethereum mainnet for vaults)
ENS is always read from Ethereum mainnet.
"""

from typing import TypedDict


class ChainConfig(TypedDict):
    name: str
    rpc: str
    explorer: str
    usdc: str


SUPPORTED_CHAINS: dict[int, ChainConfig] = {
    8453: {
        "name": "base",
        "rpc": "https://mainnet.base.org",
        "explorer": "https://basescan.org",
        "usdc": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
    42161: {
        "name": "arbitrum",
        "rpc": "https://arb1.arbitrum.io/rpc",
        "explorer": "https://arbiscan.io",
        "usdc": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    },
    43114: {
        "name": "avalanche",
        "rpc": "https://api.avax.network/ext/bc/C/rpc",
        "explorer": "https://snowtrace.io",
        "usdc": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
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
