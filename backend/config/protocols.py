"""
Protocol vault addresses for supported chains.

Protocols: Aave V3, Morpho, Euler
Token: USDC only (MVP)
"""

# USDC addresses per chain
USDC_ADDRESSES: dict[int, str] = {
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # Base
    42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",  # Arbitrum
    43114: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",  # Avalanche
}

# Aave V3 Pools (supply to get aUSDC)
AAVE_V3_POOLS: dict[int, str] = {
    8453: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",  # Base
    42161: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",  # Arbitrum
    43114: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",  # Avalanche
}

# Morpho Vaults (USDC)
MORPHO_VAULTS: dict[int, str] = {
    8453: "0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183",  # Base Steakhouse
}

# Euler Vaults (USDC) - To be determined after deployment
EULER_VAULTS: dict[int, str] = {
    # 42161: "0x...",  # Arbitrum - TBD
}

# LI.FI uses vault tokens (aUSDC, etc.) as toToken for Composer
AAVE_AUSDC: dict[int, str] = {
    8453: "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB",  # Base aUSDC
    42161: "0x724dc807b04555b71ed48a6896b6F41593b8C637",  # Arbitrum aUSDC
    43114: "0x625E7708f30cA75bfd92586e17077590C60eb4cD",  # Avalanche aUSDC
}

# Protocol identifiers (matching DeFiLlama project names)
SUPPORTED_PROTOCOLS = ["aave-v3", "morpho", "euler"]

# Risk scores by protocol (1-10, lower is safer)
PROTOCOL_RISK_SCORES: dict[str, int] = {
    "aave-v3": 2,  # Battle-tested, blue chip
    "morpho": 4,  # Newer but audited
    "euler": 5,  # Rebuilding after v1 exploit
}


def get_aave_pool(chain_id: int) -> str | None:
    """Get Aave V3 pool address for a chain."""
    return AAVE_V3_POOLS.get(chain_id)


def get_morpho_vault(chain_id: int) -> str | None:
    """Get Morpho vault address for a chain."""
    return MORPHO_VAULTS.get(chain_id)


def get_euler_vault(chain_id: int) -> str | None:
    """Get Euler vault address for a chain."""
    return EULER_VAULTS.get(chain_id)


def get_aave_ausdc(chain_id: int) -> str | None:
    """Get aUSDC token address for a chain (for LI.FI Composer)."""
    return AAVE_AUSDC.get(chain_id)


def is_supported_protocol(protocol: str) -> bool:
    """Check if a protocol is supported."""
    return protocol.lower() in SUPPORTED_PROTOCOLS


def get_usdc_address(chain_id: int) -> str | None:
    """Get USDC token address for a chain."""
    return USDC_ADDRESSES.get(chain_id)
