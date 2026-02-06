import { useAccount } from "wagmi";
import { ENSConfigPanel } from "@/app/components/ens-config-panel";
import { useAuth } from "@/hooks/useAuth";
import { Wallet } from "lucide-react";

export function SettingsPage() {
  const { isConnected } = useAccount();
  const { isAuthenticated } = useAuth();

  if (!isConnected || !isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1e293b] border border-[#334155]">
              <Wallet className="h-8 w-8 text-[#64748b]" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Connect Wallet
          </h2>
          <p className="text-sm font-mono text-[#64748b]">
            Connect your wallet to manage agent settings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
      <ENSConfigPanel />
    </div>
  );
}
