"""
Protocol vault addresses for supported chains.

Protocols: Aave V3, Morpho, Euler
Token: USDC only (MVP)
"""

# USDC addresses per chain
USDC_ADDRESSES: dict[int, str] = {
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # Base
    42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",  # Arbitrum
    10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",  # Optimism
}

# Aave V3 Pools (supply to get aUSDC)
AAVE_V3_POOLS: dict[int, str] = {
    8453: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",  # Base
    42161: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",  # Arbitrum
    10: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",  # Optimism
}

# Morpho Vaults (USDC)
MORPHO_VAULTS: dict[int, str | None] = {
    8453: "0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183",  # Base Steakhouse
    10: None,  # Optimism Gauntlet USDC Prime - TODO: confirm address from app.morpho.org
}

# Euler Vaults (USDC) - ERC4626 Earn vaults
EULER_VAULTS: dict[int, str] = {
    8453: "0x0A1a3b5f2041F33522C4efc754a7D096f880eE16",  # Euler Base USDC
    42161: "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899",  # Euler Arbitrum USDC
}

# LI.FI uses vault tokens (aUSDC, etc.) as toToken for Composer
AAVE_AUSDC: dict[int, str] = {
    8453: "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB",  # Base aUSDC
    42161: "0x724dc807b04555b71ed48a6896b6F41593b8C637",  # Arbitrum aUSDC
    10: "0x625E7708f30cA75bfd92586e17077590C60eb4cD",  # Optimism aOptUSDC
}

# Protocol identifiers (matching DeFiLlama project names)
SUPPORTED_PROTOCOLS = ["aave-v3", "morpho-v1", "euler-v2"]

# Risk scores by protocol (1-10, lower is safer)
PROTOCOL_RISK_SCORES: dict[str, int] = {
    "aave-v3": 2,  # Battle-tested, blue chip
    "morpho-v1": 4,  # Curated vaults, audited
    "euler-v2": 5,  # Rebuilt after v1 exploit, audited
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


def get_deposit_token(protocol: str, chain_id: int) -> str | None:
    """Get the LI.FI Composer deposit token for a protocol on a chain.

    For Aave: aUSDC receipt token
    For Morpho/Euler: ERC4626 vault address (vault IS the share token)
    """
    if protocol == "aave-v3":
        return AAVE_AUSDC.get(chain_id)
    elif protocol == "morpho-v1":
        return MORPHO_VAULTS.get(chain_id)
    elif protocol == "euler-v2":
        return EULER_VAULTS.get(chain_id)
    return None


# Map short ENS protocol names to DeFiLlama project names
ENS_TO_DEFILLAMA_PROTOCOL: dict[str, str] = {
    "aave": "aave-v3",
    "aave-v3": "aave-v3",
    "morpho": "morpho-v1",
    "morpho-v1": "morpho-v1",
    "euler": "euler-v2",
    "euler-v2": "euler-v2",
}


def map_ens_protocols(ens_protocols: list[str]) -> list[str]:
    """Map short ENS protocol names to DeFiLlama project names."""
    return [
        ENS_TO_DEFILLAMA_PROTOCOL[p.lower()]
        for p in ens_protocols
        if p.lower() in ENS_TO_DEFILLAMA_PROTOCOL
    ]


def is_supported_protocol(protocol: str) -> bool:
    """Check if a protocol is supported."""
    return protocol.lower() in SUPPORTED_PROTOCOLS


def get_usdc_address(chain_id: int) -> str | None:
    """Get USDC token address for a chain."""
    return USDC_ADDRESSES.get(chain_id)
