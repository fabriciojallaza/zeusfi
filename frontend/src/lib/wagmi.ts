import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, arbitrum, optimism } from "viem/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "ZeusFi",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "placeholder",
  chains: [base, arbitrum, optimism],
});
