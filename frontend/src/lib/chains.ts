import { base, arbitrum, avalanche } from "viem/chains";

export const SUPPORTED_CHAINS = [base, arbitrum, avalanche] as const;

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
  [avalanche.id]: {
    name: "Avalanche",
    icon: "\u25B2",
    color: "#E84142",
    explorer: "https://snowtrace.io",
    usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
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
