import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, arbitrum, optimism } from "viem/chains";
import { http, fallback } from "wagmi";

export const wagmiConfig = getDefaultConfig({
  appName: "ZeusFi",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "placeholder",
  chains: [base, arbitrum, optimism],
  transports: {
    [base.id]: import.meta.env.VITE_BASE_RPC_URL
      ? http(import.meta.env.VITE_BASE_RPC_URL)
      : fallback([
          http("https://base-rpc.publicnode.com"),
          http("https://base.llamarpc.com"),
          http("https://mainnet.base.org"),
        ]),
    [arbitrum.id]: import.meta.env.VITE_ARBITRUM_RPC_URL
      ? http(import.meta.env.VITE_ARBITRUM_RPC_URL)
      : fallback([
          http("https://arbitrum-one-rpc.publicnode.com"),
          http("https://arb1.arbitrum.io/rpc"),
        ]),
    [optimism.id]: import.meta.env.VITE_OPTIMISM_RPC_URL
      ? http(import.meta.env.VITE_OPTIMISM_RPC_URL)
      : fallback([
          http("https://optimism-rpc.publicnode.com"),
          http("https://mainnet.optimism.io"),
        ]),
  },
});
