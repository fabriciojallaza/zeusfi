import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  TrendingUp,
  Zap,
  Loader2,
  CheckCircle2,
  Settings,
} from "lucide-react";
import type { Token } from "@/app/components/token-table";

interface Opportunity {
  protocol: string;
  protocolIcon: string;
  chain: string;
  chainIcon: string;
  chainColor: string;
  apy: number;
  tvl: string;
  isWinner: boolean;
  rank: number;
  hasHook?: boolean;
  hookDescription?: string;
}

interface AnalysisOverlayProps {
  isOpen: boolean;
  onComplete: () => void;
  amount: number;
  token: Token;
}

const mockOpportunities: Opportunity[] = [
  {
    protocol: "Uniswap v4",
    protocolIcon: "🦄",
    chain: "Base",
    chainIcon: "⬡",
    chainColor: "#0052FF",
    apy: 18.7,
    tvl: "$87.3M",
    isWinner: true,
    rank: 1,
    hasHook: true,
    hookDescription: "Auto-Compound Hook",
  },
  {
    protocol: "Aave v3",
    protocolIcon: "Ⓐ",
    chain: "Arbitrum",
    chainIcon: "◆",
    chainColor: "#28A0F0",
    apy: 12.8,
    tvl: "$128.5M",
    isWinner: false,
    rank: 2,
  },
  {
    protocol: "Compound v3",
    protocolIcon: "◉",
    chain: "Optimism",
    chainIcon: "●",
    chainColor: "#FF0420",
    apy: 11.4,
    tvl: "$89.2M",
    isWinner: false,
    rank: 3,
  },
  {
    protocol: "Morpho Blue",
    protocolIcon: "◈",
    chain: "Base",
    chainIcon: "⬡",
    chainColor: "#0052FF",
    apy: 10.9,
    tvl: "$42.3M",
    isWinner: false,
    rank: 4,
  },
];

type AnalysisPhase = "scanning" | "analyzing" | "complete";

export function AnalysisOverlay({
  isOpen,
  onComplete,
  amount,
  token,
}: AnalysisOverlayProps) {
  const [phase, setPhase] = useState<AnalysisPhase>("scanning");
  const [visibleOpportunities, setVisibleOpportunities] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) {
      setPhase("scanning");
      setVisibleOpportunities(0);
      return;
    }

    // Phase 1: Scanning (2s)
    const scanTimer = setTimeout(() => {
      setPhase("analyzing");
    }, 2000);

    // Phase 2: Show opportunities one by one (3s)
    const revealTimers: NodeJS.Timeout[] = [];
    mockOpportunities.forEach((_, index) => {
      const timer = setTimeout(
        () => {
          setVisibleOpportunities(index + 1);
        },
        2000 + index * 400,
      );
      revealTimers.push(timer);
    });

    // Phase 3: Complete
    const completeTimer = setTimeout(
      () => {
        setPhase("complete");
        // Auto-advance to execution after showing the selection
        setTimeout(() => {
          onComplete();
        }, 2000);
      },
      2000 + mockOpportunities.length * 400 + 1000,
    );

    return () => {
      clearTimeout(scanTimer);
      revealTimers.forEach(clearTimeout);
      clearTimeout(completeTimer);
    };
  }, [isOpen, onComplete]);

  const winner = mockOpportunities.find((opp) => opp.isWinner);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-4xl rounded-2xl bg-[#0a0e1a] border-2 border-[#1e2433] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="relative border-b-2 border-[#1e2433] bg-gradient-to-r from-[#0a0e1a] to-[#141823] p-6">
                {/* AI Agent Badge */}
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

                {/* Amount Display */}
                <div className="rounded-lg bg-[#141823] border-2 border-[#1e2433] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-[#8b92a8]">
                      Optimizing
                    </span>
                    <span className="font-mono text-xl font-bold text-white">
                      {amount.toLocaleString()} {token.symbol}
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
                    {/* Header Row */}
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

                    {/* Opportunity Rows */}
                    {mockOpportunities
                      .slice(0, visibleOpportunities)
                      .map((opp, index) => (
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
                          {/* Rank */}
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

                          {/* Protocol */}
                          <div className="col-span-4 flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 ${
                                opp.isWinner
                                  ? "bg-[#10b981]/20 border-[#10b981]"
                                  : "bg-[#1e2433] border-[#1e2433]"
                              }`}
                            >
                              <span
                                className={`text-lg ${
                                  opp.isWinner ? "text-white" : "text-[#8b92a8]"
                                }`}
                              >
                                {opp.protocolIcon}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-bold ${
                                    opp.isWinner
                                      ? "text-white text-lg"
                                      : "text-[#8b92a8]"
                                  }`}
                                >
                                  {opp.protocol}
                                </span>
                                {/* HOOK BADGE - THE KEY DIFFERENTIATOR */}
                                {opp.hasHook && (
                                  <div className="flex items-center gap-1 rounded-md bg-gradient-to-r from-[#10b981] to-[#3b82f6] px-2 py-0.5">
                                    <Settings className="h-3 w-3 text-white" />
                                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                                      Hook
                                    </span>
                                  </div>
                                )}
                              </div>
                              {opp.hasHook && (
                                <p className="text-xs font-mono text-[#10b981]">
                                  Enhanced w/ {opp.hookDescription}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Network */}
                          <div className="col-span-3 flex items-center gap-2">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-full border-2"
                              style={{
                                backgroundColor: `${opp.chainColor}20`,
                                borderColor: `${opp.chainColor}60`,
                              }}
                            >
                              <span
                                className="text-sm"
                                style={{ color: opp.chainColor }}
                              >
                                {opp.chainIcon}
                              </span>
                            </div>
                            <span
                              className={`font-bold ${
                                opp.isWinner ? "text-white" : "text-[#8b92a8]"
                              }`}
                            >
                              {opp.chain}
                            </span>
                          </div>

                          {/* APY */}
                          <div className="col-span-2 flex items-center">
                            <span
                              className={`font-mono text-lg font-bold ${
                                opp.isWinner
                                  ? "text-[#10b981]"
                                  : "text-[#8b92a8]"
                              }`}
                            >
                              {opp.apy}%
                            </span>
                          </div>

                          {/* TVL */}
                          <div className="col-span-2 flex items-center">
                            <span
                              className={`font-mono text-sm ${
                                opp.isWinner ? "text-white" : "text-[#8b92a8]"
                              }`}
                            >
                              {opp.tvl}
                            </span>
                          </div>

                          {/* Winner Justification */}
                          {opp.isWinner && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ delay: 0.3 }}
                              className="col-span-12 mt-2 flex items-center gap-2 text-sm font-bold text-[#10b981]"
                            >
                              <TrendingUp className="h-4 w-4" />
                              Best Strategy - Highest APY with Auto-Compounding
                              Hook
                            </motion.div>
                          )}
                        </motion.div>
                      ))}
                  </div>
                )}

                {/* Execution Status */}
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
                            Routing to {winner.protocol} on {winner.chain}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono text-[#8b92a8] mb-1">
                          Expected APY
                        </p>
                        <p className="font-mono text-2xl font-bold text-[#10b981]">
                          {winner.apy}%
                        </p>
                      </div>
                    </div>

                    {/* Li.Fi Attribution */}
                    <div className="mt-4 pt-4 border-t border-[#1e2433] flex items-center justify-between">
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
