"""
Contract addresses for ZeusFi infrastructure.

LI.FI Diamond, VaultFactory, Treasury addresses.
"""

# LI.FI Diamond (same on all chains)
LIFI_DIAMOND = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE"

# VaultFactory addresses (deployed per chain)
# To be filled after contract deployment
VAULT_FACTORIES: dict[int, str | None] = {
    8453: None,   # Base - to be deployed
    42161: None,  # Arbitrum - to be deployed
    43114: None,  # Avalanche - to be deployed
}

# Treasury address (receives 10% performance fee)
# To be set after treasury deployment
TREASURY: str | None = None

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
