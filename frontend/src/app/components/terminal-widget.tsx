import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Terminal, ChevronUp, ChevronDown } from "lucide-react";

interface TerminalLog {
  id: string;
  timestamp: Date;
  message: string;
  type: "info" | "success" | "warning";
}

const mockLogs: TerminalLog[] = [
  {
    id: "1",
    timestamp: new Date(Date.now() - 180000),
    message:
      "Agent initialized. Monitoring 12 chains for yield opportunities...",
    type: "info",
  },
  {
    id: "2",
    timestamp: new Date(Date.now() - 120000),
    message: "Agent detected 18.7% APY on Uniswap v4 (Base)... Evaluating...",
    type: "success",
  },
  {
    id: "3",
    timestamp: new Date(Date.now() - 60000),
    message: "ENS strategy verified: Balanced (Min 5% APY). Proceeding...",
    type: "info",
  },
  {
    id: "4",
    timestamp: new Date(Date.now() - 30000),
    message: "Initiating Li.Fi cross-chain bridge to Base network...",
    type: "info",
  },
  {
    id: "5",
    timestamp: new Date(Date.now() - 5000),
    message: "Success. Position active on Uniswap v4 with Auto-Compound Hook.",
    type: "success",
  },
];

export function TerminalWidget() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [logs, setLogs] = useState<TerminalLog[]>(mockLogs);

  useEffect(() => {
    // Simulate new logs appearing
    const interval = setInterval(() => {
      const newLog: TerminalLog = {
        id: Date.now().toString(),
        timestamp: new Date(),
        message: "Monitoring yield rates across protocols...",
        type: "info",
      };
      setLogs((prev) => [...prev.slice(-4), newLog]);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const getLogColor = (type: TerminalLog["type"]) => {
    switch (type) {
      case "success":
        return "text-[#10b981]";
      case "warning":
        return "text-[#f59e0b]";
      default:
        return "text-[#64748b]";
    }
  };

  const getLogPrefix = (type: TerminalLog["type"]) => {
    switch (type) {
      case "success":
        return "✓";
      case "warning":
        return "⚠";
      default:
        return ">";
    }
  };

  return (
    <div className="fixed bottom-0 left-20 right-0 z-30 border-t border-[#1e293b] bg-[#0f172a]">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-6 py-3 hover:bg-[#1e293b] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e293b]">
            <Terminal className="h-4 w-4 text-[#3b82f6]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white">Agent Terminal</p>
            <p className="text-xs font-mono text-[#64748b]">
              Live execution logs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-xs font-mono text-[#10b981]">ACTIVE</span>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-[#64748b]" />
        ) : (
          <ChevronUp className="h-5 w-5 text-[#64748b]" />
        )}
      </button>

      {/* Logs */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-[#1e293b] bg-[#020617] overflow-hidden"
          >
            <div className="px-6 py-4 max-h-48 overflow-y-auto">
              <div className="space-y-2 font-mono text-xs">
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-3"
                  >
                    <span className="text-[#475569] flex-shrink-0">
                      [{log.timestamp.toLocaleTimeString()}]
                    </span>
                    <span className={`${getLogColor(log.type)} flex-shrink-0`}>
                      {getLogPrefix(log.type)}
                    </span>
                    <span className={getLogColor(log.type)}>{log.message}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
