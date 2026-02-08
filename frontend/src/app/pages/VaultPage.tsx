import { useState } from "react";
import { useAccount } from "wagmi";
import { useAuth } from "@/hooks/useAuth";
import { useWalletData } from "@/hooks/useWalletData";
import { CHAIN_CONFIG } from "@/lib/chains";
import { Wallet, ExternalLink, Copy, Check, Loader2 } from "lucide-react";
import type { Vault } from "@/types/api";

export function VaultPage() {
  const { isConnected, address } = useAccount();
  const { isAuthenticated, wallet } = useAuth();
  const { isLoading } = useWalletData(address);

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

  if (isLoading && vaults.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 text-[#8b92a8] animate-spin" />
      </div>
    );
  }

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
          {vaults.map((vault) => (
            <VaultRow key={vault.id} vault={vault} />
          ))}
        </div>
      </div>
    </div>
  );
}

function VaultRow({ vault }: { vault: Vault }) {
  const [copied, setCopied] = useState(false);
  const chain = CHAIN_CONFIG[vault.chain_id];
  const explorerUrl = chain
    ? `${chain.explorer}/address/${vault.vault_address}`
    : "#";

  const copy = async () => {
    await navigator.clipboard.writeText(vault.vault_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-2xl border-2 border-[#1e2433] bg-[#141823] p-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-5">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl border-2"
            style={{
              backgroundColor: `${chain?.color ?? "#64748b"}20`,
              borderColor: `${chain?.color ?? "#64748b"}40`,
            }}
          >
            <span className="text-3xl" style={{ color: chain?.color ?? "#64748b" }}>
              {chain?.icon ?? "?"}
            </span>
          </div>
          <div>
            <p className="text-xl font-bold text-white">
              {chain?.name ?? `Chain ${vault.chain_id}`}
            </p>
            <span
              className={`text-sm px-3 py-0.5 rounded-full ${
                vault.is_active
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {vault.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            className="p-3 rounded-lg text-[#64748b] hover:text-white hover:bg-[#1e2433] transition-colors"
            title="Copy address"
          >
            {copied ? (
              <Check className="h-6 w-6 text-emerald-400" />
            ) : (
              <Copy className="h-6 w-6" />
            )}
          </button>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 rounded-lg text-[#64748b] hover:text-white hover:bg-[#1e2433] transition-colors"
            title={`View on ${chain?.name ?? ""} explorer`}
          >
            <ExternalLink className="h-6 w-6" />
          </a>
        </div>
      </div>
      <div className="rounded-xl bg-[#0a0e1a] border border-[#1e2433] px-5 py-4">
        <p className="text-sm font-mono text-[#64748b] mb-2">Vault Address</p>
        <p className="font-mono text-base text-white break-all select-all leading-relaxed">
          {vault.vault_address}
        </p>
      </div>
    </div>
  );
}
