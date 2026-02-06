import { motion } from "motion/react";
import {
  Activity,
  ExternalLink,
  TrendingUp,
  RefreshCw,
  ArrowDownToLine,
} from "lucide-react";
import { Skeleton } from "@/app/components/ui/skeleton";
import type { RebalanceHistory } from "@/types/api";
import { CHAIN_CONFIG, getExplorerTxUrl } from "@/lib/chains";
import { PROTOCOL_DISPLAY } from "@/lib/constants";

interface ActivityLogProps {
  entries: RebalanceHistory[];
  isLoading: boolean;
  error?: string | null;
}

type ActionType = "deposit" | "rebalance" | "compound" | "withdraw";

export function ActivityLog({ entries, isLoading, error }: ActivityLogProps) {
  const getActionType = (entry: RebalanceHistory): ActionType => {
    const status = entry.status.toLowerCase();
    if (status.includes("withdraw")) return "withdraw";
    if (entry.from_chain_id !== entry.to_chain_id) return "rebalance";
    if (entry.from_protocol !== entry.to_protocol) return "rebalance";
    return "deposit";
  };

  const getActionIcon = (type: ActionType) => {
    switch (type) {
      case "deposit":
        return <ArrowDownToLine className="h-4 w-4" />;
      case "rebalance":
        return <RefreshCw className="h-4 w-4" />;
      case "compound":
        return <TrendingUp className="h-4 w-4" />;
      case "withdraw":
        return <ArrowDownToLine className="h-4 w-4 rotate-180" />;
    }
  };

  const getActionColor = (type: ActionType) => {
    switch (type) {
      case "deposit":
        return "bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]";
      case "rebalance":
        return "bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]";
      case "compound":
        return "bg-[#10b981]/20 text-[#10b981] border-[#10b981]";
      case "withdraw":
        return "bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]";
    }
  };

  const totalYield = entries
    .filter((e) => e.apy_improvement && parseFloat(e.apy_improvement) > 0)
    .reduce((sum, e) => sum + parseFloat(e.amount_usd || "0"), 0);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6]">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Activity Log</h1>
              <p className="text-sm font-mono text-[#64748b]">
                Complete transaction history
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-[#1e293b] border border-[#334155] px-6 py-3 text-right">
            <p className="text-xs font-mono text-[#64748b] mb-1">
              Total Transactions
            </p>
            <p className="font-mono text-2xl font-bold text-white">
              {entries.length}
            </p>
          </div>
        </div>
      </div>

      {/* Activity Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-[#1e293b] border border-[#334155] overflow-hidden"
      >
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-[#334155] bg-[#0f172a]">
          <div className="col-span-2 text-xs font-mono font-bold text-[#64748b] uppercase">
            Time
          </div>
          <div className="col-span-2 text-xs font-mono font-bold text-[#64748b] uppercase">
            Action
          </div>
          <div className="col-span-3 text-xs font-mono font-bold text-[#64748b] uppercase">
            Route
          </div>
          <div className="col-span-2 text-xs font-mono font-bold text-[#64748b] uppercase">
            Amount
          </div>
          <div className="col-span-2 text-xs font-mono font-bold text-[#64748b] uppercase">
            APY Change
          </div>
          <div className="col-span-1 text-xs font-mono font-bold text-[#64748b] uppercase">
            Tx
          </div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-[#334155]">
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-12 gap-4 px-6 py-4">
                <div className="col-span-2">
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="col-span-2">
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
                <div className="col-span-3">
                  <Skeleton className="h-7 w-full" />
                </div>
                <div className="col-span-2">
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="col-span-2">
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="col-span-1">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            ))}

          {!isLoading && error && (
            <div className="px-6 py-12 text-center">
              <div className="flex h-12 w-12 mx-auto mb-3 items-center justify-center rounded-full bg-[#ef4444]/20 border border-[#ef4444]/40">
                <span className="text-[#ef4444] text-lg">!</span>
              </div>
              <p className="text-sm font-bold text-white mb-1">Failed to load history</p>
              <p className="text-xs font-mono text-[#64748b]">{error}</p>
            </div>
          )}

          {!isLoading && !error &&
            entries.map((entry, index) => {
              const actionType = getActionType(entry);
              const fromChainMeta = CHAIN_CONFIG[entry.from_chain_id];
              const toChainMeta = CHAIN_CONFIG[entry.to_chain_id];
              const fromColor = fromChainMeta?.color || "#8b92a8";
              const toColor = toChainMeta?.color || "#8b92a8";
              const explorerUrl =
                entry.tx_hash && entry.to_chain_id
                  ? getExplorerTxUrl(entry.to_chain_id, entry.tx_hash)
                  : "#";

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-[#0f172a] transition-colors"
                >
                  {/* Time */}
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm font-mono text-[#64748b]">
                      {formatTime(entry.created_at)}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="col-span-2 flex items-center">
                    <div
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${getActionColor(actionType)}`}
                    >
                      {getActionIcon(actionType)}
                      <span className="text-xs font-mono font-bold capitalize">
                        {actionType}
                      </span>
                    </div>
                  </div>

                  {/* Route */}
                  <div className="col-span-3 flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded border"
                        style={{
                          backgroundColor: `${fromColor}20`,
                          borderColor: `${fromColor}60`,
                        }}
                      >
                        <span className="text-sm" style={{ color: fromColor }}>
                          {fromChainMeta?.icon || "?"}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-white">
                        {PROTOCOL_DISPLAY[entry.from_protocol] || entry.from_protocol}
                      </span>
                    </div>
                    <span className="text-[#64748b]">&rarr;</span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded border"
                        style={{
                          backgroundColor: `${toColor}20`,
                          borderColor: `${toColor}60`,
                        }}
                      >
                        <span className="text-sm" style={{ color: toColor }}>
                          {toChainMeta?.icon || "?"}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-white">
                        {PROTOCOL_DISPLAY[entry.to_protocol] || entry.to_protocol}
                      </span>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm font-mono text-white">
                      ${parseFloat(entry.amount_usd || "0").toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* APY Change */}
                  <div className="col-span-2 flex items-center">
                    {entry.apy_improvement &&
                    parseFloat(entry.apy_improvement) > 0 ? (
                      <span className="text-sm font-mono font-bold text-[#10b981]">
                        +{parseFloat(entry.apy_improvement).toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-sm font-mono text-[#64748b]">
                        -
                      </span>
                    )}
                  </div>

                  {/* Tx Hash */}
                  <div className="col-span-1 flex items-center justify-center">
                    {entry.tx_hash ? (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#334155] hover:bg-[#475569] transition-colors group"
                      >
                        <ExternalLink className="h-4 w-4 text-[#64748b] group-hover:text-white transition-colors" />
                      </a>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#334155] opacity-30">
                        <ExternalLink className="h-4 w-4 text-[#64748b]" />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
        </div>
      </motion.div>

      {/* Summary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-3 gap-4 mt-6"
      >
        <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-4">
          <p className="text-xs font-mono text-[#64748b] mb-2 uppercase">
            Total Transactions
          </p>
          <p className="font-mono text-3xl font-bold text-white">
            {entries.length}
          </p>
        </div>
        <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-4">
          <p className="text-xs font-mono text-[#64748b] mb-2 uppercase">
            Success Rate
          </p>
          <p className="font-mono text-3xl font-bold text-[#10b981]">
            {entries.length > 0
              ? (
                  (entries.filter((e) => e.status === "completed").length /
                    entries.length) *
                  100
                ).toFixed(0)
              : 0}
            %
          </p>
        </div>
        <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-4">
          <p className="text-xs font-mono text-[#64748b] mb-2 uppercase">
            Cross-Chain
          </p>
          <p className="font-mono text-3xl font-bold text-[#3b82f6]">
            {entries.filter((e) => e.is_cross_chain).length}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
