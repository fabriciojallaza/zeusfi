import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Shield, Save, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import {
  useAccount,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { mainnet } from "viem/chains";
import { namehash } from "viem";
import {
  ENS_PUBLIC_RESOLVER_ABI,
  ENS_REGISTRY_ABI,
  ENS_REGISTRY_ADDRESS,
} from "@/lib/contracts";

type RiskTolerance = "conservative" | "balanced" | "aggressive";

interface ChainToggle {
  id: string;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
}

const RISK_TO_ENS: Record<RiskTolerance, string> = {
  conservative: "low",
  balanced: "medium",
  aggressive: "high",
};

const ENS_TO_RISK: Record<string, RiskTolerance> = {
  low: "conservative",
  medium: "balanced",
  high: "aggressive",
};

export function ENSConfigPanel() {
  const wallet = useAuthStore((s) => s.wallet);
  const { chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const ensName = wallet?.ens_name;
  const node = ensName ? namehash(ensName) : undefined;

  // Look up the resolver for this ENS name
  const { data: resolverAddress } = useReadContract({
    address: ENS_REGISTRY_ADDRESS,
    abi: ENS_REGISTRY_ABI,
    functionName: "resolver",
    args: node ? [node] : undefined,
    chainId: mainnet.id,
    query: { enabled: !!node },
  });

  const hasResolver =
    resolverAddress && resolverAddress !== "0x0000000000000000000000000000000000000000";

  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>(() => {
    if (wallet?.ens_max_risk) {
      return ENS_TO_RISK[wallet.ens_max_risk] || "balanced";
    }
    return "balanced";
  });

  const [minAPY, setMinAPY] = useState(() => {
    return wallet?.ens_min_apy || "5.0";
  });

  const [rebalanceFrequency, setRebalanceFrequency] = useState("daily");

  const [chains, setChains] = useState<ChainToggle[]>(() => {
    const walletChains = wallet?.ens_chains || [];
    return [
      {
        id: "base",
        name: "Base",
        icon: "\u2B21",
        color: "#0052FF",
        enabled: walletChains.length === 0 || walletChains.includes("base"),
      },
      {
        id: "arbitrum",
        name: "Arbitrum",
        icon: "\u25C6",
        color: "#28A0F0",
        enabled: walletChains.length === 0 || walletChains.includes("arbitrum"),
      },
      {
        id: "avalanche",
        name: "Avalanche",
        icon: "\u25B2",
        color: "#E84142",
        enabled: walletChains.length === 0 || walletChains.includes("avalanche"),
      },
    ];
  });

  const handleChainToggle = (chainId: string) => {
    setChains((prev) =>
      prev.map((chain) =>
        chain.id === chainId ? { ...chain, enabled: !chain.enabled } : chain,
      ),
    );
  };

  // Write contract state
  const {
    writeContractAsync,
    isPending: isWriting,
    data: txHash,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  const [saveStep, setSaveStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);

  useEffect(() => {
    if (isConfirmed && saveStep > 0 && saveStep >= totalSteps) {
      toast.success("ENS records updated!", {
        description: "Your agent strategy preferences have been saved on-chain.",
      });
      setSaveStep(0);
      setTotalSteps(0);
    }
  }, [isConfirmed, saveStep, totalSteps]);

  const handleSave = async () => {
    if (!ensName || !node || !resolverAddress || !hasResolver) {
      toast.error("Cannot save ENS records", {
        description: !ensName
          ? "No ENS name found for your wallet. You need an ENS name to store preferences."
          : "No resolver found for your ENS name.",
      });
      return;
    }

    // Switch to mainnet if needed
    if (chain?.id !== mainnet.id) {
      try {
        await switchChainAsync({ chainId: mainnet.id });
      } catch {
        toast.error("Please switch to Ethereum Mainnet to update ENS records.");
        return;
      }
    }

    const records: [string, string][] = [
      ["yield.maxRisk", RISK_TO_ENS[riskTolerance]],
      ["yield.minAPY", minAPY],
      [
        "yield.chains",
        chains
          .filter((c) => c.enabled)
          .map((c) => c.id)
          .join(","),
      ],
    ];

    setTotalSteps(records.length);
    setSaveStep(0);

    try {
      for (let i = 0; i < records.length; i++) {
        const [key, value] = records[i];
        setSaveStep(i + 1);

        await writeContractAsync({
          address: resolverAddress as `0x${string}`,
          abi: ENS_PUBLIC_RESOLVER_ABI,
          functionName: "setText",
          args: [node, key, value],
          chainId: mainnet.id,
        });
      }

      toast.success("ENS records updated!", {
        description:
          "Your agent strategy preferences have been saved on-chain.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      if (!msg.includes("User rejected") && !msg.includes("User denied")) {
        toast.error("Failed to update ENS records", { description: msg });
      }
    } finally {
      setSaveStep(0);
      setTotalSteps(0);
    }
  };

  const isBusy = isWriting || isConfirming;
  const isOnMainnet = chain?.id === mainnet.id;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6]">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              Agent Strategy Configuration
            </h1>
            <p className="text-sm font-mono text-[#64748b]">
              Define rules stored in ENS records
              {ensName && (
                <span className="text-[#3b82f6]"> ({ensName})</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* No ENS warning */}
      {!ensName && (
        <div className="mb-6 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/30 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-[#f59e0b] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-white">No ENS Name Detected</p>
            <p className="text-xs font-mono text-[#8b92a8] mt-1">
              You need an ENS name to save strategy preferences on-chain. Get one at{" "}
              <a
                href="https://app.ens.domains"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3b82f6] hover:underline"
              >
                app.ens.domains
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <div className="space-y-6">
        {/* Risk Tolerance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-[#1e293b] border border-[#334155] p-6"
        >
          <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider mb-4">
            Risk Tolerance
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {(
              ["conservative", "balanced", "aggressive"] as RiskTolerance[]
            ).map((risk) => (
              <button
                key={risk}
                onClick={() => setRiskTolerance(risk)}
                className={`relative rounded-xl border-2 p-4 transition-all ${
                  riskTolerance === risk
                    ? "border-[#3b82f6] bg-[#3b82f6]/10"
                    : "border-[#334155] bg-[#0f172a] hover:border-[#475569]"
                }`}
              >
                {riskTolerance === risk && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-4 w-4 text-[#3b82f6]" />
                  </div>
                )}
                <p className="font-mono font-bold text-white capitalize">
                  {risk}
                </p>
                <p className="text-xs font-mono text-[#64748b] mt-1">
                  {risk === "conservative" && "Low risk, stable yields"}
                  {risk === "balanced" && "Moderate risk/reward"}
                  {risk === "aggressive" && "High risk, max returns"}
                </p>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Minimum APY Target */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-[#1e293b] border border-[#334155] p-6"
        >
          <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider mb-4">
            Minimum APY Target
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="number"
                  value={minAPY}
                  onChange={(e) => setMinAPY(e.target.value)}
                  step="0.1"
                  min="0"
                  max="100"
                  className="w-full rounded-xl bg-[#0f172a] border-2 border-[#334155] focus:border-[#3b82f6] px-4 py-3 text-white font-mono text-lg focus:outline-none transition-colors"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748b] font-mono text-lg">
                  %
                </span>
              </div>
              <p className="text-xs font-mono text-[#64748b] mt-2">
                Agent will only invest in opportunities above this APY
              </p>
            </div>
            <div className="rounded-xl bg-[#0f172a] border border-[#334155] px-6 py-4 text-center">
              <p className="text-xs font-mono text-[#64748b] mb-1">
                Current Target
              </p>
              <p className="font-mono text-3xl font-bold text-[#3b82f6]">
                {minAPY}%
              </p>
            </div>
          </div>
        </motion.div>

        {/* Allowed Chains */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-[#1e293b] border border-[#334155] p-6"
        >
          <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider mb-4">
            Allowed Chains
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {chains.map((chain) => (
              <button
                key={chain.id}
                onClick={() => handleChainToggle(chain.id)}
                className={`relative rounded-xl border-2 p-4 transition-all ${
                  chain.enabled
                    ? "border-[#3b82f6] bg-[#3b82f6]/10"
                    : "border-[#334155] bg-[#0f172a] hover:border-[#475569] opacity-50"
                }`}
              >
                {chain.enabled && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-4 w-4 text-[#3b82f6]" />
                  </div>
                )}
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg mb-2 mx-auto"
                  style={{
                    backgroundColor: `${chain.color}20`,
                    border: `2px solid ${chain.color}60`,
                  }}
                >
                  <span className="text-xl" style={{ color: chain.color }}>
                    {chain.icon}
                  </span>
                </div>
                <p className="font-mono font-bold text-white text-sm text-center">
                  {chain.name}
                </p>
              </button>
            ))}
          </div>
          <p className="text-xs font-mono text-[#64748b] mt-4">
            {chains.filter((c) => c.enabled).length} of {chains.length} chains
            enabled
          </p>
        </motion.div>

        {/* Rebalance Frequency */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-[#1e293b] border border-[#334155] p-6"
        >
          <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider mb-4">
            Rebalance Frequency
          </h3>
          <select
            value={rebalanceFrequency}
            onChange={(e) => setRebalanceFrequency(e.target.value)}
            className="w-full rounded-xl bg-[#0f172a] border-2 border-[#334155] focus:border-[#3b82f6] px-4 py-3 text-white font-mono text-sm focus:outline-none transition-colors"
          >
            <option value="30min">Every 30 minutes</option>
            <option value="hourly">Every hour</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="manual">Manual only</option>
          </select>
          <p className="text-xs font-mono text-[#64748b] mt-2">
            How often the agent checks for better yield opportunities
          </p>
        </motion.div>

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl bg-gradient-to-r from-[#3b82f6]/10 to-[#8b5cf6]/10 border-2 border-[#3b82f6] p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">
                {isBusy
                  ? `Saving record ${saveStep} of ${totalSteps}...`
                  : "Ready to Save Configuration"}
              </h3>
              <p className="text-xs font-mono text-[#64748b]">
                {ensName
                  ? "This will update your ENS text records on Ethereum Mainnet"
                  : "You need an ENS name to save preferences on-chain"}
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={isBusy || !ensName}
              className="font-mono font-bold bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] hover:from-[#2563eb] hover:to-[#7c3aed] text-white rounded-xl px-8 py-3 transition-all shadow-lg shadow-[#3b82f6]/30 hover:shadow-[#3b82f6]/50 h-12 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Sign & Update ENS Record
                </>
              )}
            </Button>
          </div>
          {!isOnMainnet && ensName && (
            <div className="rounded-lg bg-[#0f172a] border border-[#334155] p-3">
              <p className="text-xs font-mono text-[#64748b]">
                <span className="text-[#f59e0b]">Note:</span> You'll be prompted
                to switch to Ethereum Mainnet to sign the transaction.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
