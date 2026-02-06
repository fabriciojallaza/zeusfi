import { useState } from "react";
import { DollarSign, TrendingUp, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { motion } from "motion/react";

export interface Token {
  symbol: string;
  name: string;
  balance: number;
  apy: number;
  icon: string;
  color: string;
}

interface TokenTableProps {
  tokens: Token[];
  onSelectToken: (token: Token) => void;
  isConnected: boolean;
}

export function TokenTable({
  tokens,
  onSelectToken,
  isConnected,
}: TokenTableProps) {
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);

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
                  Asset Selection • Market Overview
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono text-[#8b92a8] uppercase tracking-wider">
                Available Assets
              </p>
              <p className="font-mono text-3xl font-bold text-white">
                {tokens.length}
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
              <div className="col-span-3 text-xs font-mono font-bold text-[#8b92a8] uppercase tracking-wider">
                Est. APY
              </div>
              <div className="col-span-2 text-xs font-mono font-bold text-[#8b92a8] uppercase tracking-wider text-right">
                Action
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y-2 divide-[#1e2433] bg-[#0a0e1a]">
              {tokens.map((token) => (
                <motion.div
                  key={token.symbol}
                  onMouseEnter={() => setHoveredToken(token.symbol)}
                  onMouseLeave={() => setHoveredToken(null)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`grid grid-cols-12 gap-4 px-6 py-5 transition-all duration-200 ${
                    hoveredToken === token.symbol
                      ? "bg-[#1a1f2e] border-l-4 border-l-[#3b82f6]"
                      : "border-l-4 border-l-transparent"
                  }`}
                >
                  {/* Asset */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-lg border-2"
                      style={{
                        backgroundColor: `${token.color}20`,
                        borderColor: `${token.color}40`,
                      }}
                    >
                      <span
                        className="text-lg font-bold"
                        style={{ color: token.color }}
                      >
                        {token.icon}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg">
                        {token.symbol}
                      </p>
                      <p className="text-xs font-mono text-[#8b92a8]">
                        {token.name}
                      </p>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="col-span-3 flex items-center">
                    {isConnected ? (
                      <div>
                        <p className="font-mono text-lg font-bold text-white">
                          {token.balance.toLocaleString()}
                        </p>
                        <p className="text-xs font-mono text-[#8b92a8]">
                          {token.symbol}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm font-mono text-[#8b92a8]">
                        Connect wallet
                      </p>
                    )}
                  </div>

                  {/* APY */}
                  <div className="col-span-3 flex items-center">
                    <div
                      className="inline-flex items-center gap-2 rounded-lg border-2 px-4 py-2"
                      style={{
                        backgroundColor: `${token.color}10`,
                        borderColor: `${token.color}40`,
                      }}
                    >
                      <TrendingUp
                        className="h-4 w-4"
                        style={{ color: token.color }}
                      />
                      <span
                        className="font-mono text-lg font-bold"
                        style={{ color: token.color }}
                      >
                        ~{token.apy}%
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="col-span-2 flex items-center justify-end">
                    <Button
                      onClick={() => onSelectToken(token)}
                      disabled={!isConnected}
                      className="font-mono font-bold bg-gradient-to-r from-[#10b981] to-[#3b82f6] hover:from-[#059669] hover:to-[#2563eb] text-white rounded-lg transition-all duration-200 shadow-lg shadow-[#10b981]/20 hover:shadow-[#10b981]/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      Deploy
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="border-t-2 border-[#1e2433] bg-[#141823] p-6">
          <div className="rounded-xl bg-[#0a0e1a] border border-[#1e2433] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3b82f6]/20 flex-shrink-0 border border-[#3b82f6]">
                <DollarSign className="h-5 w-5 text-[#3b82f6]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-1">
                  Multi-Asset AI Optimization
                </p>
                <p className="text-xs font-mono text-[#8b92a8] leading-relaxed">
                  Each asset is deployed via AI analysis to the highest-yielding
                  protocol across Base, Arbitrum, and Optimism. APY rates are
                  real-time estimates and may vary.
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
