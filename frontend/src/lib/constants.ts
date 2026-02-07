export const LIFI_DIAMOND = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE" as const;

// VaultFactory addresses (ERC-1167 clone pattern)
export const VAULT_FACTORIES: Record<number, `0x${string}` | null> = {
  8453: "0x050E41182DF125D2Ad1A8bbcaD26994f0eC8BAAd", // Base
  42161: "0xD7AF8f7FB8C660Faa3A2Db18F9eA3813be53f33F", // Arbitrum
  10: "0xD7AF8f7FB8C660Faa3A2Db18F9eA3813be53f33F", // Optimism
};

export const USDC_DECIMALS = 6;

export const PROTOCOL_DISPLAY: Record<string, string> = {
  "aave-v3": "Aave V3",
  "morpho-v1": "Morpho",
  "euler-v2": "Euler V2",
};

/**
 * Coerce a value that might be a string (from Django DecimalField)
 * into a number. Returns 0 for null/undefined.
 */
export function toNum(val: unknown): number {
  if (val == null) return 0;
  const n = Number(val);
  return Number.isNaN(n) ? 0 : n;
}
