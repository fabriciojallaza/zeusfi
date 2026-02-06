import { useState } from "react";
import {
  TrendingUp,
  Shield,
  ArrowDownToLine,
  ExternalLink,
  Sparkles,
  Activity,
  ChevronRight,
  Settings,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { motion } from "motion/react";
import type { Token } from "@/app/components/token-table";

interface ActiveDashboardProps {
  depositedAmount: number;
  currentAPY: number;
  onWithdraw: () => void;
  depositedToken: Token;
  deployedProtocol?: string;
  deployedChain?: string;
  deployedChainIcon?: string;
  deployedChainColor?: string;
  ensName?: string;
  ensStrategy?: string;
}

export function ActiveDashboard({
  depositedAmount,
  currentAPY,
  onWithdraw,
  depositedToken,
  deployedProtocol = "Uniswap v4",
  deployedChain = "Base",
  deployedChainIcon = "⬡",
  deployedChainColor = "#0052FF",
  ensName = "adolfo.eth",
  ensStrategy = "Balanced Strategy (Min 5% APY)",
}: ActiveDashboardProps) {
  // Calculate estimated earnings (simple daily calculation for demo)
  const dailyRate = currentAPY / 365 / 100;
  const estimatedDailyEarnings = depositedAmount * dailyRate;
  const estimatedYearlyEarnings = depositedAmount * (currentAPY / 100);

  // Mock deployment timestamp
  const deployedTime = "2h 14m ago";

  return (
    <div className="w-full max-w-5xl">
      {/* AI Agent Status Header with ENS */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#10b981]/20 to-[#3b82f6]/20 border-2 border-[#10b981] p-6 shadow-lg shadow-[#10b981]/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 20px rgba(16, 185, 129, 0.4)",
                  "0 0 40px rgba(16, 185, 129, 0.7)",
                  "0 0 20px rgba(16, 185, 129, 0.4)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#10b981] to-[#3b82f6]"
            >
              <Sparkles className="h-7 w-7 text-white" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Capital Actively Deployed
              </h1>
              <p className="text-sm text-[#8b92a8] font-mono">
                AI Agent Status:{" "}
                <span className="text-[#10b981]">● ACTIVE</span> •{" "}
                {deployedTime}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono text-[#8b92a8] uppercase tracking-wider">
              Total Value
            </p>
            <p className="font-mono text-3xl font-bold text-white">
              ${(depositedAmount * 1).toLocaleString()}
            </p>
          </div>
        </div>

        {/* ENS Strategy Verification */}
        <div className="rounded-lg bg-[#0a0e1a] border border-[#10b981]/30 p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#10b981]">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                Strategy Aligned with {ensName}
              </p>
              <p className="text-xs font-mono text-[#8b92a8]">
                {ensStrategy} ✓ Verified
              </p>
            </div>
          </div>
          <CheckCircle2 className="h-5 w-5 text-[#10b981]" />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Deployment Path */}
        <div className="lg:col-span-2 space-y-6">
          {/* Deployment Path Visualization */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-[#0a0e1a] border-2 border-[#1e2433] p-6 shadow-xl"
          >
            <h2 className="mb-6 text-sm font-mono font-bold text-[#8b92a8] uppercase tracking-wider">
              Deployment Path
            </h2>

            <div className="space-y-4">
              {/* Step 1: Your Wallet */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#141823] border-2 border-[#1e2433]">
                  <Shield className="h-6 w-6 text-[#8b92a8]" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">Your Wallet</p>
                  <p className="text-sm font-mono text-[#8b92a8]">{ensName}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-bold text-white">
                    {depositedAmount.toLocaleString()} {depositedToken.symbol}
                  </p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ChevronRight className="h-6 w-6 text-[#3b82f6] rotate-90" />
                </motion.div>
              </div>

              {/* Step 2: Li.Fi Router */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-[#3b82f6]/20 to-[#8b5cf6]/20 border-2 border-[#3b82f6]">
                  <Activity className="h-6 w-6 text-[#3b82f6]" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">
                    Li.Fi Cross-Chain Router
                  </p>
                  <p className="text-sm font-mono text-[#8b92a8]">
                    Bridge & Route Optimizer
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse"></div>
                  <span className="text-sm font-mono text-[#10b981]">
                    Active
                  </span>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                >
                  <ChevronRight className="h-6 w-6 text-[#10b981] rotate-90" />
                </motion.div>
              </div>

              {/* Step 3: Deployed Protocol with HOOK */}
              <div className="rounded-xl bg-gradient-to-r from-[#10b981]/10 to-[#3b82f6]/10 border-2 border-[#10b981] p-4">
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#10b981]/20 border-2 border-[#10b981]">
                    <span className="text-2xl">🦄</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-white text-lg">
                        {deployedProtocol}
                      </p>
                      {/* HOOK BADGE */}
                      <div className="flex items-center gap-1 rounded-md bg-gradient-to-r from-[#10b981] to-[#3b82f6] px-2 py-1">
                        <Settings className="h-3.5 w-3.5 text-white" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Hook
                        </span>
                      </div>
                    </div>
                    <p className="text-xs font-mono text-[#10b981] mb-1">
                      Enhanced w/ Auto-Compound Hook
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-[#8b92a8]">
                        on
                      </span>
                      <div className="flex items-center gap-1">
                        <div
                          className="flex h-5 w-5 items-center justify-center rounded-full border"
                          style={{
                            backgroundColor: `${deployedChainColor}30`,
                            borderColor: `${deployedChainColor}60`,
                          }}
                        >
                          <span
                            className="text-xs"
                            style={{ color: deployedChainColor }}
                          >
                            {deployedChainIcon}
                          </span>
                        </div>
                        <span
                          className="font-bold text-sm"
                          style={{ color: deployedChainColor }}
                        >
                          {deployedChain}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-2xl font-bold text-[#10b981]">
                      {currentAPY}%
                    </p>
                    <p className="text-xs font-mono text-[#8b92a8]">APY</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-[#10b981]/30">
                  <p className="text-xs font-mono text-[#8b92a8]">
                    <span className="text-[#10b981]">● Hook Optimized:</span>{" "}
                    Auto-compounding rewards every block
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Performance Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-[#0a0e1a] border-2 border-[#1e2433] p-6 shadow-xl"
          >
            <h2 className="mb-6 text-sm font-mono font-bold text-[#8b92a8] uppercase tracking-wider">
              Earnings Projection (Hook-Enhanced)
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-[#141823] border-2 border-[#1e2433] p-4">
                <p className="mb-2 text-xs font-mono text-[#8b92a8] uppercase">
                  Daily
                </p>
                <p className="font-mono text-xl font-bold text-[#10b981]">
                  +{estimatedDailyEarnings.toFixed(2)}
                </p>
                <p className="text-xs font-mono text-[#8b92a8]">
                  {depositedToken.symbol}
                </p>
              </div>
              <div className="rounded-xl bg-[#141823] border-2 border-[#1e2433] p-4">
                <p className="mb-2 text-xs font-mono text-[#8b92a8] uppercase">
                  Monthly
                </p>
                <p className="font-mono text-xl font-bold text-[#10b981]">
                  +{(estimatedDailyEarnings * 30).toFixed(2)}
                </p>
                <p className="text-xs font-mono text-[#8b92a8]">
                  {depositedToken.symbol}
                </p>
              </div>
              <div className="rounded-xl bg-[#141823] border-2 border-[#1e2433] p-4">
                <p className="mb-2 text-xs font-mono text-[#8b92a8] uppercase">
                  Yearly
                </p>
                <p className="font-mono text-xl font-bold text-[#10b981]">
                  +{estimatedYearlyEarnings.toFixed(2)}
                </p>
                <p className="text-xs font-mono text-[#8b92a8]">
                  {depositedToken.symbol}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column - Actions & Info */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-[#0a0e1a] border-2 border-[#1e2433] p-6 shadow-xl"
          >
            <h3 className="mb-4 text-sm font-mono font-bold text-[#8b92a8] uppercase tracking-wider">
              Position Details
            </h3>
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-xs font-mono text-[#8b92a8]">
                  Deposited
                </p>
                <p className="font-mono text-2xl font-bold text-white">
                  {depositedAmount.toLocaleString()}
                </p>
                <p className="text-sm font-mono text-[#8b92a8]">
                  {depositedToken.symbol}
                </p>
              </div>
              <div className="h-px bg-[#1e2433]"></div>
              <div>
                <p className="mb-1 text-xs font-mono text-[#8b92a8]">
                  Protocol
                </p>
                <div className="flex items-center gap-2">
                  <p className="font-mono font-bold text-white">
                    {deployedProtocol}
                  </p>
                  <div className="flex items-center gap-1 rounded bg-gradient-to-r from-[#10b981] to-[#3b82f6] px-1.5 py-0.5">
                    <Settings className="h-3 w-3 text-white" />
                    <span className="text-[9px] font-bold text-white uppercase">
                      Hook
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-px bg-[#1e2433]"></div>
              <div>
                <p className="mb-1 text-xs font-mono text-[#8b92a8]">Network</p>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full border"
                    style={{
                      backgroundColor: `${deployedChainColor}30`,
                      borderColor: `${deployedChainColor}60`,
                    }}
                  >
                    <span
                      className="text-xs"
                      style={{ color: deployedChainColor }}
                    >
                      {deployedChainIcon}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-white">
                    {deployedChain}
                  </span>
                </div>
              </div>
              <div className="h-px bg-[#1e2433]"></div>
              <div>
                <p className="mb-1 text-xs font-mono text-[#8b92a8]">
                  Current APY
                </p>
                <p className="font-mono text-2xl font-bold text-[#10b981]">
                  {currentAPY}%
                </p>
              </div>
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl bg-[#0a0e1a] border-2 border-[#1e2433] p-6 shadow-xl"
          >
            <h3 className="mb-4 text-sm font-mono font-bold text-[#8b92a8] uppercase tracking-wider">
              Actions
            </h3>
            <div className="space-y-3">
              <Button
                onClick={onWithdraw}
                className="w-full h-12 font-mono font-bold bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#dc2626] hover:to-[#b91c1c] text-white rounded-xl transition-all shadow-lg shadow-[#ef4444]/20 hover:shadow-[#ef4444]/30"
              >
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Recall Funds via Agent
              </Button>

              <button className="w-full rounded-xl bg-[#141823] border-2 border-[#1e2433] hover:bg-[#1e2433] p-3 text-sm font-mono text-[#8b92a8] hover:text-white transition-colors flex items-center justify-center gap-2">
                View on Explorer
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </motion.div>

          {/* Agent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl bg-[#0a0e1a] border-2 border-[#1e2433] p-6 shadow-xl"
          >
            <h3 className="mb-4 text-sm font-mono font-bold text-[#8b92a8] uppercase tracking-wider">
              Agent Activity
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-[#10b981] flex-shrink-0 animate-pulse"></div>
                <div className="flex-1">
                  <p className="text-sm text-white">Hook auto-compounding</p>
                  <p className="text-xs font-mono text-[#8b92a8]">
                    Live • Every block
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-[#10b981] flex-shrink-0 animate-pulse"></div>
                <div className="flex-1">
                  <p className="text-sm text-white">Monitoring APY changes</p>
                  <p className="text-xs font-mono text-[#8b92a8]">Live</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-[#3b82f6] flex-shrink-0"></div>
                <div className="flex-1">
                  <p className="text-sm text-white">Auto-rebalance ready</p>
                  <p className="text-xs font-mono text-[#8b92a8]">
                    If APY drops &gt;2%
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
