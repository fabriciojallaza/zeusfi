"""
Vault address resolution via protocol-native APIs.

Resolves DeFiLlama pool entries to on-chain vault contract addresses:

- Morpho: Public GraphQL API (api.morpho.org/graphql) — match by symbol + chain
- Euler: Goldsky subgraph (free, no auth) — match by vault name (poolMeta) + chain
- Aave: Hardcoded aUSDC per chain (handled in _resolve_aave_addresses)
"""

import asyncio
import logging

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from config.protocols import USDC_ADDRESSES

logger = logging.getLogger(__name__)

MORPHO_GRAPHQL_URL = "https://api.morpho.org/graphql"

EULER_GOLDSKY_ENDPOINTS: dict[int, str] = {
    8453: (
        "https://api.goldsky.com/api/public/"
        "project_cm4iagnemt1wp01xn4gh1agft/subgraphs/euler-v2-base/latest/gn"
    ),
    42161: (
        "https://api.goldsky.com/api/public/"
        "project_cm4iagnemt1wp01xn4gh1agft/subgraphs/euler-v2-arbitrum/latest/gn"
    ),
}

# Euler: (vault_name, chain_id) -> vault_address
VaultMapping = dict[tuple[str, int], str]

# Morpho: (symbol, chain_id) -> list of (address, tvl_usd)
# Multiple vaults can share the same symbol; caller resolves by TVL proximity
MorphoVaultMapping = dict[tuple[str, int], list[tuple[str, float]]]


async def fetch_morpho_vault_mapping() -> MorphoVaultMapping:
    """
    Fetch Morpho USDC vault candidates from their public GraphQL API.

    Queries both V1 (MetaMorpho) and V2 vaults, filtered to our supported chains.
    DeFiLlama lists both under project="morpho-v1".

    Returns:
        Mapping of (vault_symbol, chain_id) -> list of (address, tvl_usd).
        When a symbol is unique on a chain, the list has one entry.
        When duplicates exist, the caller matches by TVL proximity to DeFiLlama.
    """
    usdc_set = {addr.lower() for addr in USDC_ADDRESSES.values()}
    supported_chain_ids = list(USDC_ADDRESSES.keys())

    v1_query = """
    query($chains: [Int!]) {
      vaults(first: 1000, where: { chainId_in: $chains }) {
        items {
          address
          symbol
          asset { address }
          chain { id }
          state { totalAssetsUsd }
        }
      }
    }
    """

    v2_query = """
    query($chains: [Int!]) {
      vaultV2s(first: 1000, where: { chainId_in: $chains }) {
        items {
          address
          symbol
          asset { address }
          chain { id }
          totalAssetsUsd
        }
      }
    }
    """

    variables = {"chains": supported_chain_ids}

    async with httpx.AsyncClient(timeout=30.0) as client:
        r1, r2 = await asyncio.gather(
            client.post(
                MORPHO_GRAPHQL_URL, json={"query": v1_query, "variables": variables}
            ),
            client.post(
                MORPHO_GRAPHQL_URL, json={"query": v2_query, "variables": variables}
            ),
        )
        r1.raise_for_status()
        r2.raise_for_status()

    v1_items = r1.json().get("data", {}).get("vaults", {}).get("items", [])
    v2_items = r2.json().get("data", {}).get("vaultV2s", {}).get("items", [])
    all_items = v1_items + v2_items

    logger.info(f"Morpho: Fetched {len(v1_items)} V1 + {len(v2_items)} V2 vaults")

    mapping: MorphoVaultMapping = {}

    for vault in all_items:
        chain_id = vault.get("chain", {}).get("id")
        asset_addr = vault.get("asset", {}).get("address", "").lower()

        if chain_id not in supported_chain_ids:
            continue
        if asset_addr not in usdc_set:
            continue

        symbol = vault.get("symbol", "")
        address = vault.get("address", "")

        if not symbol or not address:
            continue

        # V1 nests TVL under state{}, V2 has it at top level
        tvl = (
            vault.get("state", {}).get("totalAssetsUsd")
            or vault.get("totalAssetsUsd")
            or 0
        )
        tvl = float(tvl)
        key = (symbol.upper(), chain_id)
        mapping.setdefault(key, []).append((address, tvl))

    total_unique = sum(1 for v in mapping.values() if len(v) == 1)
    total_dupes = sum(1 for v in mapping.values() if len(v) > 1)

    logger.info(
        f"Morpho: Resolved {len(mapping)} USDC vault symbols "
        f"({total_unique} unique, {total_dupes} with duplicates)"
    )
    return mapping


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
)
async def _fetch_euler_chain(chain_id: int, endpoint: str) -> VaultMapping:
    """Fetch Euler USDC vaults from Goldsky subgraph for one chain."""
    usdc_addr = USDC_ADDRESSES.get(chain_id, "").lower()

    query = """
    query {
      eulerVaults(first: 1000) {
        id
        name
        symbol
        asset
      }
    }
    """

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(endpoint, json={"query": query})
        resp.raise_for_status()
        data = resp.json()

    vaults = data.get("data", {}).get("eulerVaults", [])

    mapping: VaultMapping = {}
    for vault in vaults:
        if vault.get("asset", "").lower() != usdc_addr:
            continue

        name = vault.get("name", "")
        address = vault.get("id", "")

        if not name or not address:
            continue

        mapping[(name, chain_id)] = address

    logger.info(f"Euler: Resolved {len(mapping)} USDC vaults on chain {chain_id}")
    return mapping


async def fetch_euler_vault_mapping() -> VaultMapping:
    """
    Fetch Euler USDC vault addresses from Goldsky subgraphs (all chains).

    Returns:
        Mapping of (vault_name, chain_id) -> vault_address.
        Vault name matches DeFiLlama's poolMeta field (e.g. "EVK Vault eUSDC-5").
    """
    tasks = [_fetch_euler_chain(cid, ep) for cid, ep in EULER_GOLDSKY_ENDPOINTS.items()]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    combined: VaultMapping = {}
    for result in results:
        if isinstance(result, Exception):
            logger.error(f"Euler vault fetch failed: {result}")
            continue
        combined.update(result)

    return combined
