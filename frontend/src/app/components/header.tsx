import { Wallet, ChevronDown, Shield, CheckCircle2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";

interface HeaderProps {
  isConnected: boolean;
  walletAddress?: string;
  ensName?: string;
  ensStrategy?: string;
  usdcBalance?: number;
  currentNetwork?: string;
  onConnect: () => void;
}

export function Header({
  isConnected,
  walletAddress,
  ensName = "adolfo.eth",
  ensStrategy = "Balanced Strategy (Min 5% APY)",
  usdcBalance,
  currentNetwork,
  onConnect,
}: HeaderProps) {
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

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
              <h1 className="text-xl font-bold text-white">YieldAgent</h1>
              <p className="text-xs font-mono text-[#8b92a8]">
                AI-Powered DeFi
              </p>
            </div>
          </div>

          {/* Right Side - Wallet Info or Connect Button */}
          <div className="flex items-center gap-4">
            {isConnected ? (
              <>
                {/* ENS Profile Card - THE KEY FEATURE */}
                <div className="hidden lg:flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#10b981]/10 to-[#3b82f6]/10 border-2 border-[#10b981] px-4 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#10b981]">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-white text-sm">
                        ENS Profile Loaded
                      </span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#10b981]" />
                    </div>
                    <p className="text-xs font-mono text-[#8b92a8]">
                      {ensStrategy}
                    </p>
                  </div>
                </div>

                {/* Network Badge */}
                {currentNetwork && (
                  <div className="hidden sm:flex items-center gap-2 rounded-lg bg-[#141823] border-2 border-[#1e2433] px-4 py-2">
                    <div className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse"></div>
                    <span className="text-sm font-mono font-bold text-white">
                      {currentNetwork}
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
                      {usdcBalance.toLocaleString()}
                    </span>
                  </div>
                )}

                {/* ENS Name / Wallet Address */}
                <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#3b82f6]/20 to-[#8b5cf6]/20 border-2 border-[#3b82f6] px-4 py-2">
                  <Wallet className="h-4 w-4 text-[#3b82f6]" />
                  <span className="font-mono font-bold text-white">
                    {ensName ||
                      (walletAddress ? truncateAddress(walletAddress) : "")}
                  </span>
                  <ChevronDown className="h-4 w-4 text-[#8b92a8]" />
                </div>
              </>
            ) : (
              <Button
                onClick={onConnect}
                className="font-mono font-bold bg-gradient-to-r from-[#10b981] to-[#3b82f6] hover:from-[#059669] hover:to-[#2563eb] text-white rounded-lg px-6 py-3 transition-all shadow-lg shadow-[#10b981]/20 hover:shadow-[#10b981]/30 hover:scale-105"
              >
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
