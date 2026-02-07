import { useAccount } from "wagmi";
import { useAuth } from "@/hooks/useAuth";
import { CHAIN_CONFIG } from "@/lib/chains";
import { Wallet, ExternalLink } from "lucide-react";
import type { Vault } from "@/types/api";

export function VaultPage() {
  const { isConnected } = useAccount();
  const { isAuthenticated, wallet } = useAuth();

  if (!isConnected || !isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1e293b] border border-[#334155]">
              <Wallet className="h-8 w-8 text-[#64748b]" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connect Wallet</h2>
          <p className="text-sm font-mono text-[#64748b]">
            Connect your wallet to view your vaults
          </p>
        </div>
      </div>
    );
  }

  const vaults: Vault[] = wallet?.vaults ?? [];

  if (vaults.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1e293b] border border-[#334155]">
              <Wallet className="h-8 w-8 text-[#64748b]" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Vaults Yet</h2>
          <p className="text-sm font-mono text-[#64748b]">
            No vaults deployed yet. Make a deposit to create your first vault.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-white mb-6">Your Vaults</h1>
        <div className="space-y-4">
          {vaults.map((vault) => {
            const chain = CHAIN_CONFIG[vault.chain_id];
            const explorerUrl = chain
              ? `${chain.explorer}/address/${vault.vault_address}`
              : "#";

            return (
              <div
                key={vault.id}
                className="rounded-xl border border-[#1e2433] bg-[#141823] p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xl"
                      style={{ color: chain?.color ?? "#64748b" }}
                    >
                      {chain?.icon ?? "?"}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {chain?.name ?? `Chain ${vault.chain_id}`}
                      </p>
                      <p className="text-xs font-mono text-[#64748b]">
                        {vault.vault_address}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        vault.is_active
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {vault.is_active ? "Active" : "Inactive"}
                    </span>
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#64748b] hover:text-white transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
