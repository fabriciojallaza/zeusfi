export const LIFI_DIAMOND = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE" as const;

export const VAULT_FACTORIES: Record<number, `0x${string}` | null> = {
  8453: "0xD7AF8f7FB8C660Faa3A2Db18F9eA3813be53f33F", // Base
  42161: "0x527D8f5BB70ed1d790De992303690e501C8C0851", // Arbitrum
  10: "0x527D8f5BB70ed1d790De992303690e501C8C0851", // Optimism
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
