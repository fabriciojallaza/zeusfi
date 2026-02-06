import { useState, useCallback, useMemo } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { TokenTable } from "@/app/components/token-table";
import { DepositCard } from "@/app/components/deposit-card";
import { AnalysisOverlay } from "@/app/components/analysis-overlay";
import { LiFiExecution } from "@/app/components/lifi-execution";
import { ActiveDashboard } from "@/app/components/active-dashboard";
import { ViewController } from "@/app/components/view-controller";
import { useYieldPools } from "@/hooks/useYieldPools";
import { usePositions } from "@/hooks/usePositions";
import { useAuth } from "@/hooks/useAuth";
import type { YieldPool, QuoteResponse } from "@/types/api";
import type { AssetConfig } from "@/lib/assets";
import { SUPPORTED_ASSETS, BALANCE_CHAIN_ID } from "@/lib/assets";
import { CHAIN_CONFIG } from "@/lib/chains";
import { ERC20_ABI } from "@/lib/contracts";
import { USDC_DECIMALS } from "@/lib/constants";
import { useQuote } from "@/hooks/useQuote";

type AppView = "deposit" | "processing" | "active";
type ProcessPhase = "analysis" | "execution";

export function DashboardPage() {
  const { isConnected, address } = useAccount();
  const { isAuthenticated } = useAuth();
  const { data: yieldPools, isLoading: poolsLoading, error: poolsError } = useYieldPools();
  const { data: positionSummary } = usePositions(address);
  const quoteMutation = useQuote();

  const [currentView, setCurrentView] = useState<AppView>("deposit");
  const [processPhase, setProcessPhase] = useState<ProcessPhase>("analysis");
  const [selectedAsset, setSelectedAsset] = useState<AssetConfig | null>(null);
  const [depositedPool, setDepositedPool] = useState<YieldPool | null>(null);
  const [depositedAmount, setDepositedAmount] = useState<number>(0);

  // USDC balance on Base chain
  const usdcAddress = CHAIN_CONFIG[BALANCE_CHAIN_ID]?.usdc;
  const { data: rawUsdcBalance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: BALANCE_CHAIN_ID,
    query: { enabled: !!address && isConnected },
  });
  const usdcBalance = rawUsdcBalance
    ? parseFloat(formatUnits(rawUsdcBalance as bigint, USDC_DECIMALS))
    : undefined;

  // Pools for the selected asset
  const assetPools = useMemo(() => {
    if (!selectedAsset || !yieldPools) return [];
    return yieldPools.filter((p) =>
      p.symbol.toUpperCase().includes(selectedAsset.symbol),
    );
  }, [selectedAsset, yieldPools]);

  // If there are active positions, default to active view
  const hasPositions =
    positionSummary &&
    positionSummary.positions.length > 0 &&
    parseFloat(positionSummary.total_value_usd) > 0;

  const effectiveView =
    currentView === "deposit" && hasPositions && !selectedAsset
      ? "active"
      : currentView;

  const handleSelectAsset = (asset: AssetConfig) => {
    setSelectedAsset(asset);
  };

  const handleBackToTable = () => {
    setSelectedAsset(null);
  };

  const handleDeposit = (amount: number) => {
    setDepositedAmount(amount);
    setProcessPhase("analysis");
    setCurrentView("processing");
  };

  const handleAnalysisComplete = (
    _quote?: QuoteResponse,
    winnerPool?: YieldPool,
  ) => {
    if (winnerPool) {
      setDepositedPool(winnerPool);
    }
    setProcessPhase("execution");
  };

  const handleProcessComplete = () => {
    setCurrentView("active");
    setSelectedAsset(null);
  };

  const handleWithdraw = () => {
    setDepositedAmount(0);
    setSelectedAsset(null);
    setDepositedPool(null);
    setCurrentView("deposit");
  };

  const handleViewChange = (view: AppView) => {
    setCurrentView(view);
  };

  const handleFetchQuote = useCallback(
    async (pool: YieldPool, amt: number): Promise<QuoteResponse | null> => {
      if (!address) return null;
      const poolUsdcAddress = CHAIN_CONFIG[pool.chain_id]?.usdc;
      if (!poolUsdcAddress) return null;

      try {
        return await quoteMutation.mutateAsync({
          from_chain: pool.chain_id,
          from_token: poolUsdcAddress,
          from_amount: (amt * 1e6).toString(), // USDC has 6 decimals
          to_chain: pool.chain_id,
          to_token: poolUsdcAddress,
          vault_address: "0x0000000000000000000000000000000000000000", // placeholder until vault deployed
        });
      } catch {
        return null;
      }
    },
    [address, quoteMutation],
  );

  return (
    <>
      <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
        {effectiveView === "deposit" && (
          <>
            {!selectedAsset ? (
              <TokenTable
                assets={SUPPORTED_ASSETS}
                pools={yieldPools || []}
                onSelectAsset={handleSelectAsset}
                isConnected={isConnected && isAuthenticated}
                isLoading={poolsLoading}
                error={poolsError?.message}
                usdcBalance={usdcBalance}
              />
            ) : (
              <DepositCard
                onDeposit={handleDeposit}
                isConnected={isConnected && isAuthenticated}
                selectedAsset={selectedAsset}
                assetPools={assetPools}
                onBack={handleBackToTable}
                usdcBalance={usdcBalance}
              />
            )}
          </>
        )}

        {effectiveView === "active" && (
          <ActiveDashboard
            positionSummary={positionSummary ?? null}
            depositedAmount={depositedAmount}
            depositedPool={depositedPool}
            onWithdraw={handleWithdraw}
            onNewDeposit={() => {
              setCurrentView("deposit");
              setSelectedAsset(null);
            }}
          />
        )}
      </div>

      {/* Analysis Overlay */}
      <AnalysisOverlay
        isOpen={currentView === "processing" && processPhase === "analysis"}
        onComplete={handleAnalysisComplete}
        amount={depositedAmount}
        yieldPools={yieldPools || []}
        selectedPool={null}
        onFetchQuote={handleFetchQuote}
      />

      {/* Li.Fi Execution */}
      <LiFiExecution
        isOpen={currentView === "processing" && processPhase === "execution"}
        onComplete={handleProcessComplete}
        amount={depositedAmount}
        targetChain={
          depositedPool
            ? CHAIN_CONFIG[depositedPool.chain_id]?.name || depositedPool.chain
            : "Base"
        }
        targetProtocol={depositedPool?.project || ""}
      />

      {/* View Controller (dev only) */}
      {import.meta.env.DEV && (
        <ViewController
          currentView={currentView}
          onViewChange={handleViewChange}
        />
      )}
    </>
  );
}
