import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Shuffle, Lock, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { Token } from "@/app/components/token-table";

interface ProcessModalProps {
  isOpen: boolean;
  onComplete: () => void;
  amount: number;
  token: Token;
}

type ProcessState = "scanning" | "optimizing" | "depositing" | "success";

interface StateInfo {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

const stateInfo: Record<ProcessState, StateInfo> = {
  scanning: {
    icon: Search,
    title: "Scanning chains for best yield opportunities...",
    description: "Analyzing yield rates across multiple protocols",
  },
  optimizing: {
    icon: Shuffle,
    title: "Optimizing route and moving funds via Li.Fi...",
    description: "Executing cross-chain bridge to optimal network",
  },
  depositing: {
    icon: Lock,
    title: "Depositing into yield strategy...",
    description: "Securing your funds in the best performing vault",
  },
  success: {
    icon: CheckCircle2,
    title: "Success! Your USDC is now earning yield.",
    description: "Your funds are actively generating returns",
  },
};

export function ProcessModal({
  isOpen,
  onComplete,
  amount,
  token,
}: ProcessModalProps) {
  const [currentState, setCurrentState] = useState<ProcessState>("scanning");

  useEffect(() => {
    if (!isOpen) {
      setCurrentState("scanning");
      return;
    }

    // Simulate process flow
    const timer1 = setTimeout(() => setCurrentState("optimizing"), 2000);
    const timer2 = setTimeout(() => setCurrentState("depositing"), 4000);
    const timer3 = setTimeout(() => setCurrentState("success"), 6000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentInfo = stateInfo[currentState];
  const Icon = currentInfo.icon;
  const isSuccess = currentState === "success";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-md mx-4"
          >
            <div className="rounded-2xl bg-[#141823] border border-[#1e2433] p-8 shadow-2xl">
              {/* Icon */}
              <div className="mb-6 flex justify-center">
                {isSuccess ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="flex h-24 w-24 items-center justify-center rounded-full bg-[#10b981]/20"
                  >
                    <Icon className="h-12 w-12 text-[#10b981]" />
                  </motion.div>
                ) : (
                  <div className="relative flex h-24 w-24 items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="absolute inset-0 rounded-full border-4 border-[#1e2433] border-t-[#3b82f6]"
                    />
                    <Icon className="h-10 w-10 text-[#3b82f6]" />
                  </div>
                )}
              </div>

              {/* Title */}
              <h2 className="mb-2 text-center text-xl font-semibold text-white">
                {currentInfo.title}
              </h2>

              {/* Description */}
              <p className="mb-6 text-center text-sm text-[#8b92a8]">
                {currentInfo.description}
              </p>

              {/* Amount Display */}
              <div className="mb-6 rounded-lg bg-[#0a0e1a] border border-[#1e2433] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#8b92a8]">Amount</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-white">
                      {amount.toLocaleString()} {token.symbol}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Steps */}
              <div className="mb-6 space-y-2">
                {(
                  ["scanning", "optimizing", "depositing"] as ProcessState[]
                ).map((state, index) => {
                  const isComplete =
                    (state === "scanning" &&
                      ["optimizing", "depositing", "success"].includes(
                        currentState,
                      )) ||
                    (state === "optimizing" &&
                      ["depositing", "success"].includes(currentState)) ||
                    (state === "depositing" && currentState === "success");
                  const isCurrent = state === currentState;

                  return (
                    <div
                      key={state}
                      className={`flex items-center gap-3 rounded-lg p-2 transition-colors ${
                        isCurrent ? "bg-[#1e2433]" : ""
                      }`}
                    >
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                          isComplete
                            ? "border-[#10b981] bg-[#10b981]"
                            : isCurrent
                              ? "border-[#3b82f6] bg-[#3b82f6]"
                              : "border-[#1e2433] bg-transparent"
                        }`}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        ) : isCurrent ? (
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                        ) : (
                          <span className="text-xs text-[#8b92a8]">
                            {index + 1}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-sm ${
                          isComplete || isCurrent
                            ? "text-white"
                            : "text-[#8b92a8]"
                        }`}
                      >
                        {stateInfo[state].title.split("...")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Close Button (only on success) */}
              {isSuccess && (
                <Button
                  onClick={onComplete}
                  className="w-full h-12 bg-gradient-to-r from-[#10b981] to-[#3b82f6] hover:from-[#059669] hover:to-[#2563eb] text-white rounded-xl transition-all duration-200"
                >
                  View Dashboard
                </Button>
              )}

              {/* Trust Badge */}
              {!isSuccess && (
                <div className="mt-4 text-center">
                  <p className="text-xs text-[#8b92a8]">
                    Secured by Li.Fi cross-chain infrastructure
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
