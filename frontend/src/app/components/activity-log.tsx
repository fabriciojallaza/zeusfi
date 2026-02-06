import { motion } from "motion/react";
import {
  Activity,
  ExternalLink,
  TrendingUp,
  RefreshCw,
  ArrowDownToLine,
} from "lucide-react";

interface ActivityEntry {
  id: string;
  time: string;
  action: string;
  actionType: "deposit" | "rebalance" | "compound" | "withdraw";
  route: {
    from: string;
    to: string;
    fromIcon: string;
    toIcon: string;
    fromColor: string;
    toColor: string;
  };
  infrastructure: string;
  outcome: string;
  outcomeValue: number;
  txHash: string;
}

const mockActivities: ActivityEntry[] = [
  {
    id: "1",
    time: "2 hours ago",
    action: "Rebalance",
    actionType: "rebalance",
    route: {
      from: "Arbitrum",
      to: "Base",
      fromIcon: "◆",
      toIcon: "⬡",
      fromColor: "#28A0F0",
      toColor: "#0052FF",
    },
    infrastructure: "Li.Fi",
    outcome: "+$12.50 Yield Earned",
    outcomeValue: 12.5,
    txHash: "0x8a3f...2b9c",
  },
  {
    id: "2",
    time: "5 hours ago",
    action: "Compound",
    actionType: "compound",
    route: {
      from: "Base",
      to: "Base",
      fromIcon: "⬡",
      toIcon: "⬡",
      fromColor: "#0052FF",
      toColor: "#0052FF",
    },
    infrastructure: "Uniswap v4",
    outcome: "+$8.75 Yield Earned",
    outcomeValue: 8.75,
    txHash: "0x4c2d...7a1e",
  },
  {
    id: "3",
    time: "1 day ago",
    action: "Deposit",
    actionType: "deposit",
    route: {
      from: "Arbitrum",
      to: "Base",
      fromIcon: "◆",
      toIcon: "⬡",
      fromColor: "#28A0F0",
      toColor: "#0052FF",
    },
    infrastructure: "Li.Fi",
    outcome: "+500.00 USDC Deployed",
    outcomeValue: 500,
    txHash: "0x9f1a...3d8b",
  },
  {
    id: "4",
    time: "2 days ago",
    action: "Rebalance",
    actionType: "rebalance",
    route: {
      from: "Base",
      to: "Optimism",
      fromIcon: "⬡",
      toIcon: "●",
      fromColor: "#0052FF",
      toColor: "#FF0420",
    },
    infrastructure: "Li.Fi",
    outcome: "+$15.30 Yield Earned",
    outcomeValue: 15.3,
    txHash: "0x6b8e...4f2c",
  },
  {
    id: "5",
    time: "3 days ago",
    action: "Compound",
    actionType: "compound",
    route: {
      from: "Optimism",
      to: "Optimism",
      fromIcon: "●",
      toIcon: "●",
      fromColor: "#FF0420",
      toColor: "#FF0420",
    },
    infrastructure: "Aave v3",
    outcome: "+$6.40 Yield Earned",
    outcomeValue: 6.4,
    txHash: "0x2e5c...8a9f",
  },
];

export function ActivityLog() {
  const getActionIcon = (type: ActivityEntry["actionType"]) => {
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

  const getActionColor = (type: ActivityEntry["actionType"]) => {
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

  const totalYield = mockActivities
    .filter((a) => a.actionType === "compound" || a.actionType === "rebalance")
    .reduce((sum, a) => sum + a.outcomeValue, 0);

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
              Total Yield Earned
            </p>
            <p className="font-mono text-2xl font-bold text-[#10b981]">
              +${totalYield.toFixed(2)}
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
            Infrastructure
          </div>
          <div className="col-span-2 text-xs font-mono font-bold text-[#64748b] uppercase">
            Outcome
          </div>
          <div className="col-span-1 text-xs font-mono font-bold text-[#64748b] uppercase">
            Tx
          </div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-[#334155]">
          {mockActivities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-[#0f172a] transition-colors"
            >
              {/* Time */}
              <div className="col-span-2 flex items-center">
                <span className="text-sm font-mono text-[#64748b]">
                  {activity.time}
                </span>
              </div>

              {/* Action */}
              <div className="col-span-2 flex items-center">
                <div
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${getActionColor(
                    activity.actionType,
                  )}`}
                >
                  {getActionIcon(activity.actionType)}
                  <span className="text-xs font-mono font-bold">
                    {activity.action}
                  </span>
                </div>
              </div>

              {/* Route */}
              <div className="col-span-3 flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded border"
                    style={{
                      backgroundColor: `${activity.route.fromColor}20`,
                      borderColor: `${activity.route.fromColor}60`,
                    }}
                  >
                    <span
                      className="text-sm"
                      style={{ color: activity.route.fromColor }}
                    >
                      {activity.route.fromIcon}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-white">
                    {activity.route.from}
                  </span>
                </div>
                <span className="text-[#64748b]">→</span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded border"
                    style={{
                      backgroundColor: `${activity.route.toColor}20`,
                      borderColor: `${activity.route.toColor}60`,
                    }}
                  >
                    <span
                      className="text-sm"
                      style={{ color: activity.route.toColor }}
                    >
                      {activity.route.toIcon}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-white">
                    {activity.route.to}
                  </span>
                </div>
              </div>

              {/* Infrastructure */}
              <div className="col-span-2 flex items-center">
                <div className="rounded-md bg-[#3b82f6]/10 border border-[#3b82f6]/30 px-2 py-1">
                  <span className="text-xs font-mono text-[#3b82f6]">
                    via {activity.infrastructure}
                  </span>
                </div>
              </div>

              {/* Outcome */}
              <div className="col-span-2 flex items-center">
                <span className="text-sm font-mono font-bold text-[#10b981]">
                  {activity.outcome}
                </span>
              </div>

              {/* Tx Hash */}
              <div className="col-span-1 flex items-center justify-center">
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#334155] hover:bg-[#475569] transition-colors group">
                  <ExternalLink className="h-4 w-4 text-[#64748b] group-hover:text-white transition-colors" />
                </button>
              </div>
            </motion.div>
          ))}
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
            {mockActivities.length}
          </p>
        </div>
        <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-4">
          <p className="text-xs font-mono text-[#64748b] mb-2 uppercase">
            Successful Rate
          </p>
          <p className="font-mono text-3xl font-bold text-[#10b981]">100%</p>
        </div>
        <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-4">
          <p className="text-xs font-mono text-[#64748b] mb-2 uppercase">
            Li.Fi Executions
          </p>
          <p className="font-mono text-3xl font-bold text-[#3b82f6]">
            {mockActivities.filter((a) => a.infrastructure === "Li.Fi").length}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
