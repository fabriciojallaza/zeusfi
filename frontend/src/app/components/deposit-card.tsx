import { useState } from "react";
import {
  TrendingUp,
  DollarSign,
  ArrowLeft,
  Sparkles,
  Radar,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { motion } from "motion/react";
import type { Token } from "@/app/components/token-table";

interface DepositCardProps {
  onDeposit: (amount: number, token: Token) => void;
  maxBalance?: number;
  isConnected: boolean;
  selectedToken: Token;
  onBack: () => void;
}

export function DepositCard({
  onDeposit,
  maxBalance,
  isConnected,
  selectedToken,
  onBack,
}: DepositCardProps) {
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and decimals
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError("");

      // Validate against max balance
      if (maxBalance !== undefined && parseFloat(value) > maxBalance) {
        setError("Insufficient balance");
      }
    }
  };

  const handleMaxClick = () => {
    if (maxBalance !== undefined) {
      setAmount(maxBalance.toString());
      setError("");
    }
  };

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);

    if (!amount || numAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (maxBalance !== undefined && numAmount > maxBalance) {
      setError("Insufficient balance");
      return;
    }

    onDeposit(numAmount, selectedToken);
  };

  return (
    <div className="w-full max-w-2xl">
      {/* Main Card */}
      <div className="rounded-2xl bg-[#0a0e1a] border-2 border-[#1e2433] shadow-2xl overflow-hidden">
        {/* Header with AI Badge */}
        <div className="relative bg-gradient-to-r from-[#0a0e1a] via-[#141823] to-[#0a0e1a] border-b border-[#1e2433] p-6">
          <button
            onClick={onBack}
            className="mb-4 flex items-center gap-2 text-sm text-[#8b92a8] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to assets
          </button>

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
              <h1 className="text-2xl font-bold text-white">AI Yield Agent</h1>
              <p className="text-sm text-[#8b92a8] font-mono">
                Command Center • Real-time Cross-Chain Analysis
              </p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Selected Asset */}
          <div className="mb-6 rounded-xl bg-[#141823] border border-[#1e2433] p-4">
            <p className="mb-2 text-xs font-mono text-[#8b92a8] uppercase tracking-wider">
              Selected Asset
            </p>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${selectedToken.color}20` }}
              >
                <span
                  className="text-lg font-bold"
                  style={{ color: selectedToken.color }}
                >
                  {selectedToken.icon}
                </span>
              </div>
              <div>
                <p className="font-semibold text-white">
                  {selectedToken.symbol}
                </p>
                <p className="text-xs text-[#8b92a8]">{selectedToken.name}</p>
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div className="mb-6">
            <label className="mb-3 block text-xs font-mono font-semibold text-[#8b92a8] uppercase tracking-wider">
              Amount to Deploy
            </label>
            <div className="relative">
              <Input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                disabled={!isConnected}
                className="h-16 pl-6 pr-24 text-right font-mono text-3xl font-bold bg-[#141823] border-2 border-[#1e2433] text-white placeholder:text-[#8b92a8] focus:border-[#3b82f6] focus:ring-4 focus:ring-[#3b82f6]/20 transition-all"
              />

              {maxBalance !== undefined && (
                <button
                  onClick={handleMaxClick}
                  disabled={!isConnected}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg bg-[#1e2433] hover:bg-[#3b82f6] px-4 py-2 text-sm font-mono font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  MAX
                </button>
              )}
            </div>

            {error && (
              <p className="mt-2 text-sm font-mono text-[#ef4444]">{error}</p>
            )}

            {maxBalance !== undefined && !error && (
              <p className="mt-2 text-sm font-mono text-[#8b92a8]">
                Available:{" "}
                <span className="text-white font-bold">
                  {maxBalance.toLocaleString()}
                </span>{" "}
                {selectedToken.symbol}
              </p>
            )}
          </div>

          {/* AI Agent CTA */}
          <Button
            onClick={handleSubmit}
            disabled={!isConnected || !amount || !!error}
            className="group relative w-full h-16 text-lg font-bold bg-gradient-to-r from-[#10b981] via-[#3b82f6] to-[#8b5cf6] hover:from-[#059669] hover:via-[#2563eb] hover:to-[#7c3aed] text-white rounded-xl transition-all duration-300 shadow-lg shadow-[#3b82f6]/30 hover:shadow-[#3b82f6]/50 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 overflow-hidden"
          >
            <motion.div
              animate={{
                opacity: [0.5, 1, 0.5],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            />
            <span className="relative flex items-center justify-center gap-3">
              <Radar className="h-5 w-5" />
              Agent: Scan & Optimize
              <Sparkles className="h-5 w-5" />
            </span>
          </Button>

          {!isConnected && (
            <p className="mt-3 text-center text-sm text-[#8b92a8] font-mono">
              Connect wallet to activate AI Agent
            </p>
          )}
        </div>

        {/* Tech Specs Footer */}
        <div className="border-t border-[#1e2433] bg-[#141823] p-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="mb-1 text-xs font-mono text-[#8b92a8] uppercase">
                Networks
              </p>
              <p className="font-mono text-sm font-bold text-white">3 Chains</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-mono text-[#8b92a8] uppercase">
                Protocols
              </p>
              <p className="font-mono text-sm font-bold text-white">
                12+ Pools
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-mono text-[#8b92a8] uppercase">
                Powered By
              </p>
              <p className="font-mono text-sm font-bold text-[#3b82f6]">
                Li.Fi
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Indicators */}
      <div className="mt-6 flex items-center justify-center gap-8 text-sm font-mono text-[#8b92a8]">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse"></div>
          <span>Real-time Analysis</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse"></div>
          <span>Non-Custodial</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse"></div>
          <span>Audited</span>
        </div>
      </div>
    </div>
  );
}
