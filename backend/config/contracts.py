"""
Contract addresses for ZeusFi infrastructure.

LI.FI Diamond, VaultFactory, Treasury addresses.
"""

# LI.FI Diamond (same on all chains)
LIFI_DIAMOND = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE"

# VaultFactory addresses (deployed per chain)
# To be filled after contract deployment
VAULT_FACTORIES: dict[int, str | None] = {
    8453: "0xD7AF8f7FB8C660Faa3A2Db18F9eA3813be53f33F",  # Base
    42161: "0x527D8f5BB70ed1d790De992303690e501C8C0851",  # Arbitrum
    10: "0x527D8f5BB70ed1d790De992303690e501C8C0851",  # Optimism
}

# Treasury address (receives 10% performance fee)
TREASURY: str = "0x6aEE0C194C256DE082e29475447Fd2d7134a6e44"

# Agent Wallet address (EOA that executes strategies)
# This is loaded from environment variable AGENT_WALLET_ADDRESS
# for security reasons, not hardcoded here


def get_vault_factory(chain_id: int) -> str | None:
    """Get VaultFactory address for a chain."""
    return VAULT_FACTORIES.get(chain_id)


def is_factory_deployed(chain_id: int) -> bool:
    """Check if VaultFactory is deployed on a chain."""
    factory = VAULT_FACTORIES.get(chain_id)
    return factory is not None
