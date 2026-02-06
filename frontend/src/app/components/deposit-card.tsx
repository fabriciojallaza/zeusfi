import { useState } from "react";
import {
  ArrowLeft,
  Sparkles,
  Radar,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { motion } from "motion/react";
import { CHAIN_CONFIG } from "@/lib/chains";
import type { YieldPool } from "@/types/api";
import type { AssetConfig } from "@/lib/assets";
import { PROTOCOL_DISPLAY, toNum } from "@/lib/constants";

interface DepositCardProps {
  onDeposit: (amount: number) => void;
  isConnected: boolean;
  selectedAsset: AssetConfig;
  assetPools: YieldPool[];
  onBack: () => void;
  usdcBalance?: number;
}

export function DepositCard({
  onDeposit,
  isConnected,
  selectedAsset,
  assetPools,
  onBack,
  usdcBalance,
}: DepositCardProps) {
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string>("");

  const maxBalance = usdcBalance;

  const sortedPools = [...assetPools].sort(
    (a, b) => toNum(b.apy) - toNum(a.apy),
  );

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError("");
      if (maxBalance !== undefined && parseFloat(value) > maxBalance) {
        setError("Insufficient balance");
      }
    }
  };

  const handleMaxClick = () => {
    if (maxBalance !== undefined) {
      setAmount(maxBalance.toString());
      setError("");
    }
  };

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!amount || numAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (maxBalance !== undefined && numAmount > maxBalance) {
      setError("Insufficient balance");
      return;
    }
    onDeposit(numAmount);
  };

  return (
    <div className="w-full max-w-2xl">
      <div className="rounded-2xl bg-[#0a0e1a] border-2 border-[#1e2433] shadow-2xl overflow-hidden">
        {/* Header with AI Badge */}
        <div className="relative bg-gradient-to-r from-[#0a0e1a] via-[#141823] to-[#0a0e1a] border-b border-[#1e2433] p-6">
          <button
            onClick={onBack}
            className="mb-4 flex items-center gap-2 text-sm text-[#8b92a8] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to assets
          </button>

          <div className="flex items-center gap-4">
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 20px rgba(59, 130, 246, 0.3)",
                  "0 0 40px rgba(59, 130, 246, 0.6)",
                  "0 0 20px rgba(59, 130, 246, 0.3)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6]"
            >
              <Sparkles className="h-7 w-7 text-white" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-white">AI Yield Agent</h1>
              <p className="text-sm text-[#8b92a8] font-mono">
                Deploy {selectedAsset.symbol} across best pools
              </p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Available Yield Pools */}
          {sortedPools.length > 0 && (
            <div className="mb-6">
              <p className="mb-3 text-xs font-mono text-[#8b92a8] uppercase tracking-wider">
                Available Yield Pools
              </p>
              <div className="space-y-2">
                {sortedPools.map((pool, i) => {
                  const chainMeta = CHAIN_CONFIG[pool.chain_id];
                  const protocolName =
                    PROTOCOL_DISPLAY[pool.project] || pool.project;
                  const chainColor = chainMeta?.color || "#8b92a8";
                  const isBest = i === 0;

                  return (
                    <div
                      key={pool.pool_id}
                      className={`flex items-center justify-between rounded-xl p-3 border ${
                        isBest
                          ? "bg-[#10b981]/10 border-[#10b981]/60"
                          : "bg-[#141823] border-[#1e2433]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg border"
                          style={{
                            backgroundColor: `${chainColor}20`,
                            borderColor: `${chainColor}40`,
                          }}
                        >
                          <span
                            className="text-sm font-bold"
                            style={{ color: chainColor }}
                          >
                            {protocolName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              {protocolName}
                            </span>
                            {isBest && (
                              <span className="flex items-center gap-1 rounded-full bg-[#10b981] px-2 py-0.5 text-[10px] font-bold text-white">
                                <Zap className="h-3 w-3" />
                                Best
                              </span>
                            )}
                          </div>
                          <span
                            className="text-xs font-mono"
                            style={{ color: chainColor }}
                          >
                            {chainMeta?.name || pool.chain}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp
                          className={`h-3.5 w-3.5 ${isBest ? "text-[#10b981]" : "text-[#8b92a8]"}`}
                        />
                        <span
                          className={`font-mono text-sm font-bold ${isBest ? "text-[#10b981]" : "text-[#8b92a8]"}`}
                        >
                          {toNum(pool.apy).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] font-mono text-[#8b92a8] text-center">
                The AI agent will automatically select the best pool
              </p>
            </div>
          )}

          {/* Amount Input */}
          <div className="mb-6">
            <label className="mb-3 block text-xs font-mono font-semibold text-[#8b92a8] uppercase tracking-wider">
              Amount to Deploy ({selectedAsset.symbol})
            </label>
            <div className="relative">
              <Input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                disabled={!isConnected}
                className="h-16 pl-6 pr-24 text-right font-mono text-3xl font-bold bg-[#141823] border-2 border-[#1e2433] text-white placeholder:text-[#8b92a8] focus:border-[#3b82f6] focus:ring-4 focus:ring-[#3b82f6]/20 transition-all"
              />
              {maxBalance !== undefined && (
                <button
                  onClick={handleMaxClick}
                  disabled={!isConnected}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg bg-[#1e2433] hover:bg-[#3b82f6] px-4 py-2 text-sm font-mono font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  MAX
                </button>
              )}
            </div>
            {error && (
              <p className="mt-2 text-sm font-mono text-[#ef4444]">{error}</p>
            )}
            {maxBalance !== undefined && !error && (
              <p className="mt-2 text-sm font-mono text-[#8b92a8]">
                Available:{" "}
                <span className="text-white font-bold">
                  {maxBalance.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </span>{" "}
                {selectedAsset.symbol}
              </p>
            )}
          </div>

          {/* AI Agent CTA */}
          <Button
            onClick={handleSubmit}
            disabled={!isConnected || !amount || !!error}
            className="group relative w-full h-16 text-lg font-bold bg-gradient-to-r from-[#10b981] via-[#3b82f6] to-[#8b5cf6] hover:from-[#059669] hover:via-[#2563eb] hover:to-[#7c3aed] text-white rounded-xl transition-all duration-300 shadow-lg shadow-[#3b82f6]/30 hover:shadow-[#3b82f6]/50 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 overflow-hidden"
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            />
            <span className="relative flex items-center justify-center gap-3">
              <Radar className="h-5 w-5" />
              Agent: Scan & Optimize
              <Sparkles className="h-5 w-5" />
            </span>
          </Button>

          {!isConnected && (
            <p className="mt-3 text-center text-sm text-[#8b92a8] font-mono">
              Connect wallet to activate AI Agent
            </p>
          )}
        </div>

        {/* Tech Specs Footer */}
        <div className="border-t border-[#1e2433] bg-[#141823] p-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="mb-1 text-xs font-mono text-[#8b92a8] uppercase">
                Networks
              </p>
              <p className="font-mono text-sm font-bold text-white">3 Chains</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-mono text-[#8b92a8] uppercase">
                Protocols
              </p>
              <p className="font-mono text-sm font-bold text-white">
                Aave, Morpho, Euler
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-mono text-[#8b92a8] uppercase">
                Powered By
              </p>
              <p className="font-mono text-sm font-bold text-[#3b82f6]">
                Li.Fi
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
