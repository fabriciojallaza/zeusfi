import { useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { motion } from "motion/react";
import type { YieldPool } from "@/types/api";
import type { AssetConfig } from "@/lib/assets";
import { toNum } from "@/lib/constants";

interface TokenTableProps {
  assets: AssetConfig[];
  pools: YieldPool[];
  onSelectAsset: (asset: AssetConfig) => void;
  isConnected: boolean;
  isLoading: boolean;
  error?: string | null;
  usdcBalance?: number;
}

export function TokenTable({
  assets,
  pools,
  onSelectAsset,
  isConnected,
  isLoading,
  error,
  usdcBalance,
}: TokenTableProps) {
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null);

  /** Best APY across all pools matching this asset symbol */
  const bestApyFor = (symbol: string): number | null => {
    const matching = pools.filter(
      (p) => p.symbol.toUpperCase().includes(symbol.toUpperCase()),
    );
    if (matching.length === 0) return null;
    return Math.max(...matching.map((p) => toNum(p.apy)));
  };

  return (
    <div className="w-full max-w-5xl">
      <div className="rounded-2xl bg-[#0a0e1a] border-2 border-[#1e2433] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#0a0e1a] via-[#141823] to-[#0a0e1a] border-b-2 border-[#1e2433] p-8">
          <div className="flex items-center justify-between">
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
                <h2 className="mb-1 text-2xl font-bold text-white">
                  AI Yield Agent
                </h2>
                <p className="text-sm text-[#8b92a8] font-mono">
                  Asset Selection
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono text-[#8b92a8] uppercase tracking-wider">
                Available Assets
              </p>
              <p className="font-mono text-3xl font-bold text-white">
                {assets.length}
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="p-6">
          <div className="overflow-hidden rounded-xl border-2 border-[#1e2433]">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 bg-[#141823] border-b-2 border-[#1e2433] px-6 py-4">
              <div className="col-span-4 text-xs font-mono font-bold text-[#8b92a8] uppercase tracking-wider">
                Asset
              </div>
              <div className="col-span-3 text-xs font-mono font-bold text-[#8b92a8] uppercase tracking-wider">
                Your Balance
              </div>
              <div className="col-span-2 text-xs font-mono font-bold text-[#8b92a8] uppercase tracking-wider">
                Est. APY
              </div>
              <div className="col-span-3 text-xs font-mono font-bold text-[#8b92a8] uppercase tracking-wider text-right">
                Action
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y-2 divide-[#1e2433] bg-[#0a0e1a]">
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-4 px-6 py-5">
                    <div className="col-span-4 flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div>
                        <Skeleton className="h-5 w-24 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <div className="col-span-3 flex items-center">
                      <Skeleton className="h-5 w-20" />
                    </div>
                    <div className="col-span-2 flex items-center">
                      <Skeleton className="h-8 w-16 rounded-lg" />
                    </div>
                    <div className="col-span-3 flex items-center justify-end">
                      <Skeleton className="h-9 w-24 rounded-lg" />
                    </div>
                  </div>
                ))}

              {!isLoading && error && (
                <div className="px-6 py-12 text-center">
                  <div className="flex h-12 w-12 mx-auto mb-3 items-center justify-center rounded-full bg-[#ef4444]/20 border border-[#ef4444]/40">
                    <span className="text-[#ef4444] text-lg">!</span>
                  </div>
                  <p className="text-sm font-bold text-white mb-1">
                    Failed to load data
                  </p>
                  <p className="text-xs font-mono text-[#8b92a8]">{error}</p>
                </div>
              )}

              {!isLoading &&
                !error &&
                assets.map((asset) => {
                  const apy = asset.isActive ? bestApyFor(asset.symbol) : null;

                  return (
                    <motion.div
                      key={asset.symbol}
                      onMouseEnter={() => setHoveredAsset(asset.symbol)}
                      onMouseLeave={() => setHoveredAsset(null)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`grid grid-cols-12 gap-4 px-6 py-5 transition-all duration-200 ${
                        hoveredAsset === asset.symbol && asset.isActive
                          ? "bg-[#1a1f2e] border-l-4 border-l-[#3b82f6]"
                          : "border-l-4 border-l-transparent"
                      } ${!asset.isActive ? "opacity-60" : ""}`}
                    >
                      {/* Asset */}
                      <div className="col-span-4 flex items-center gap-3">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-lg border-2"
                          style={{
                            backgroundColor: `${asset.color}20`,
                            borderColor: `${asset.color}40`,
                          }}
                        >
                          <span
                            className="text-lg font-bold"
                            style={{ color: asset.color }}
                          >
                            {asset.icon}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-white text-lg">
                            {asset.symbol}
                          </p>
                          <p className="text-xs font-mono text-[#8b92a8]">
                            {asset.name}
                          </p>
                        </div>
                      </div>

                      {/* Balance */}
                      <div className="col-span-3 flex items-center">
                        {asset.isActive ? (
                          isConnected ? (
                            <span className="font-mono text-sm text-white">
                              {usdcBalance !== undefined
                                ? `${usdcBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
                                : "-"}
                            </span>
                          ) : (
                            <span className="text-xs font-mono text-[#8b92a8]">
                              Connect wallet
                            </span>
                          )
                        ) : (
                          <span className="font-mono text-sm text-[#8b92a8]">
                            -
                          </span>
                        )}
                      </div>

                      {/* APY */}
                      <div className="col-span-2 flex items-center">
                        {apy !== null ? (
                          <div className="inline-flex items-center gap-1 rounded-lg border-2 px-3 py-1.5 bg-[#10b981]/10 border-[#10b981]/40">
                            <span className="font-mono text-lg font-bold text-[#10b981]">
                              {apy.toFixed(2)}%
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono text-sm text-[#8b92a8]">
                            -
                          </span>
                        )}
                      </div>

                      {/* Action */}
                      <div className="col-span-3 flex items-center justify-end">
                        {asset.isActive ? (
                          <Button
                            onClick={() => onSelectAsset(asset)}
                            disabled={!isConnected}
                            className="font-mono font-bold bg-gradient-to-r from-[#10b981] to-[#3b82f6] hover:from-[#059669] hover:to-[#2563eb] text-white rounded-lg transition-all duration-200 shadow-lg shadow-[#10b981]/20 hover:shadow-[#10b981]/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                          >
                            Deploy
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs font-mono text-[#8b92a8]">
                            Coming Soon
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="border-t-2 border-[#1e2433] bg-[#141823] p-6">
          <div className="rounded-xl bg-[#0a0e1a] border border-[#1e2433] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3b82f6]/20 flex-shrink-0 border border-[#3b82f6]">
                <Sparkles className="h-5 w-5 text-[#3b82f6]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-1">
                  AI-Powered Yield Optimization
                </p>
                <p className="text-xs font-mono text-[#8b92a8] leading-relaxed">
                  Select an asset to deploy. The AI agent will automatically
                  find the best yield pool across Base, Arbitrum, and Avalanche.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tech Indicators */}
        <div className="border-t-2 border-[#1e2433] bg-[#0a0e1a] p-6">
          <div className="flex items-center justify-center gap-8 text-sm font-mono text-[#8b92a8]">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse"></div>
              <span>Non-Custodial</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse"></div>
              <span>Audited Protocols</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse"></div>
              <span>Li.Fi Powered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#3b82f6] animate-pulse"></div>
              <span>Real-time Analysis</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
