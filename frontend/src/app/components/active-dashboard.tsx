import {
  TrendingUp,
  Shield,
  ArrowDownToLine,
  ExternalLink,
  Sparkles,
  Activity,
  ChevronRight,
  Plus,
  Clock,
  AlertTriangle,
  Fuel,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { motion } from "motion/react";
import type { PositionSummary, YieldPool } from "@/types/api";
import { CHAIN_CONFIG, getExplorerTxUrl } from "@/lib/chains";
import { useAuthStore } from "@/store/authStore";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { PROTOCOL_DISPLAY, toNum } from "@/lib/constants";

interface ActiveDashboardProps {
  positionSummary: PositionSummary | null;
  depositedAmount: number;
  depositedPool: YieldPool | null;
  onWithdraw: () => void;
  onNewDeposit: () => void;
}

export function ActiveDashboard({
  positionSummary,
  depositedAmount,
  depositedPool,
  onWithdraw,
  onNewDeposit,
}: ActiveDashboardProps) {
  const wallet = useAuthStore((s) => s.wallet);
  const { data: agentStatus } = useAgentStatus();
  const ensName = wallet?.ens_name || undefined;
  const ensStrategy = wallet
    ? `${wallet.ens_max_risk ? capitalize(wallet.ens_max_risk) : "Balanced"} Strategy${wallet.ens_min_apy ? ` (Min ${wallet.ens_min_apy}% APY)` : ""}`
    : "Balanced Strategy";

  const positions = positionSummary?.positions || [];
  const totalValue = positionSummary
    ? toNum(positionSummary.total_value_usd)
    : depositedAmount;
  const avgApy = positionSummary
    ? toNum(positionSummary.average_apy)
    : toNum(depositedPool?.apy);

  const primaryPosition = positions[0];
  const primaryChainId = primaryPosition?.chain_id || depositedPool?.chain_id;
  const primaryChainMeta = primaryChainId
    ? CHAIN_CONFIG[primaryChainId]
    : undefined;
  const primaryProtocol = primaryPosition?.protocol || depositedPool?.project;
  const protocolName = primaryProtocol
    ? PROTOCOL_DISPLAY[primaryProtocol] || primaryProtocol
    : "Unknown";
  const chainName = primaryChainMeta?.name || "Unknown";
  const chainIcon = primaryChainMeta?.icon || "?";
  const chainColor = primaryChainMeta?.color || "#8b92a8";

  const dailyRate = avgApy / 365 / 100;
  const estimatedDailyEarnings = totalValue * dailyRate;
  const estimatedYearlyEarnings = totalValue * (avgApy / 100);

  if (!positionSummary && !depositedPool) {
    return (
      <div className="w-full max-w-5xl text-center py-16">
        <Sparkles className="h-12 w-12 mx-auto mb-4 text-[#8b92a8]" />
        <h2 className="text-xl font-bold text-white mb-2">No Active Positions</h2>
        <p className="text-sm text-[#8b92a8] mb-6">Deploy USDC to start earning yield</p>
        <Button
          onClick={onNewDeposit}
          className="bg-gradient-to-r from-[#10b981] to-[#3b82f6] text-white font-bold"
        >
          <Plus className="mr-2 h-4 w-4" />
          Deploy Capital
        </Button>
      </div>
    );
  }

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
                <span className="text-[#10b981]">● ACTIVE</span>
                {positions.length > 0 && ` • ${positions.length} position${positions.length > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono text-[#8b92a8] uppercase tracking-wider">
              Total Value
            </p>
            <p className="font-mono text-3xl font-bold text-white">
              ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* ENS Strategy Verification */}
        {ensName && (
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
                  {ensStrategy}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Positions + Earnings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Positions List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-[#0a0e1a] border-2 border-[#1e2433] p-6 shadow-xl"
          >
            <h2 className="mb-6 text-sm font-mono font-bold text-[#8b92a8] uppercase tracking-wider">
              Active Positions
            </h2>

            <div className="space-y-4">
              {positions.length > 0 ? (
                positions.map((pos) => {
                  const posChainMeta = CHAIN_CONFIG[pos.chain_id];
                  const posProtocol =
                    PROTOCOL_DISPLAY[pos.protocol] || pos.protocol;
                  const posColor = posChainMeta?.color || "#8b92a8";

                  return (
                    <div
                      key={pos.id}
                      className="rounded-xl bg-gradient-to-r from-[#10b981]/10 to-[#3b82f6]/10 border-2 border-[#1e2433] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-lg border-2"
                            style={{
                              backgroundColor: `${posColor}20`,
                              borderColor: `${posColor}40`,
                            }}
                          >
                            <span style={{ color: posColor }}>
                              {posChainMeta?.icon || "?"}
                            </span>
                          </div>
                          <div>
                            <p className="font-bold text-white">{posProtocol}</p>
                            <p className="text-xs font-mono text-[#8b92a8]">
                              {pos.token} on {posChainMeta?.name || pos.chain_name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-lg font-bold text-white">
                            ${toNum(pos.amount_usd).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-sm font-mono font-bold text-[#10b981]">
                            {toNum(pos.current_apy).toFixed(2)}% APY
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                // Show deposited pool info when no backend positions yet
                <div className="rounded-xl bg-gradient-to-r from-[#10b981]/10 to-[#3b82f6]/10 border-2 border-[#10b981] p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#10b981]/20 border-2 border-[#10b981]"
                    >
                      <span className="text-xl" style={{ color: chainColor }}>
                        {chainIcon}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-white text-lg">
                        {protocolName}
                      </p>
                      <p className="text-xs font-mono text-[#8b92a8]">
                        USDC on {chainName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-2xl font-bold text-[#10b981]">
                        {avgApy.toFixed(2)}%
                      </p>
                      <p className="text-xs font-mono text-[#8b92a8]">APY</p>
                    </div>
                  </div>
                </div>
              )}
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
              Earnings Projection
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-[#141823] border-2 border-[#1e2433] p-4">
                <p className="mb-2 text-xs font-mono text-[#8b92a8] uppercase">
                  Daily
                </p>
                <p className="font-mono text-xl font-bold text-[#10b981]">
                  +{estimatedDailyEarnings.toFixed(2)}
                </p>
                <p className="text-xs font-mono text-[#8b92a8]">USDC</p>
              </div>
              <div className="rounded-xl bg-[#141823] border-2 border-[#1e2433] p-4">
                <p className="mb-2 text-xs font-mono text-[#8b92a8] uppercase">
                  Monthly
                </p>
                <p className="font-mono text-xl font-bold text-[#10b981]">
                  +{(estimatedDailyEarnings * 30).toFixed(2)}
                </p>
                <p className="text-xs font-mono text-[#8b92a8]">USDC</p>
              </div>
              <div className="rounded-xl bg-[#141823] border-2 border-[#1e2433] p-4">
                <p className="mb-2 text-xs font-mono text-[#8b92a8] uppercase">
                  Yearly
                </p>
                <p className="font-mono text-xl font-bold text-[#10b981]">
                  +{estimatedYearlyEarnings.toFixed(2)}
                </p>
                <p className="text-xs font-mono text-[#8b92a8]">USDC</p>
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
              Summary
            </h3>
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-xs font-mono text-[#8b92a8]">
                  Positions
                </p>
                <p className="font-mono text-2xl font-bold text-white">
                  {positions.length || 1}
                </p>
              </div>
              <div className="h-px bg-[#1e2433]"></div>
              <div>
                <p className="mb-1 text-xs font-mono text-[#8b92a8]">
                  Average APY
                </p>
                <p className="font-mono text-2xl font-bold text-[#10b981]">
                  {avgApy.toFixed(2)}%
                </p>
              </div>
              <div className="h-px bg-[#1e2433]"></div>
              <div>
                <p className="mb-1 text-xs font-mono text-[#8b92a8]">
                  Total Value
                </p>
                <p className="font-mono text-2xl font-bold text-white">
                  ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
                onClick={onNewDeposit}
                className="w-full h-12 font-mono font-bold bg-gradient-to-r from-[#10b981] to-[#3b82f6] hover:from-[#059669] hover:to-[#2563eb] text-white rounded-xl transition-all shadow-lg shadow-[#10b981]/20"
              >
                <Plus className="mr-2 h-4 w-4" />
                Deploy More Capital
              </Button>
              <Button
                onClick={onWithdraw}
                className="w-full h-12 font-mono font-bold bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#dc2626] hover:to-[#b91c1c] text-white rounded-xl transition-all shadow-lg shadow-[#ef4444]/20 hover:shadow-[#ef4444]/30"
              >
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Recall Funds via Agent
              </Button>
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
                  <p className="text-sm text-white">Monitoring APY changes</p>
                  <p className="text-xs font-mono text-[#8b92a8]">
                    {agentStatus?.next_scheduled ?? "Daily at 06:00 UTC"}
                  </p>
                </div>
              </div>

              {(agentStatus?.pending_transactions ?? 0) > 0 && (
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-400">
                      {agentStatus!.pending_transactions} pending transaction{agentStatus!.pending_transactions > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs font-mono text-[#8b92a8]">Being monitored</p>
                  </div>
                </div>
              )}

              {agentStatus?.last_run && (
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 text-[#8b92a8] flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-white">Last run</p>
                    <p className="text-xs font-mono text-[#8b92a8]">
                      {new Date(agentStatus.last_run).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {agentStatus?.gas_estimates && Object.keys(agentStatus.gas_estimates).length > 0 && (
                <div className="flex items-start gap-3">
                  <Fuel className="mt-0.5 h-4 w-4 text-[#8b92a8] flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-white">Gas costs</p>
                    <p className="text-xs font-mono text-[#8b92a8]">
                      {Object.entries(agentStatus.gas_estimates)
                        .map(([chain, cost]) => `${chain}: $${cost.toFixed(4)}`)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-[#3b82f6] flex-shrink-0"></div>
                <div className="flex-1">
                  <p className="text-sm text-white">Auto-rebalance ready</p>
                  <p className="text-xs font-mono text-[#8b92a8]">
                    If APY drops &gt;1% (gas-adjusted)
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
