import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowDownToLine,
  CheckCircle2,
  Loader2,
  Circle,
  ExternalLink,
  AlertCircle,
  X,
} from "lucide-react";
import { getExplorerTxUrl } from "@/lib/chains";
import type { WithdrawState, WithdrawStep } from "@/hooks/useWithdrawFlow";

interface WithdrawModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onClose: () => void;
  withdrawState: WithdrawState;
  chainId: number;
}

type StepStatus = "pending" | "active" | "completed" | "error";

const STEP_MAP: Record<WithdrawStep, number> = {
  idle: -1,
  checking_balance: 0,
  requesting_unwind: 1,
  waiting_unwind: 1,
  withdrawing: 2,
  confirming: 2,
  complete: 3,
  error: -1,
};

function buildSteps(withdrawState: WithdrawState) {
  const currentStepIndex = STEP_MAP[withdrawState.step];
  const isComplete = withdrawState.step === "complete";
  const isError = withdrawState.step === "error";

  const getStatus = (index: number): StepStatus => {
    if (isError && index === currentStepIndex) return "error";
    if (isComplete || index < currentStepIndex) return "completed";
    if (index === currentStepIndex) return "active";
    return "pending";
  };

  return [
    {
      id: "check",
      text: "Checking vault balance...",
      status: getStatus(0),
    },
    {
      id: "unwind",
      text:
        withdrawState.step === "waiting_unwind"
          ? "Agent unwinding position..."
          : "Requesting agent unwind...",
      status: getStatus(1),
    },
    {
      id: "withdraw",
      text:
        withdrawState.step === "confirming"
          ? "Confirming withdrawal..."
          : "Withdrawing USDC...",
      status: getStatus(2),
      txHash: withdrawState.txHash,
    },
  ];
}

export function WithdrawModal({
  isOpen,
  onComplete,
  onClose,
  withdrawState,
  chainId,
}: WithdrawModalProps) {
  const steps = buildSteps(withdrawState);
  const allCompleted = withdrawState.step === "complete";
  const hasError = withdrawState.step === "error";

  useEffect(() => {
    if (allCompleted) {
      const timer = setTimeout(() => onComplete(), 3000);
      return () => clearTimeout(timer);
    }
  }, [allCompleted, onComplete]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={hasError || allCompleted ? onClose : undefined}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg rounded-2xl bg-[#0a0e1a] border-2 border-[#1e2433] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="relative border-b-2 border-[#1e2433] bg-gradient-to-r from-[#0a0e1a] via-[#141823] to-[#0a0e1a] p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-lg border-2 ${
                        allCompleted
                          ? "bg-[#10b981] border-[#10b981]"
                          : hasError
                            ? "bg-[#ef4444] border-[#ef4444]"
                            : "bg-gradient-to-br from-[#ef4444] to-[#dc2626] border-[#ef4444]"
                      }`}
                    >
                      {allCompleted ? (
                        <CheckCircle2 className="h-6 w-6 text-white" />
                      ) : hasError ? (
                        <AlertCircle className="h-6 w-6 text-white" />
                      ) : (
                        <ArrowDownToLine className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {allCompleted
                          ? "Withdrawal Complete"
                          : hasError
                            ? "Withdrawal Failed"
                            : "Withdrawing Funds..."}
                      </h2>
                      <p className="text-sm font-mono text-[#8b92a8]">
                        {allCompleted
                          ? "USDC returned to your wallet"
                          : hasError
                            ? withdrawState.error
                            : "Processing withdrawal from vault..."}
                      </p>
                    </div>
                  </div>
                  {(hasError || allCompleted) && (
                    <button
                      onClick={onClose}
                      className="text-[#8b92a8] hover:text-white transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Steps */}
              <div className="p-6">
                <div className="rounded-xl bg-[#141823] border-2 border-[#1e2433] p-5">
                  <div className="space-y-1 relative">
                    {steps.map((step, index) => {
                      const isLast = index === steps.length - 1;
                      const isActive = step.status === "active";
                      const isCompleted = step.status === "completed";
                      const isStepError = step.status === "error";

                      return (
                        <div key={step.id} className="relative">
                          {!isLast && (
                            <div
                              className={`absolute left-[11px] top-8 w-0.5 h-10 transition-all duration-500 ${
                                isCompleted
                                  ? "bg-[#10b981]"
                                  : isStepError
                                    ? "bg-[#ef4444]"
                                    : "bg-[#1e2433]"
                              }`}
                            />
                          )}

                          <div className="flex items-start gap-3 py-2.5">
                            <div className="flex-shrink-0 relative z-10">
                              {isCompleted ? (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10b981]">
                                  <CheckCircle2 className="h-4 w-4 text-white" />
                                </div>
                              ) : isStepError ? (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ef4444]">
                                  <AlertCircle className="h-4 w-4 text-white" />
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

                            <div className="flex-1 pt-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <p
                                  className={`font-mono text-sm transition-all duration-300 ${
                                    isCompleted
                                      ? "text-[#8b92a8]"
                                      : isStepError
                                        ? "text-[#ef4444] font-bold"
                                        : isActive
                                          ? "text-white font-bold"
                                          : "text-[#8b92a8]/40"
                                  }`}
                                >
                                  {step.text}
                                </p>
                                {step.txHash && (isActive || isCompleted) && (
                                  <a
                                    href={getExplorerTxUrl(chainId, step.txHash)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`text-xs font-mono flex items-center gap-1 ${isCompleted ? "text-[#10b981]" : "text-[#3b82f6]"} hover:underline`}
                                  >
                                    {step.txHash.slice(0, 8)}...
                                    {step.txHash.slice(-6)}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>

                              {isActive && (
                                <motion.div
                                  initial={{ width: "0%" }}
                                  animate={{ width: "100%" }}
                                  transition={{ duration: 2 }}
                                  className="mt-2 h-0.5 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] rounded-full"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Final status */}
                {allCompleted && withdrawState.txHash && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rounded-xl bg-[#10b981]/10 border-2 border-[#10b981] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-[#10b981]">
                        USDC returned to your wallet (10% fee on profit)
                      </p>
                      <a
                        href={getExplorerTxUrl(chainId, withdrawState.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-mono text-[#10b981] hover:underline"
                      >
                        View tx
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </motion.div>
                )}

                {hasError && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rounded-xl bg-[#ef4444]/10 border-2 border-[#ef4444] p-4"
                  >
                    <p className="text-sm text-[#ef4444]">
                      {withdrawState.error || "An error occurred. Please try again."}
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
