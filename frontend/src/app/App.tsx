import { useState } from "react";
import { Header } from "@/app/components/header";
import { TokenTable, type Token } from "@/app/components/token-table";
import { DepositCard } from "@/app/components/deposit-card";
import { AnalysisOverlay } from "@/app/components/analysis-overlay";
import { LiFiExecution } from "@/app/components/lifi-execution";
import { ActiveDashboard } from "@/app/components/active-dashboard";
import { ViewController } from "@/app/components/view-controller";
import { AICoPilot } from "@/app/components/ai-copilot";

type AppView = "deposit" | "processing" | "active";
type ProcessPhase = "analysis" | "execution";

// Mock token data
const availableTokens: Token[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    balance: 500,
    apy: 12.5,
    icon: "$",
    color: "#3b82f6",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    balance: 1250,
    apy: 11.8,
    icon: "₮",
    color: "#22c55e",
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    balance: 750,
    apy: 13.2,
    icon: "◈",
    color: "#f59e0b",
  },
  {
    symbol: "WETH",
    name: "Wrapped Ethereum",
    balance: 2.5,
    apy: 8.5,
    icon: "Ξ",
    color: "#8b5cf6",
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    balance: 0.15,
    apy: 6.2,
    icon: "₿",
    color: "#f97316",
  },
];

function App() {
  const [currentView, setCurrentView] = useState<AppView>("deposit");
  const [processPhase, setProcessPhase] = useState<ProcessPhase>("analysis");
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>();
  const [depositedAmount, setDepositedAmount] = useState<number>(0);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [depositedToken, setDepositedToken] = useState<Token | null>(null);
  const [tokens, setTokens] = useState<Token[]>(availableTokens);

  // Calculate total USDC balance for header (simplified for demo)
  const totalUSDCBalance =
    tokens.find((t) => t.symbol === "USDC")?.balance || 0;

  const handleConnectWallet = () => {
    // Mock wallet connection
    setIsConnected(true);
    setWalletAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb");
  };

  const handleSelectToken = (token: Token) => {
    setSelectedToken(token);
  };

  const handleBackToTable = () => {
    setSelectedToken(null);
  };

  const handleDeposit = (amount: number, token: Token) => {
    setDepositedAmount(amount);
    setDepositedToken(token);
    setProcessPhase("analysis");
    setCurrentView("processing");
  };

  const handleAnalysisComplete = () => {
    // Move from analysis to Li.Fi execution
    setProcessPhase("execution");
  };

  const handleProcessComplete = () => {
    setCurrentView("active");
    // Update token balance
    if (depositedToken) {
      setTokens((prevTokens) =>
        prevTokens.map((t) =>
          t.symbol === depositedToken.symbol
            ? { ...t, balance: t.balance - depositedAmount }
            : t,
        ),
      );
    }
  };

  const handleWithdraw = () => {
    // Return to deposit view and restore balance
    if (depositedToken) {
      setTokens((prevTokens) =>
        prevTokens.map((t) =>
          t.symbol === depositedToken.symbol
            ? { ...t, balance: t.balance + depositedAmount }
            : t,
        ),
      );
    }
    setDepositedAmount(0);
    setSelectedToken(null);
    setDepositedToken(null);
    setCurrentView("deposit");
  };

  const handleViewChange = (view: AppView) => {
    // Ensure we have some deposited amount for the active and processing views
    if ((view === "active" || view === "processing") && depositedAmount === 0) {
      setDepositedAmount(100); // Set a default amount for demo purposes
      if (!depositedToken) {
        setDepositedToken(tokens[0]); // Use first token as default
      }
    }
    setCurrentView(view);
  };

  return (
    <div className="dark min-h-screen bg-[#0a0e1a]">
      <Header
        isConnected={isConnected}
        walletAddress={walletAddress}
        usdcBalance={isConnected ? totalUSDCBalance : undefined}
        currentNetwork={isConnected ? "Arbitrum" : undefined}
        onConnect={handleConnectWallet}
      />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
          {currentView === "deposit" && (
            <>
              {!selectedToken ? (
                <TokenTable
                  tokens={tokens}
                  onSelectToken={handleSelectToken}
                  isConnected={isConnected}
                />
              ) : (
                <DepositCard
                  onDeposit={handleDeposit}
                  maxBalance={selectedToken.balance}
                  isConnected={isConnected}
                  selectedToken={selectedToken}
                  onBack={handleBackToTable}
                />
              )}
            </>
          )}

          {currentView === "active" && depositedToken && (
            <ActiveDashboard
              depositedAmount={depositedAmount}
              currentAPY={18.7}
              onWithdraw={handleWithdraw}
              depositedToken={depositedToken}
            />
          )}
        </div>
      </main>

      {/* Analysis Overlay */}
      {depositedToken && (
        <AnalysisOverlay
          isOpen={currentView === "processing" && processPhase === "analysis"}
          onComplete={handleAnalysisComplete}
          amount={depositedAmount}
          token={depositedToken}
        />
      )}

      {/* Li.Fi Execution */}
      {depositedToken && (
        <LiFiExecution
          isOpen={currentView === "processing" && processPhase === "execution"}
          onComplete={handleProcessComplete}
          amount={depositedAmount}
          token={depositedToken}
        />
      )}

      {/* View Controller */}
      <ViewController
        currentView={currentView}
        onViewChange={handleViewChange}
      />

      {/* AI Co-Pilot */}
      <AICoPilot />
    </div>
  );
}

export default App;
