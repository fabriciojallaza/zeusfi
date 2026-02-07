import { base, arbitrum, optimism } from "viem/chains";

export const SUPPORTED_CHAINS = [base, arbitrum, optimism] as const;

export interface ChainMeta {
  name: string;
  icon: string;
  color: string;
  explorer: string;
  usdc: `0x${string}`;
}

export const CHAIN_CONFIG: Record<number, ChainMeta> = {
  [base.id]: {
    name: "Base",
    icon: "\u2B21",
    color: "#0052FF",
    explorer: "https://basescan.org",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  [arbitrum.id]: {
    name: "Arbitrum",
    icon: "\u25C6",
    color: "#28A0F0",
    explorer: "https://arbiscan.io",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  },
  [optimism.id]: {
    name: "Optimism",
    icon: "\u2B24",
    color: "#FF0420",
    explorer: "https://optimistic.etherscan.io",
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  },
};

export function getChainMeta(chainId: number): ChainMeta | undefined {
  return CHAIN_CONFIG[chainId];
}

export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const meta = CHAIN_CONFIG[chainId];
  if (!meta) return "#";
  return `${meta.explorer}/tx/${txHash}`;
}
