export interface AssetConfig {
  symbol: string;
  name: string;
  icon: string;
  color: string;
  decimals: number;
  isActive: boolean;
  addresses: Record<number, `0x${string}` | null>;
}

/** Read balances from Base chain for MVP */
export const BALANCE_CHAIN_ID = 8453;

export const SUPPORTED_ASSETS: AssetConfig[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    icon: "$",
    color: "#2775CA",
    decimals: 6,
    isActive: true,
    addresses: {
      8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    },
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    icon: "\u039E",
    color: "#627EEA",
    decimals: 18,
    isActive: false,
    addresses: {},
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    icon: "\u20AE",
    color: "#26A17B",
    decimals: 6,
    isActive: false,
    addresses: {},
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    icon: "\u20BF",
    color: "#F7931A",
    decimals: 8,
    isActive: false,
    addresses: {},
  },
];

export function getAssetBySymbol(symbol: string): AssetConfig | undefined {
  return SUPPORTED_ASSETS.find(
    (a) => a.symbol.toUpperCase() === symbol.toUpperCase(),
  );
}
