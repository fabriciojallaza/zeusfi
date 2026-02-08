import { useState, useCallback, useMemo, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { TokenTable } from "@/app/components/token-table";
import { DepositCard } from "@/app/components/deposit-card";
import { AnalysisOverlay } from "@/app/components/analysis-overlay";
import { LiFiExecution } from "@/app/components/lifi-execution";
import { ActiveDashboard } from "@/app/components/active-dashboard";
import { ViewController } from "@/app/components/view-controller";
import { WithdrawModal } from "@/app/components/withdraw-modal";
import { useYieldPools } from "@/hooks/useYieldPools";
import { usePositions } from "@/hooks/usePositions";
import { useAuth } from "@/hooks/useAuth";
import { useDepositFlow } from "@/hooks/useDepositFlow";
import { useWithdrawFlow } from "@/hooks/useWithdrawFlow";
import type { YieldPool, QuoteResponse } from "@/types/api";
import type { AssetConfig } from "@/lib/assets";
import { SUPPORTED_ASSETS, BALANCE_CHAIN_ID } from "@/lib/assets";
import { CHAIN_CONFIG } from "@/lib/chains";
import { ERC20_ABI } from "@/lib/contracts";
import { USDC_DECIMALS } from "@/lib/constants";
import api from "@/lib/api";

type AppView = "deposit" | "processing" | "active";
type ProcessPhase = "analysis" | "execution";

const STORAGE_KEY = "zeusfi-deposit-state";

function saveDepositState(state: {
  currentView: AppView;
  processPhase: ProcessPhase;
  depositedAmount: number;
  depositedPool: YieldPool | null;
  selectedAssetSymbol: string | null;
}) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadDepositState(): {
  currentView: AppView;
  processPhase: ProcessPhase;
  depositedAmount: number;
  depositedPool: YieldPool | null;
  selectedAssetSymbol: string | null;
} | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearDepositState() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function DashboardPage() {
  const { isConnected, address } = useAccount();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data: yieldPools, isLoading: poolsLoading, error: poolsError } = useYieldPools();
  const { data: positionSummary } = usePositions(address);
  const { state: depositState, executeDeposit, reset: resetDeposit } = useDepositFlow();
  const { state: withdrawState, preflight: withdrawPreflight, executeWithdraw, unwindAndWithdraw, reset: resetWithdraw } = useWithdrawFlow();
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawVault, setWithdrawVault] = useState<`0x${string}` | null>(null);
  const [withdrawChainId, setWithdrawChainId] = useState<number>(8453);

  // Restore persisted state on mount — but never restore "processing"
  // since the deposit flow resets on refresh and can't resume mid-tx.
  const saved = useMemo(() => {
    const s = loadDepositState();
    if (s?.currentView === "processing") {
      clearDepositState();
      return null;
    }
    return s;
  }, []);

  const [currentView, setCurrentView] = useState<AppView>(
    saved?.currentView ?? "deposit",
  );
  const [processPhase, setProcessPhase] = useState<ProcessPhase>(
    saved?.processPhase ?? "analysis",
  );
  const [selectedAsset, setSelectedAsset] = useState<AssetConfig | null>(() => {
    if (!saved?.selectedAssetSymbol) return null;
    return (
      SUPPORTED_ASSETS.find((a) => a.symbol === saved.selectedAssetSymbol) ??
      null
    );
  });
  const [depositedPool, setDepositedPool] = useState<YieldPool | null>(
    saved?.depositedPool ?? null,
  );
  const [depositedAmount, setDepositedAmount] = useState<number>(
    saved?.depositedAmount ?? 0,
  );

  // Persist deposit state on changes
  useEffect(() => {
    if (currentView === "deposit" && !selectedAsset && depositedAmount === 0) {
      return; // Don't persist the default idle state
    }
    saveDepositState({
      currentView,
      processPhase,
      depositedAmount,
      depositedPool,
      selectedAssetSymbol: selectedAsset?.symbol ?? null,
    });
  }, [currentView, processPhase, depositedAmount, depositedPool, selectedAsset]);

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

  const handleStartDeposit = useCallback(
    (chainId: number, amount: number) => {
      if (!address) return;
      resetDeposit();
      executeDeposit(chainId, amount, address);
    },
    [address, executeDeposit, resetDeposit],
  );

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
    const failed = depositState.step === "error";
    resetDeposit();
    clearDepositState();

    if (failed) {
      // Go back to deposit view so user can retry
      setCurrentView("deposit");
      setSelectedAsset(null);
      return;
    }

    setCurrentView("active");
    setSelectedAsset(null);
    // Refetch positions and wallet data after deposit completes
    queryClient.invalidateQueries({ queryKey: ["positions"] });
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
    // Auto-trigger agent to deploy idle USDC immediately
    api.post("/agent/trigger/").catch(() => {
      // Non-fatal: agent will pick it up on next Celery beat
    });
    queryClient.invalidateQueries({ queryKey: ["agent-status"] });
  };

  const handleWithdraw = () => {
    if (!address) return;
    const primaryPosition = positionSummary?.positions[0];
    const chainId = primaryPosition?.chain_id || depositedPool?.chain_id || 8453;
    setWithdrawChainId(chainId);
    setWithdrawVault(null);
    resetWithdraw();
    setShowWithdrawModal(true);
    // Preflight: resolve vault + read balance, then modal shows confirm button
    withdrawPreflight(chainId, address).then((result) => {
      if (result) {
        setWithdrawVault(result.vault);
      }
    });
  };

  const handleWithdrawConfirm = () => {
    if (!withdrawVault) return;
    if (withdrawState.needsUnwind) {
      unwindAndWithdraw(withdrawChainId, withdrawVault);
    } else {
      executeWithdraw(withdrawChainId, withdrawVault);
    }
  };

  const handleWithdrawComplete = () => {
    setShowWithdrawModal(false);
    resetWithdraw();
    setDepositedAmount(0);
    setSelectedAsset(null);
    setDepositedPool(null);
    setCurrentView("deposit");
    clearDepositState();
    // Refetch positions and wallet data after withdrawal completes
    queryClient.invalidateQueries({ queryKey: ["positions"] });
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
  };

  const handleViewChange = (view: AppView) => {
    setCurrentView(view);
  };

  const handleFetchQuote = useCallback(
    async (_pool: YieldPool, _amt: number): Promise<QuoteResponse | null> => {
      // Quote requires a real vault address. During analysis the vault may not
      // exist yet, so we skip the quote — it's purely cosmetic at this stage.
      // The agent will get a real LI.FI quote when deploying funds.
      return null;
    },
    [],
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
        targetChainId={depositedPool?.chain_id || 8453}
        targetProtocol={depositedPool?.project || ""}
        depositState={depositState}
        onStartDeposit={handleStartDeposit}
      />

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={showWithdrawModal}
        onComplete={handleWithdrawComplete}
        onClose={() => setShowWithdrawModal(false)}
        onConfirm={handleWithdrawConfirm}
        withdrawState={withdrawState}
        chainId={withdrawChainId}
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
