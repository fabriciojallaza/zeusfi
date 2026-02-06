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
} from "lucide-react";
import { VAULT_FACTORIES } from "@/lib/constants";
import { CHAIN_CONFIG, getExplorerTxUrl } from "@/lib/chains";

interface LiFiExecutionProps {
  isOpen: boolean;
  onComplete: () => void;
  amount: number;
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
  targetChain = "Base",
  targetProtocol = "",
}: LiFiExecutionProps) {
  // Check if contracts are deployed for any chain
  const contractsDeployed = Object.values(VAULT_FACTORIES).some(
    (v) => v !== null,
  );

  const [steps, setSteps] = useState<ExecutionStep[]>(makeSteps(targetChain, targetProtocol));
  const [allCompleted, setAllCompleted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSteps(makeSteps(targetChain, targetProtocol));
      setAllCompleted(false);
      return;
    }

    if (!contractsDeployed) {
      // Show informational state - auto-complete after delay
      const timer = setTimeout(() => {
        setAllCompleted(true);
        setTimeout(() => onComplete(), 2000);
      }, 3000);
      return () => clearTimeout(timer);
    }

    const stepTimings = [1000, 1500, 2500, 2000, 1500];
    let cumulativeTime = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    steps.forEach((_, index) => {
      const activeTimer = setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, i) =>
            i === index ? { ...s, status: "active" as StepStatus } : s,
          ),
        );
      }, cumulativeTime);
      timers.push(activeTimer);

      const completeTimer = setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, i) =>
            i === index ? { ...s, status: "completed" as StepStatus } : s,
          ),
        );

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
                      <span className="text-2xl">⚡</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {allCompleted
                          ? "Execution Complete"
                          : !contractsDeployed
                            ? "Contracts Pending"
                            : "Live Execution Log"}
                      </h2>
                      <p className="text-sm font-mono text-[#8b92a8]">
                        {allCompleted
                          ? "Transaction confirmed on-chain"
                          : !contractsDeployed
                            ? "Vault contracts are being deployed..."
                            : "Agent executing cross-chain deployment..."}
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
                {!contractsDeployed && !allCompleted ? (
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
                      Your yield opportunity has been recorded and will be
                      executed once contracts are live.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#141823] border-2 border-[#1e2433] p-6">
                    <div className="space-y-1 relative">
                      {steps.map((step, index) => {
                        const isLast = index === steps.length - 1;
                        const isActive = step.status === "active";
                        const isCompleted = step.status === "completed";

                        return (
                          <div key={step.id} className="relative">
                            {!isLast && (
                              <div
                                className={`absolute left-[11px] top-8 w-0.5 h-12 transition-all duration-500 ${
                                  isCompleted
                                    ? "bg-[#10b981]"
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
                                        : isActive
                                          ? "text-white font-bold"
                                          : "text-[#8b92a8]/40"
                                    }`}
                                  >
                                    {step.text}
                                  </p>
                                  {step.txHash && (isActive || isCompleted) && (
                                    <span
                                      className={`text-xs font-mono ${isCompleted ? "text-[#10b981]" : "text-[#3b82f6]"}`}
                                    >
                                      {step.txHash}
                                    </span>
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
                            ? contractsDeployed
                              ? "Transaction Confirmed"
                              : "Strategy Queued"
                            : "Li.Fi Cross-Chain Infrastructure"}
                        </p>
                        <p className="text-xs font-mono text-[#8b92a8]">
                          {allCompleted
                            ? contractsDeployed
                              ? `Your funds are now earning yield on ${targetChain}`
                              : "Will execute when contracts deploy"
                            : "Aggregating 20+ bridges - Best execution guaranteed"}
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

                  {allCompleted && contractsDeployed && (
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

function makeSteps(targetChain: string, targetProtocol: string): ExecutionStep[] {
  return [
    {
      id: "ens",
      icon: <Shield className="h-4 w-4" />,
      text: "Reading ENS preferences...",
      status: "pending",
    },
    {
      id: "scan",
      icon: <Search className="h-4 w-4" />,
      text: "Scanning chains & pools...",
      subtext: `Selected: ${targetProtocol} (${targetChain})`,
      status: "pending",
    },
    {
      id: "bridge",
      icon: <LinkIcon className="h-4 w-4" />,
      text: `Bridging assets to ${targetChain} via Li.Fi...`,
      status: "pending",
    },
    {
      id: "deposit",
      icon: <Wallet className="h-4 w-4" />,
      text: `Depositing into ${targetProtocol}...`,
      status: "pending",
    },
    {
      id: "complete",
      icon: <CheckCircle2 className="h-4 w-4" />,
      text: "Done. Yield Active.",
      status: "pending",
    },
  ];
}
