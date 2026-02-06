import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Shield,
  Search,
  Link as LinkIcon,
  Settings,
  Wallet,
  Circle,
  ExternalLink,
} from "lucide-react";
import type { Token } from "@/app/components/token-table";

interface LiFiExecutionProps {
  isOpen: boolean;
  onComplete: () => void;
  amount: number;
  token: Token;
  targetChain?: string;
  targetProtocol?: string;
}

type StepStatus = "pending" | "active" | "completed";

interface ExecutionStep {
  id: string;
  icon: React.ReactNode;
  text: string;
  subtext?: string;
  status: StepStatus;
  txHash?: string;
}

export function LiFiExecution({
  isOpen,
  onComplete,
  amount,
  token,
  targetChain = "Base",
  targetProtocol = "Uniswap v4",
}: LiFiExecutionProps) {
  const [steps, setSteps] = useState<ExecutionStep[]>([
    {
      id: "ens",
      icon: <Shield className="h-4 w-4" />,
      text: "Reading ENS preferences for adolfo.eth...",
      status: "pending",
    },
    {
      id: "scan",
      icon: <Search className="h-4 w-4" />,
      text: "Scanning 12 chains & 50+ pools...",
      subtext: "Selected: Uniswap v4 (Base) with Hooks",
      status: "pending",
    },
    {
      id: "bridge",
      icon: <LinkIcon className="h-4 w-4" />,
      text: "Bridging assets to Base Network via Li.Fi...",
      txHash: "0x8a...2b",
      status: "pending",
    },
    {
      id: "hook",
      icon: <Settings className="h-4 w-4" />,
      text: "Interacting with Auto-Compound Hook...",
      txHash: "0x3f...9c",
      status: "pending",
    },
    {
      id: "complete",
      icon: <Wallet className="h-4 w-4" />,
      text: "Done. Yield Active.",
      status: "pending",
    },
  ]);

  const [allCompleted, setAllCompleted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSteps([
        {
          id: "ens",
          icon: <Shield className="h-4 w-4" />,
          text: "Reading ENS preferences for adolfo.eth...",
          status: "pending",
        },
        {
          id: "scan",
          icon: <Search className="h-4 w-4" />,
          text: "Scanning 12 chains & 50+ pools...",
          subtext: "Selected: Uniswap v4 (Base) with Hooks",
          status: "pending",
        },
        {
          id: "bridge",
          icon: <LinkIcon className="h-4 w-4" />,
          text: "Bridging assets to Base Network via Li.Fi...",
          txHash: "0x8a...2b",
          status: "pending",
        },
        {
          id: "hook",
          icon: <Settings className="h-4 w-4" />,
          text: "Interacting with Auto-Compound Hook...",
          txHash: "0x3f...9c",
          status: "pending",
        },
        {
          id: "complete",
          icon: <Wallet className="h-4 w-4" />,
          text: "Done. Yield Active.",
          status: "pending",
        },
      ]);
      setAllCompleted(false);
      return;
    }

    // Execute steps sequentially
    const stepTimings = [1000, 1500, 2500, 2000, 1500]; // Duration for each step
    let cumulativeTime = 0;
    const timers: NodeJS.Timeout[] = [];

    steps.forEach((step, index) => {
      // Set to active
      const activeTimer = setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, i) => {
            if (i === index) return { ...s, status: "active" as StepStatus };
            return s;
          }),
        );
      }, cumulativeTime);
      timers.push(activeTimer);

      // Set to completed
      const completeTimer = setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, i) => {
            if (i === index) return { ...s, status: "completed" as StepStatus };
            return s;
          }),
        );

        // If this is the last step, mark all as completed
        if (index === steps.length - 1) {
          setTimeout(() => {
            setAllCompleted(true);
            setTimeout(() => onComplete(), 2000);
          }, 500);
        }
      }, cumulativeTime + stepTimings[index]);
      timers.push(completeTimer);

      cumulativeTime += stepTimings[index];
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl rounded-2xl bg-[#0a0e1a] border-2 border-[#1e2433] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="relative border-b-2 border-[#1e2433] bg-gradient-to-r from-[#0a0e1a] via-[#141823] to-[#0a0e1a] p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] border-2 border-[#3b82f6]">
                      <span className="text-2xl">⚡</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {allCompleted
                          ? "Execution Complete"
                          : "Live Execution Log"}
                      </h2>
                      <p className="text-sm font-mono text-[#8b92a8]">
                        {allCompleted
                          ? "Transaction confirmed on-chain"
                          : "Agent executing cross-chain deployment..."}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-[#8b92a8]">Amount</p>
                    <p className="font-mono text-xl font-bold text-white">
                      {amount.toLocaleString()} {token.symbol}
                    </p>
                  </div>
                </div>
              </div>

              {/* Execution Timeline */}
              <div className="p-8">
                <div className="rounded-xl bg-[#141823] border-2 border-[#1e2433] p-6">
                  {/* Timeline Steps */}
                  <div className="space-y-1 relative">
                    {steps.map((step, index) => {
                      const isLast = index === steps.length - 1;
                      const isActive = step.status === "active";
                      const isCompleted = step.status === "completed";
                      const isPending = step.status === "pending";

                      return (
                        <div key={step.id} className="relative">
                          {/* Vertical Line Connector */}
                          {!isLast && (
                            <div
                              className={`absolute left-[11px] top-8 w-0.5 h-12 transition-all duration-500 ${
                                isCompleted ||
                                index <
                                  steps.findIndex((s) => s.status === "active")
                                  ? "bg-[#10b981]"
                                  : "bg-[#1e2433]"
                              }`}
                            />
                          )}

                          {/* Step Row */}
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start gap-3 py-3"
                          >
                            {/* Icon/Status Indicator */}
                            <div className="flex-shrink-0 relative z-10">
                              {isCompleted ? (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10b981]">
                                  <CheckCircle2 className="h-4 w-4 text-white" />
                                </div>
                              ) : isActive ? (
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    ease: "linear",
                                  }}
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3b82f6]"
                                >
                                  <Loader2 className="h-4 w-4 text-white" />
                                </motion.div>
                              ) : (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1e2433] border border-[#2a3244]">
                                  <Circle className="h-3 w-3 text-[#8b92a8]" />
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 pt-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <p
                                  className={`font-mono text-sm transition-all duration-300 ${
                                    isCompleted
                                      ? "text-[#8b92a8]"
                                      : isActive
                                        ? "text-white font-bold"
                                        : "text-[#8b92a8]/40"
                                  }`}
                                >
                                  {step.text}
                                </p>
                                {step.txHash && isActive && (
                                  <span className="text-xs font-mono text-[#3b82f6]">
                                    {step.txHash}
                                  </span>
                                )}
                                {step.txHash && isCompleted && (
                                  <span className="text-xs font-mono text-[#10b981]">
                                    {step.txHash}
                                  </span>
                                )}
                              </div>

                              {/* Subtext */}
                              {step.subtext && isCompleted && (
                                <motion.p
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  className="mt-1 pl-4 text-xs font-mono text-[#10b981] border-l-2 border-[#10b981]"
                                >
                                  → {step.subtext}
                                </motion.p>
                              )}

                              {/* Active Step Progress Indicator */}
                              {isActive && (
                                <motion.div
                                  initial={{ width: "0%" }}
                                  animate={{ width: "100%" }}
                                  transition={{ duration: 2 }}
                                  className="mt-2 h-0.5 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] rounded-full"
                                />
                              )}
                            </div>
                          </motion.div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Li.Fi & Final Actions */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className={`mt-6 rounded-xl border-2 p-4 transition-all duration-500 ${
                    allCompleted
                      ? "bg-gradient-to-r from-[#10b981]/10 to-[#3b82f6]/10 border-[#10b981]"
                      : "bg-[#141823] border-[#1e2433]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          allCompleted
                            ? "bg-[#10b981]"
                            : "bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6]"
                        }`}
                      >
                        {allCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-white" />
                        ) : (
                          <ArrowRight className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">
                          {allCompleted
                            ? "Transaction Confirmed"
                            : "Li.Fi Cross-Chain Infrastructure"}
                        </p>
                        <p className="text-xs font-mono text-[#8b92a8]">
                          {allCompleted
                            ? "Your funds are now earning yield on Base"
                            : "Aggregating 20+ bridges • Best execution guaranteed"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-[#8b92a8]">
                        {allCompleted ? "Final APY" : "Destination"}
                      </p>
                      <p
                        className={`font-mono font-bold ${
                          allCompleted
                            ? "text-[#10b981] text-lg"
                            : "text-[#3b82f6]"
                        }`}
                      >
                        {allCompleted ? "18.7%" : targetChain}
                      </p>
                    </div>
                  </div>

                  {/* Explorer Link (Only when complete) */}
                  {allCompleted && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-4 pt-4 border-t border-[#10b981]/30"
                    >
                      <button className="flex items-center gap-2 text-sm font-mono text-[#10b981] hover:text-[#059669] transition-colors group">
                        <span>View Transaction on Block Explorer</span>
                        <ExternalLink className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
