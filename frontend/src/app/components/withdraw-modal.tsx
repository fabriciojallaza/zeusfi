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
  Wallet,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { getExplorerTxUrl, CHAIN_CONFIG } from "@/lib/chains";
import { PROTOCOL_DISPLAY } from "@/lib/constants";
import type { WithdrawState, WithdrawStep } from "@/hooks/useWithdrawFlow";

type ModalPhase = "loading" | "confirm" | "executing";

interface WithdrawModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onClose: () => void;
  onConfirm: () => void;
  withdrawState: WithdrawState;
  chainId: number;
}

type StepStatus = "pending" | "active" | "completed" | "error";

// Step indices for direct withdraw (USDC already in vault)
const DIRECT_STEP_MAP: Record<WithdrawStep, number> = {
  idle: -1,
  resolving_vault: -1,
  reading_balance: -1,
  switching_chain: 0,
  unwinding: -1,
  polling_balance: -1,
  withdrawing: 1,
  confirming: 1,
  complete: 2,
  error: -1,
};

// Step indices for unwind + withdraw flow
const UNWIND_STEP_MAP: Record<WithdrawStep, number> = {
  idle: -1,
  resolving_vault: -1,
  reading_balance: -1,
  unwinding: 0,
  polling_balance: 1,
  switching_chain: 2,
  withdrawing: 3,
  confirming: 3,
  complete: 4,
  error: -1,
};

function getPhase(withdrawState: WithdrawState): ModalPhase {
  if (withdrawState.step === "resolving_vault" || withdrawState.step === "reading_balance") {
    return "loading";
  }
  if (withdrawState.step === "idle" && withdrawState.vaultBalance !== undefined) {
    return "confirm";
  }
  if (withdrawState.step === "idle") {
    return "loading";
  }
  return "executing";
}

function buildSteps(withdrawState: WithdrawState) {
  const isUnwind = withdrawState.needsUnwind;
  const stepMap = isUnwind ? UNWIND_STEP_MAP : DIRECT_STEP_MAP;
  const currentStepIndex = stepMap[withdrawState.step];
  const isComplete = withdrawState.step === "complete";
  const isError = withdrawState.step === "error";
  const errorStepIndex = isError && withdrawState.errorAtStep
    ? stepMap[withdrawState.errorAtStep]
    : -1;

  const getStatus = (index: number): StepStatus => {
    if (isError && index === errorStepIndex) return "error";
    if (isError && index < errorStepIndex) return "completed";
    if (isComplete || index < currentStepIndex) return "completed";
    if (index === currentStepIndex) return "active";
    return "pending";
  };

  if (isUnwind) {
    return [
      {
        id: "unwind",
        text: "Unwinding from protocol (agent pays gas)...",
        status: getStatus(0),
        txHash: undefined,
      },
      {
        id: "poll",
        text: "Waiting for USDC to return to vault...",
        status: getStatus(1),
        txHash: undefined,
      },
      {
        id: "switch_chain",
        text: "Switching chain...",
        status: getStatus(2),
        txHash: undefined,
      },
      {
        id: "withdraw",
        text:
          withdrawState.step === "confirming"
            ? "Confirming withdrawal..."
            : "Withdrawing USDC to your wallet...",
        status: getStatus(3),
        txHash: withdrawState.txHash,
      },
    ];
  }

  return [
    {
      id: "switch_chain",
      text: "Switching chain...",
      status: getStatus(0),
      txHash: undefined,
    },
    {
      id: "withdraw",
      text:
        withdrawState.step === "confirming"
          ? "Confirming withdrawal..."
          : "Withdrawing USDC from vault...",
      status: getStatus(1),
      txHash: withdrawState.txHash,
    },
  ];
}

export function WithdrawModal({
  isOpen,
  onComplete,
  onClose,
  onConfirm,
  withdrawState,
  chainId,
}: WithdrawModalProps) {
  const phase = getPhase(withdrawState);
  const steps = buildSteps(withdrawState);
  const allCompleted = withdrawState.step === "complete";
  const hasError = withdrawState.step === "error";

  useEffect(() => {
    if (allCompleted) {
      const timer = setTimeout(() => onComplete(), 3000);
      return () => clearTimeout(timer);
    }
  }, [allCompleted, onComplete]);

  const canClose = hasError || allCompleted || phase === "confirm";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={canClose ? onClose : undefined}
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
                      ) : phase === "loading" ? (
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
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
                            : phase === "loading"
                              ? "Loading Vault..."
                              : phase === "confirm"
                                ? "Withdraw Funds"
                                : "Withdrawing..."}
                      </h2>
                      <p className="text-sm font-mono text-[#8b92a8]">
                        {allCompleted
                          ? "USDC returned to your wallet"
                          : hasError
                            ? withdrawState.error
                            : phase === "loading"
                              ? "Reading vault balance..."
                              : phase === "confirm"
                                ? "Confirm withdrawal to your wallet"
                                : "Processing withdrawal..."}
                      </p>
                    </div>
                  </div>
                  {canClose && (
                    <button
                      onClick={onClose}
                      className="text-[#8b92a8] hover:text-white transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-6">
                {/* Loading phase */}
                {phase === "loading" && (
                  <div className="flex flex-col items-center justify-center py-8 gap-4">
                    <Loader2 className="h-8 w-8 text-[#3b82f6] animate-spin" />
                    <p className="text-sm font-mono text-[#8b92a8]">
                      {withdrawState.step === "resolving_vault"
                        ? "Finding your vault..."
                        : "Reading vault balance..."}
                    </p>
                  </div>
                )}

                {/* Confirm phase — show balance and confirm button */}
                {phase === "confirm" && (() => {
                  const displayValue = withdrawState.needsUnwind
                    ? (withdrawState.protocolValue ?? 0) + (withdrawState.vaultBalance ?? 0)
                    : (withdrawState.vaultBalance ?? 0);
                  const positions = withdrawState.protocolPositions ?? [];

                  return (
                    <div className="space-y-6">
                      <div className="rounded-xl bg-[#141823] border-2 border-[#1e2433] p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <Wallet className="h-5 w-5 text-[#8b92a8]" />
                          <p className="text-sm font-mono text-[#8b92a8] uppercase tracking-wider">
                            {withdrawState.needsUnwind ? "Deployed in Protocol" : "Vault USDC Balance"}
                          </p>
                        </div>
                        <p className="font-mono text-3xl font-bold text-white">
                          {displayValue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          <span className="text-lg text-[#8b92a8]">USDC</span>
                        </p>
                        {withdrawState.needsUnwind && positions.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            {positions.map((pos) => (
                              <div
                                key={`${pos.chain_id}-${pos.protocol}-${pos.token}`}
                                className="flex items-center justify-between text-xs font-mono"
                              >
                                <span className="text-[#8b92a8]">
                                  {PROTOCOL_DISPLAY[pos.protocol] || pos.protocol}{" "}
                                  <span className="text-[#8b92a8]/50">
                                    on {CHAIN_CONFIG[pos.chain_id]?.name || pos.chain_name}
                                  </span>
                                </span>
                                <span className="text-white">
                                  ${parseFloat(pos.amount_usd).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {displayValue < 0.01 && (
                          <p className="mt-2 text-xs text-amber-400 font-mono">
                            No funds found in vault or protocols.
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl bg-amber-400/10 border border-amber-400/30 p-3">
                        <p className="text-xs text-amber-400 font-mono">
                          {withdrawState.needsUnwind
                            ? "Agent will unwind protocol positions back to USDC (agent pays gas), then you withdraw to your wallet (you pay gas). A 10% fee applies on profit only."
                            : "This will withdraw your full vault balance. A 10% fee applies on profit only."}
                        </p>
                      </div>

                      <Button
                        onClick={onConfirm}
                        disabled={displayValue < 0.01}
                        className="w-full h-12 font-mono font-bold bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#dc2626] hover:to-[#b91c1c] text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ArrowDownToLine className="mr-2 h-4 w-4" />
                        {withdrawState.needsUnwind
                          ? `Unwind & Withdraw ~${displayValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
                          : `Withdraw ${withdrawState.vaultBalance ? `${withdrawState.vaultBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC` : ""}`}
                      </Button>
                    </div>
                  );
                })()}

                {/* Executing phase — show steps */}
                {phase === "executing" && (
                  <>
                    <div className="rounded-xl bg-[#141823] border-2 border-[#1e2433] p-5">
                      <div className="space-y-1 relative">
                        {steps.map((step, index) => {
                          const isActive = step.status === "active";
                          const isCompleted = step.status === "completed";
                          const isStepError = step.status === "error";

                          return (
                            <div key={step.id} className="relative">
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

                                  {isStepError && withdrawState.error && (
                                    <p className="mt-1 text-xs font-mono text-[#ef4444] border-l-2 border-[#ef4444] pl-3">
                                      {withdrawState.error}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Success */}
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

                    {/* Error */}
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
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
