import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Shield,
  Search,
  Link as LinkIcon,
  Wallet,
  Circle,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { VAULT_FACTORIES } from "@/lib/constants";
import { getExplorerTxUrl } from "@/lib/chains";
import type { DepositState, DepositStep } from "@/hooks/useDepositFlow";

interface LiFiExecutionProps {
  isOpen: boolean;
  onComplete: () => void;
  amount: number;
  targetChain?: string;
  targetChainId?: number;
  targetProtocol?: string;
  depositState?: DepositState;
  onStartDeposit?: (chainId: number, amount: number) => void;
}

type StepStatus = "pending" | "active" | "completed" | "error";

interface ExecutionStep {
  id: string;
  text: string;
  subtext?: string;
  status: StepStatus;
  txHash?: string;
}

const STEP_MAP: Record<DepositStep, number> = {
  idle: -1,
  checking_vault: 0,
  deploying_vault: 1,
  registering_vault: 1,
  switching_chain: 2,
  approving_usdc: 3,
  depositing: 4,
  confirming: 4,
  complete: 5,
  error: -1,
};

function buildSteps(
  targetChain: string,
  targetProtocol: string,
  depositState?: DepositState,
): ExecutionStep[] {
  const currentStepIndex = depositState ? STEP_MAP[depositState.step] : -1;
  const isComplete = depositState?.step === "complete";
  const isError = depositState?.step === "error";
  // Use errorAtStep to highlight the correct step on failure
  const errorStepIndex = isError && depositState?.errorAtStep
    ? STEP_MAP[depositState.errorAtStep]
    : -1;

  const getStatus = (index: number): StepStatus => {
    if (isError && index === errorStepIndex) return "error";
    if (isError && index < errorStepIndex) return "completed";
    if (isComplete || index < currentStepIndex) return "completed";
    if (index === currentStepIndex) return "active";
    return "pending";
  };

  return [
    {
      id: "check_vault",
      text: "Checking vault status...",
      subtext: depositState?.vaultAddress
        ? `Vault: ${depositState.vaultAddress.slice(0, 8)}...${depositState.vaultAddress.slice(-6)}`
        : undefined,
      status: getStatus(0),
    },
    {
      id: "deploy_vault",
      text: "Deploying vault contract...",
      subtext: depositState?.step === "registering_vault" ? "Registering with backend..." : undefined,
      status: getStatus(1),
      txHash: getStatus(1) !== "pending" ? depositState?.txHash : undefined,
    },
    {
      id: "switch_chain",
      text: `Switching to ${targetChain}...`,
      status: getStatus(2),
    },
    {
      id: "approve",
      text: "Approving USDC transfer...",
      status: getStatus(3),
    },
    {
      id: "deposit",
      text: `Depositing into vault...`,
      subtext: isComplete
        ? `USDC deposited. Agent will deploy to ${targetProtocol} on ${targetChain}.`
        : undefined,
      status: getStatus(4),
      txHash: depositState?.step === "confirming" || isComplete ? depositState?.txHash : undefined,
    },
  ];
}

export function LiFiExecution({
  isOpen,
  onComplete,
  amount,
  targetChain = "Base",
  targetChainId = 8453,
  targetProtocol = "",
  depositState,
  onStartDeposit,
}: LiFiExecutionProps) {
  const contractsDeployed = Object.values(VAULT_FACTORIES).some(
    (v) => v !== null,
  );

  const steps = buildSteps(targetChain, targetProtocol, depositState);
  const allCompleted = depositState?.step === "complete";
  const hasError = depositState?.step === "error";
  const [hasTriggered, setHasTriggered] = useState(false);

  // Trigger the real deposit flow ONCE when execution overlay opens
  useEffect(() => {
    if (isOpen && contractsDeployed && onStartDeposit && !hasTriggered) {
      setHasTriggered(true);
      onStartDeposit(targetChainId, amount);
    }
    if (!isOpen && hasTriggered) {
      setHasTriggered(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-advance to complete view after deposit succeeds
  useEffect(() => {
    if (allCompleted) {
      const timer = setTimeout(() => onComplete(), 3000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCompleted]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

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
                      <span className="text-2xl">
                        {hasError ? "!" : allCompleted ? "\u2713" : "\u26A1"}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {allCompleted
                          ? "Deposit Complete"
                          : hasError
                            ? "Deposit Failed"
                            : !contractsDeployed
                              ? "Contracts Pending"
                              : "Depositing..."}
                      </h2>
                      <p className="text-sm font-mono text-[#8b92a8]">
                        {allCompleted
                          ? "USDC deposited into vault. Agent will deploy to best protocol."
                          : hasError
                            ? depositState?.error || "An error occurred"
                            : !contractsDeployed
                              ? "Vault contracts are being deployed..."
                              : "Executing on-chain deposit..."}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-[#8b92a8]">Amount</p>
                    <p className="font-mono text-xl font-bold text-white">
                      {amount.toLocaleString()} USDC
                    </p>
                  </div>
                </div>
              </div>

              {/* Execution Timeline */}
              <div className="p-8">
                {!contractsDeployed ? (
                  <div className="rounded-xl bg-[#141823] border-2 border-[#f59e0b]/30 p-6 text-center">
                    <div className="mb-4 flex justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="h-12 w-12 rounded-full border-4 border-[#1e2433] border-t-[#f59e0b]"
                      />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      Smart Contracts Pending Deployment
                    </h3>
                    <p className="text-sm font-mono text-[#8b92a8]">
                      Vault contracts are not yet deployed on {targetChain}.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#141823] border-2 border-[#1e2433] p-6">
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
                                className={`absolute left-[11px] top-8 w-0.5 h-12 transition-all duration-500 ${
                                  isCompleted
                                    ? "bg-[#10b981]"
                                    : isStepError
                                      ? "bg-[#ef4444]"
                                      : "bg-[#1e2433]"
                                }`}
                              />
                            )}

                            <motion.div
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="flex items-start gap-3 py-3"
                            >
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
                                      href={getExplorerTxUrl(targetChainId, step.txHash)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`text-xs font-mono flex items-center gap-1 ${isCompleted ? "text-[#10b981]" : "text-[#3b82f6]"} hover:underline`}
                                    >
                                      {step.txHash.slice(0, 8)}...{step.txHash.slice(-6)}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>

                                {step.subtext && isCompleted && (
                                  <motion.p
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="mt-1 pl-4 text-xs font-mono text-[#10b981] border-l-2 border-[#10b981]"
                                  >
                                    &rarr; {step.subtext}
                                  </motion.p>
                                )}

                                {isStepError && depositState?.error && (
                                  <motion.p
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="mt-1 pl-4 text-xs font-mono text-[#ef4444] border-l-2 border-[#ef4444]"
                                  >
                                    {depositState.error}
                                  </motion.p>
                                )}

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
                )}

                {/* Bottom Status */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className={`mt-6 rounded-xl border-2 p-4 transition-all duration-500 ${
                    allCompleted
                      ? "bg-gradient-to-r from-[#10b981]/10 to-[#3b82f6]/10 border-[#10b981]"
                      : hasError
                        ? "bg-[#ef4444]/10 border-[#ef4444]"
                        : "bg-[#141823] border-[#1e2433]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          allCompleted
                            ? "bg-[#10b981]"
                            : hasError
                              ? "bg-[#ef4444]"
                              : "bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6]"
                        }`}
                      >
                        {allCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-white" />
                        ) : hasError ? (
                          <AlertCircle className="h-5 w-5 text-white" />
                        ) : (
                          <ArrowRight className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">
                          {allCompleted
                            ? "Deposit Confirmed"
                            : hasError
                              ? "Transaction Failed"
                              : "Processing Deposit..."}
                        </p>
                        <p className="text-xs font-mono text-[#8b92a8]">
                          {allCompleted
                            ? `USDC deposited. Agent will deploy to best yield on ${targetChain}.`
                            : hasError
                              ? depositState?.error || "An unexpected error occurred."
                              : "Signing and submitting transactions..."}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-[#8b92a8]">
                        {allCompleted ? "Destination" : "Target"}
                      </p>
                      <p
                        className={`font-mono font-bold ${
                          allCompleted
                            ? "text-[#10b981] text-lg"
                            : "text-[#3b82f6]"
                        }`}
                      >
                        {targetChain}
                      </p>
                    </div>
                  </div>

                  {allCompleted && depositState?.txHash && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-4 pt-4 border-t border-[#10b981]/30"
                    >
                      <a
                        href={getExplorerTxUrl(targetChainId, depositState.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm font-mono text-[#10b981] hover:text-[#059669] transition-colors group"
                      >
                        <span>View Transaction on Block Explorer</span>
                        <ExternalLink className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </a>
                    </motion.div>
                  )}

                  {hasError && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 pt-4 border-t border-[#ef4444]/30"
                    >
                      <button
                        onClick={onComplete}
                        className="text-sm font-mono text-[#ef4444] hover:text-[#dc2626] transition-colors"
                      >
                        Close and try again
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
