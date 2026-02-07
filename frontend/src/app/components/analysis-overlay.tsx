import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  TrendingUp,
  Zap,
  CheckCircle2,
} from "lucide-react";
import type { YieldPool, QuoteResponse } from "@/types/api";
import { CHAIN_CONFIG } from "@/lib/chains";
import { PROTOCOL_DISPLAY, toNum } from "@/lib/constants";

interface AnalysisOverlayProps {
  isOpen: boolean;
  onComplete: (quote?: QuoteResponse, winnerPool?: YieldPool) => void;
  amount: number;
  yieldPools: YieldPool[];
  selectedPool: YieldPool | null;
  onFetchQuote?: (pool: YieldPool, amount: number) => Promise<QuoteResponse | null>;
}

type AnalysisPhase = "scanning" | "analyzing" | "complete";

export function AnalysisOverlay({
  isOpen,
  onComplete,
  amount,
  yieldPools,
  selectedPool,
  onFetchQuote,
}: AnalysisOverlayProps) {
  const [phase, setPhase] = useState<AnalysisPhase>("scanning");
  const [visibleOpportunities, setVisibleOpportunities] = useState<number>(0);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Sort pools by APY desc, mark the winner
  const opportunities = useMemo(() => {
    const pools = yieldPools.length > 0 ? [...yieldPools] : [];
    pools.sort((a, b) => toNum(b.apy) - toNum(a.apy));
    const top = pools.slice(0, 6);
    const winnerId = selectedPool?.pool_id || top[0]?.pool_id;
    return top.map((pool, i) => ({
      pool,
      isWinner: pool.pool_id === winnerId,
      rank: i + 1,
    }));
  }, [yieldPools, selectedPool]);

  const winner = opportunities.find((o) => o.isWinner) || opportunities[0];

  useEffect(() => {
    if (!isOpen) {
      setPhase("scanning");
      setVisibleOpportunities(0);
      setQuote(null);
      setQuoteError(null);
      return;
    }

    const scanTimer = setTimeout(() => setPhase("analyzing"), 2000);

    const revealTimers: ReturnType<typeof setTimeout>[] = [];
    opportunities.forEach((_, index) => {
      const timer = setTimeout(() => {
        setVisibleOpportunities(index + 1);
      }, 2000 + index * 400);
      revealTimers.push(timer);
    });

    const completeTimer = setTimeout(
      async () => {
        setPhase("complete");

        // Try to fetch a real LI.FI quote
        const winnerPool = winner?.pool || selectedPool;
        if (onFetchQuote && winnerPool) {
          try {
            const q = await onFetchQuote(winnerPool, amount);
            setQuote(q);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Quote failed";
            setQuoteError(msg);
          }
        }

        setTimeout(() => onComplete(quote ?? undefined, winner?.pool), 2500);
      },
      2000 + opportunities.length * 400 + 1000,
    );

    return () => {
      clearTimeout(scanTimer);
      revealTimers.forEach(clearTimeout);
      clearTimeout(completeTimer);
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-4xl rounded-2xl bg-[#0a0e1a] border-2 border-[#1e2433] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="relative border-b-2 border-[#1e2433] bg-gradient-to-r from-[#0a0e1a] to-[#141823] p-6">
                <div className="mb-4 flex items-center gap-3">
                  <motion.div
                    animate={{
                      boxShadow: [
                        "0 0 20px rgba(59, 130, 246, 0.3)",
                        "0 0 40px rgba(59, 130, 246, 0.6)",
                        "0 0 20px rgba(59, 130, 246, 0.3)",
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6]"
                  >
                    <Sparkles className="h-6 w-6 text-white" />
                  </motion.div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {phase === "scanning" && "AI Market Scan in Progress..."}
                      {phase === "analyzing" && "Analyzing Best Opportunities"}
                      {phase === "complete" && "Optimal Strategy Selected"}
                    </h2>
                    <p className="text-sm font-mono text-[#8b92a8]">
                      {phase === "scanning" &&
                        "Scanning Base, Arbitrum, Optimism networks..."}
                      {phase === "analyzing" &&
                        `${visibleOpportunities} opportunities detected`}
                      {phase === "complete" &&
                        "Preparing Li.Fi cross-chain execution..."}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-[#141823] border-2 border-[#1e2433] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-[#8b92a8]">
                      Optimizing
                    </span>
                    <span className="font-mono text-xl font-bold text-white">
                      {amount.toLocaleString()} USDC
                    </span>
                  </div>
                </div>
              </div>

              {/* Opportunities List */}
              <div className="p-6">
                {phase === "scanning" && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="mb-4 h-16 w-16 rounded-full border-4 border-[#1e2433] border-t-[#3b82f6]"
                    />
                    <p className="text-sm font-mono text-[#8b92a8]">
                      Analyzing pools across multiple chains...
                    </p>
                  </div>
                )}

                {(phase === "analyzing" || phase === "complete") && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-12 gap-4 px-4 pb-3 border-b-2 border-[#1e2433]">
                      <div className="col-span-1 text-xs font-mono font-bold text-[#8b92a8] uppercase">
                        #
                      </div>
                      <div className="col-span-4 text-xs font-mono font-bold text-[#8b92a8] uppercase">
                        Protocol
                      </div>
                      <div className="col-span-3 text-xs font-mono font-bold text-[#8b92a8] uppercase">
                        Network
                      </div>
                      <div className="col-span-2 text-xs font-mono font-bold text-[#8b92a8] uppercase">
                        APY
                      </div>
                      <div className="col-span-2 text-xs font-mono font-bold text-[#8b92a8] uppercase">
                        TVL
                      </div>
                    </div>

                    {opportunities
                      .slice(0, visibleOpportunities)
                      .map((opp, index) => {
                        const chainMeta = CHAIN_CONFIG[opp.pool.chain_id];
                        const protocolName =
                          PROTOCOL_DISPLAY[opp.pool.project] || opp.pool.project;
                        const chainColor = chainMeta?.color || "#8b92a8";

                        return (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3 }}
                            className={`grid grid-cols-12 gap-4 rounded-xl p-4 transition-all ${
                              opp.isWinner
                                ? "bg-gradient-to-r from-[#10b981]/20 to-[#3b82f6]/20 border-2 border-[#10b981] shadow-xl shadow-[#10b981]/30"
                                : "bg-[#141823] border-2 border-[#1e2433] opacity-60"
                            }`}
                          >
                            <div className="col-span-1 flex items-center">
                              {opp.isWinner ? (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#10b981]">
                                  <Zap className="h-4 w-4 text-white" />
                                </div>
                              ) : (
                                <span className="font-mono text-lg text-[#8b92a8]">
                                  {opp.rank}
                                </span>
                              )}
                            </div>

                            <div className="col-span-4 flex items-center gap-3">
                              <div
                                className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 ${
                                  opp.isWinner
                                    ? "bg-[#10b981]/20 border-[#10b981]"
                                    : "bg-[#1e2433] border-[#1e2433]"
                                }`}
                              >
                                <span
                                  className={`text-lg ${opp.isWinner ? "text-white" : "text-[#8b92a8]"}`}
                                >
                                  {protocolName.charAt(0)}
                                </span>
                              </div>
                              <span
                                className={`font-bold ${opp.isWinner ? "text-white text-lg" : "text-[#8b92a8]"}`}
                              >
                                {protocolName}
                              </span>
                            </div>

                            <div className="col-span-3 flex items-center gap-2">
                              <div
                                className="flex h-8 w-8 items-center justify-center rounded-full border-2"
                                style={{
                                  backgroundColor: `${chainColor}20`,
                                  borderColor: `${chainColor}60`,
                                }}
                              >
                                <span
                                  className="text-sm"
                                  style={{ color: chainColor }}
                                >
                                  {chainMeta?.icon || "?"}
                                </span>
                              </div>
                              <span
                                className={`font-bold ${opp.isWinner ? "text-white" : "text-[#8b92a8]"}`}
                              >
                                {chainMeta?.name || opp.pool.chain}
                              </span>
                            </div>

                            <div className="col-span-2 flex items-center">
                              <span
                                className={`font-mono text-lg font-bold ${opp.isWinner ? "text-[#10b981]" : "text-[#8b92a8]"}`}
                              >
                                {toNum(opp.pool.apy).toFixed(2)}%
                              </span>
                            </div>

                            <div className="col-span-2 flex items-center">
                              <span
                                className={`font-mono text-sm ${opp.isWinner ? "text-white" : "text-[#8b92a8]"}`}
                              >
                                ${formatTVL(opp.pool.tvl_usd)}
                              </span>
                            </div>

                            {opp.isWinner && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="col-span-12 mt-2 flex items-center gap-2 text-sm font-bold text-[#10b981]"
                              >
                                <TrendingUp className="h-4 w-4" />
                                Best Strategy - Highest Risk-Adjusted APY
                              </motion.div>
                            )}
                          </motion.div>
                        );
                      })}
                  </div>
                )}

                {phase === "complete" && winner && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 rounded-xl bg-gradient-to-r from-[#10b981]/10 to-[#3b82f6]/10 border-2 border-[#10b981] p-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#10b981]">
                          <CheckCircle2 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-white">
                            Optimal Route Selected
                          </p>
                          <p className="text-sm font-mono text-[#8b92a8]">
                            Routing to{" "}
                            {PROTOCOL_DISPLAY[winner.pool.project] ||
                              winner.pool.project}{" "}
                            on{" "}
                            {CHAIN_CONFIG[winner.pool.chain_id]?.name ||
                              winner.pool.chain}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono text-[#8b92a8] mb-1">
                          Expected APY
                        </p>
                        <p className="font-mono text-2xl font-bold text-[#10b981]">
                          {toNum(winner.pool.apy).toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[#1e2433]">
                      {quote && (
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-xs font-mono text-[#8b92a8]">Route</p>
                            <p className="text-sm font-mono font-bold text-white">{quote.tool}</p>
                          </div>
                          <div>
                            <p className="text-xs font-mono text-[#8b92a8]">Gas Cost</p>
                            <p className="text-sm font-mono font-bold text-white">${parseFloat(quote.gas_cost_usd).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-mono text-[#8b92a8]">Est. Time</p>
                            <p className="text-sm font-mono font-bold text-white">
                              {quote.execution_duration ? `${Math.ceil(quote.execution_duration / 60)}min` : "~2min"}
                            </p>
                          </div>
                        </div>
                      )}
                      {quoteError && (
                        <p className="text-xs font-mono text-[#f59e0b] mb-3">
                          Quote unavailable: {quoteError}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono text-[#8b92a8]">
                          Initiating cross-chain execution...
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[#8b92a8]">
                            Powered by
                          </span>
                          <span className="font-mono font-bold text-[#3b82f6]">
                            Li.Fi
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function formatTVL(tvl: number | string): string {
  const v = typeof tvl === "string" ? parseFloat(tvl) || 0 : tvl;
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}
