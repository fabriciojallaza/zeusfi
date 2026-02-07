import { useAccount } from "wagmi";
import { ActivityLog } from "@/app/components/activity-log";
import { useAuth } from "@/hooks/useAuth";
import { useRebalanceHistory } from "@/hooks/useRebalanceHistory";
import { Wallet, Activity } from "lucide-react";

export function HistoryPage() {
  const { isConnected, address } = useAccount();
  const { isAuthenticated } = useAuth();
  const { data: entries, isLoading, error } = useRebalanceHistory(address);

  if (!isConnected || !isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1e293b] border border-[#334155]">
              <Wallet className="h-8 w-8 text-[#64748b]" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Connect Wallet
          </h2>
          <p className="text-sm font-mono text-[#64748b]">
            Connect your wallet to view activity history
          </p>
        </div>
      </div>
    );
  }

  if (!isLoading && (!entries || entries.length === 0)) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1e293b] border border-[#334155]">
              <Activity className="h-8 w-8 text-[#64748b]" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            No History Yet
          </h2>
          <p className="text-sm font-mono text-[#64748b]">
            Your rebalance history will appear here once the agent starts
            working
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <ActivityLog entries={entries || []} isLoading={isLoading} error={error?.message} />
    </div>
  );
}
