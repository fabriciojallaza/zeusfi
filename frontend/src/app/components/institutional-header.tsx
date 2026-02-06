import { Wallet, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/app/components/ui/button";

interface InstitutionalHeaderProps {
  isConnected: boolean;
  ensName?: string;
  walletAddress?: string;
  onConnect: () => void;
}

export function InstitutionalHeader({
  isConnected,
  ensName = "adolfo.eth",
  walletAddress,
  onConnect,
}: InstitutionalHeaderProps) {
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <header className="border-b border-[#1e293b] bg-[#0f172a] sticky top-0 z-30 backdrop-blur-sm bg-opacity-95">
      <div className="flex h-20 items-center justify-between px-8">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-[#3b82f6]" />
          <div>
            <h1 className="text-xl font-bold text-white">DeFAI Agent</h1>
            <p className="text-xs font-mono text-[#64748b]">
              Autonomous Yield Protocol
            </p>
          </div>
        </div>

        {/* Right Side - Wallet Connection */}
        <div className="flex items-center gap-4">
          {isConnected ? (
            <div className="flex items-center gap-2 rounded-xl bg-[#1e293b] border border-[#334155] px-4 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6]">
                <Wallet className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-mono text-[#64748b]">Connected as</p>
                <p className="font-mono font-bold text-white text-sm">
                  {ensName ||
                    (walletAddress ? truncateAddress(walletAddress) : "")}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-[#64748b] ml-2" />
            </div>
          ) : (
            <Button
              onClick={onConnect}
              className="font-mono font-bold bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] hover:from-[#2563eb] hover:to-[#7c3aed] text-white rounded-xl px-6 py-3 transition-all shadow-lg shadow-[#3b82f6]/20 hover:shadow-[#3b82f6]/30"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
