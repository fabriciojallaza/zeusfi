import { motion } from "motion/react";
import {
  Vault,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Shield,
  Activity as ActivityIcon,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";

interface InstitutionalDashboardProps {
  onActivateAgent: () => void;
  totalValue: number;
  isAgentActive?: boolean;
}

export function InstitutionalDashboard({
  onActivateAgent,
  totalValue,
  isAgentActive = false,
}: InstitutionalDashboardProps) {
  const agentAddress = "0x71...3A9";
  const estimatedAPY = 18.7;
  const activePositions = 3;
  const totalYieldEarned = 47.95;

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Main Content */}
        <div className="col-span-8 space-y-6">
          {/* Smart Yield Vault Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-[#334155] p-8 shadow-xl"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] shadow-lg shadow-[#3b82f6]/30">
                  <Vault className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    Smart Yield Vault
                  </h2>
                  <p className="text-sm font-mono text-[#64748b]">
                    Autonomous cross-chain yield optimization
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-mono text-[#64748b] uppercase mb-1">
                  Status
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${isAgentActive ? "bg-[#10b981] animate-pulse" : "bg-[#64748b]"}`}
                  />
                  <span className="font-mono font-bold text-white text-sm">
                    {isAgentActive ? "ACTIVE" : "IDLE"}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Value Locked */}
            <div className="rounded-xl bg-[#0f172a] border border-[#334155] p-6 mb-6">
              <p className="text-sm font-mono text-[#64748b] uppercase mb-2">
                Total Value Locked
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-5xl font-bold text-white">
                  ${totalValue.toLocaleString()}
                </span>
                <span className="font-mono text-xl text-[#64748b]">USDC</span>
              </div>
              {isAgentActive && (
                <div className="mt-4 pt-4 border-t border-[#334155]">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-mono text-[#64748b] mb-1">
                        Est. APY
                      </p>
                      <p className="font-mono text-xl font-bold text-[#10b981]">
                        {estimatedAPY}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-mono text-[#64748b] mb-1">
                        Positions
                      </p>
                      <p className="font-mono text-xl font-bold text-white">
                        {activePositions}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-mono text-[#64748b] mb-1">
                        Yield Earned
                      </p>
                      <p className="font-mono text-xl font-bold text-[#10b981]">
                        +${totalYieldEarned}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Button */}
            {!isAgentActive && (
              <Button
                onClick={onActivateAgent}
                className="w-full h-16 font-mono font-bold bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] hover:from-[#2563eb] hover:to-[#7c3aed] text-white rounded-xl text-lg transition-all shadow-lg shadow-[#3b82f6]/30 hover:shadow-[#3b82f6]/50"
              >
                <Sparkles className="mr-3 h-6 w-6" />
                Deposit & Activate Agent
                <ArrowRight className="ml-3 h-6 w-6" />
              </Button>
            )}
          </motion.div>

          {/* Quick Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-4"
          >
            <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3b82f6]/20">
                  <TrendingUp className="h-5 w-5 text-[#3b82f6]" />
                </div>
                <p className="text-xs font-mono text-[#64748b] uppercase">
                  Best APY Found
                </p>
              </div>
              <p className="font-mono text-2xl font-bold text-white">18.7%</p>
              <p className="text-xs font-mono text-[#64748b] mt-1">
                Uniswap v4 (Base)
              </p>
            </div>

            <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#10b981]/20">
                  <ActivityIcon className="h-5 w-5 text-[#10b981]" />
                </div>
                <p className="text-xs font-mono text-[#64748b] uppercase">
                  Chains Monitored
                </p>
              </div>
              <p className="font-mono text-2xl font-bold text-white">12</p>
              <p className="text-xs font-mono text-[#64748b] mt-1">
                Real-time scanning
              </p>
            </div>

            <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f59e0b]/20">
                  <Shield className="h-5 w-5 text-[#f59e0b]" />
                </div>
                <p className="text-xs font-mono text-[#64748b] uppercase">
                  Protocols Analyzed
                </p>
              </div>
              <p className="font-mono text-2xl font-bold text-white">50+</p>
              <p className="text-xs font-mono text-[#64748b] mt-1">
                DeFi protocols
              </p>
            </div>
          </motion.div>

          {/* Execution Flow Diagram */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-[#1e293b] border border-[#334155] p-6"
          >
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider mb-6">
              How The Agent Works
            </h3>

            {/* 3-Step Horizontal Flow */}
            <div className="grid grid-cols-3 gap-4">
              {/* Step 1: User Vault */}
              <div className="relative">
                <div className="rounded-xl bg-[#0f172a] border-2 border-[#334155] p-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#3b82f6]/20 mx-auto mb-3">
                    <Vault className="h-6 w-6 text-[#3b82f6]" />
                  </div>
                  <p className="text-xs font-mono font-bold text-white mb-1">
                    User Vault
                  </p>
                  <p className="text-xs font-mono text-[#64748b]">Your USDC</p>
                </div>
                {/* Arrow */}
                <div className="absolute top-1/2 -right-6 -translate-y-1/2 z-10">
                  <ArrowRight className="h-6 w-6 text-[#3b82f6]" />
                </div>
              </div>

              {/* Step 2: Li.Fi Bridge */}
              <div className="relative">
                <div className="rounded-xl bg-gradient-to-r from-[#3b82f6]/10 to-[#8b5cf6]/10 border-2 border-[#3b82f6] p-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#3b82f6] mx-auto mb-3">
                    <span className="text-xl">⚡</span>
                  </div>
                  <p className="text-xs font-mono font-bold text-white mb-1">
                    Li.Fi Router
                  </p>
                  <p className="text-xs font-mono text-[#64748b]">
                    Cross-Chain Bridge
                  </p>
                </div>
                {/* Arrow */}
                <div className="absolute top-1/2 -right-6 -translate-y-1/2 z-10">
                  <ArrowRight className="h-6 w-6 text-[#10b981]" />
                </div>
              </div>

              {/* Step 3: Yield Position */}
              <div>
                <div className="rounded-xl bg-[#0f172a] border-2 border-[#10b981] p-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#10b981]/20 mx-auto mb-3">
                    <span className="text-2xl">🦄</span>
                  </div>
                  <p className="text-xs font-mono font-bold text-white mb-1">
                    Uniswap v4
                  </p>
                  <p className="text-xs font-mono text-[#10b981]">
                    Yield Position
                  </p>
                </div>
              </div>
            </div>

            {/* Animation Path */}
            <div className="mt-4 rounded-lg bg-[#0f172a] border border-[#334155] p-3">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ x: [0, 10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="h-2 w-2 rounded-full bg-[#3b82f6]"
                />
                <p className="text-xs font-mono text-[#64748b]">
                  Agent automatically routes funds to optimal yield
                  opportunities
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column - Authorized Agent Panel */}
        <div className="col-span-4 space-y-6">
          {/* Authorized Agent Identity */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl bg-gradient-to-br from-[#3b82f6]/10 to-[#8b5cf6]/10 border-2 border-[#3b82f6] p-6 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 20px rgba(59, 130, 246, 0.4)",
                    "0 0 30px rgba(59, 130, 246, 0.7)",
                    "0 0 20px rgba(59, 130, 246, 0.4)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6]"
              >
                <Sparkles className="h-6 w-6 text-white" />
              </motion.div>
              <div>
                <p className="text-xs font-mono text-[#64748b] uppercase">
                  Authorized Agent
                </p>
                <p className="font-mono font-bold text-white">AI Brain</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg bg-[#0f172a] border border-[#334155] p-3">
                <p className="text-xs font-mono text-[#64748b] mb-1">
                  Agent Address
                </p>
                <p className="font-mono font-bold text-white">{agentAddress}</p>
              </div>

              <div className="rounded-lg bg-[#0f172a] border border-[#334155] p-3">
                <p className="text-xs font-mono text-[#64748b] mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
                  <p className="font-mono font-bold text-[#10b981]">
                    Online & Monitoring
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-[#0f172a] border border-[#334155] p-3">
                <p className="text-xs font-mono text-[#64748b] mb-1">
                  Permissions
                </p>
                <div className="space-y-1 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                    <p className="text-xs font-mono text-white">
                      Scan Protocols
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                    <p className="text-xs font-mono text-white">
                      Execute Rebalance
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                    <p className="text-xs font-mono text-white">
                      Use Li.Fi Bridge
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Recent Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-[#1e293b] border border-[#334155] p-6"
          >
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider mb-4">
              Recent Agent Activity
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-[#10b981] mt-1.5 flex-shrink-0 animate-pulse" />
                <div className="flex-1">
                  <p className="text-sm text-white">Detected better APY</p>
                  <p className="text-xs font-mono text-[#64748b]">2 min ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-[#10b981] mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-white">Compounded rewards</p>
                  <p className="text-xs font-mono text-[#64748b]">1 hour ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-[#64748b] mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-white">Scanned protocols</p>
                  <p className="text-xs font-mono text-[#64748b]">
                    2 hours ago
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ENS Strategy Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-[#1e293b] border border-[#334155] p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-[#3b82f6]" />
              <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                ENS Strategy
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-mono text-[#64748b] mb-1">
                  Risk Profile
                </p>
                <p className="font-mono font-bold text-white">Balanced</p>
              </div>
              <div>
                <p className="text-xs font-mono text-[#64748b] mb-1">
                  Min APY Target
                </p>
                <p className="font-mono font-bold text-[#3b82f6]">5.0%</p>
              </div>
              <div>
                <p className="text-xs font-mono text-[#64748b] mb-1">
                  Enabled Chains
                </p>
                <div className="flex gap-1 mt-1">
                  {["Ξ", "◆", "⬡", "●"].map((icon, i) => (
                    <div
                      key={i}
                      className="flex h-6 w-6 items-center justify-center rounded bg-[#0f172a] border border-[#334155]"
                    >
                      <span className="text-xs text-[#64748b]">{icon}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
