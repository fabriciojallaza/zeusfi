import { Shield, CheckCircle2 } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { ERC20_ABI } from "@/lib/contracts";
import { CHAIN_CONFIG } from "@/lib/chains";
import { USDC_DECIMALS } from "@/lib/constants";
import { formatUnits } from "viem";

export function Header() {
  const { address, isConnected, chain } = useAccount();
  const { isAuthenticated } = useAuth();
  const wallet = useAuthStore((s) => s.wallet);

  const usdcAddress = chain?.id
    ? (CHAIN_CONFIG[chain.id]?.usdc as `0x${string}`)
    : undefined;

  const { data: rawBalance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!usdcAddress && !!address && isConnected },
  });

  const usdcBalance = rawBalance
    ? parseFloat(formatUnits(rawBalance as bigint, USDC_DECIMALS))
    : undefined;

  const chainName = chain?.id ? CHAIN_CONFIG[chain.id]?.name : undefined;

  const ensStrategy = wallet
    ? `${wallet.ens_max_risk ? capitalize(wallet.ens_max_risk) : "Balanced"} Strategy${wallet.ens_min_apy ? ` (Min ${wallet.ens_min_apy}% APY)` : ""}`
    : undefined;

  return (
    <header className="border-b-2 border-[#1e2433] bg-[#0a0e1a] sticky top-0 z-40 backdrop-blur-sm bg-opacity-95">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#10b981] to-[#3b82f6]">
              <span className="text-xl font-bold text-white">⚡</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">ZeusFi</h1>
              <p className="text-xs font-mono text-[#8b92a8]">
                AI Yield Agent
              </p>
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {isConnected && isAuthenticated && wallet && (
              <>
                {/* ENS Profile Card */}
                <div className="hidden lg:flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#10b981]/10 to-[#3b82f6]/10 border-2 border-[#10b981] px-4 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#10b981]">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-white text-sm">
                        {wallet.ens_name
                          ? "ENS Profile Loaded"
                          : "Wallet Connected"}
                      </span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#10b981]" />
                    </div>
                    <p className="text-xs font-mono text-[#8b92a8]">
                      {ensStrategy}
                    </p>
                  </div>
                </div>

                {/* Network Badge */}
                {chainName && (
                  <div className="hidden sm:flex items-center gap-2 rounded-lg bg-[#141823] border-2 border-[#1e2433] px-4 py-2">
                    <div className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse"></div>
                    <span className="text-sm font-mono font-bold text-white">
                      {chainName}
                    </span>
                  </div>
                )}

                {/* Balance Display */}
                {usdcBalance !== undefined && (
                  <div className="hidden md:flex items-center gap-2 rounded-lg bg-[#141823] border-2 border-[#1e2433] px-4 py-2">
                    <span className="text-xs font-mono text-[#8b92a8]">
                      USDC
                    </span>
                    <span className="font-mono text-lg font-bold text-white">
                      {usdcBalance.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
              </>
            )}

            <ConnectButton
              chainStatus="icon"
              showBalance={false}
              accountStatus="address"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
