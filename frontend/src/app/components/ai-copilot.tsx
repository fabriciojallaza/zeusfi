import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Send, Sparkles } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
}

const mockConversation: Message[] = [
  {
    id: "1",
    role: "agent",
    content:
      "Hello! I'm your AI Yield Agent. I've analyzed your ENS profile and I'm monitoring 12+ protocols across 3 chains in real-time.",
    timestamp: new Date(Date.now() - 300000),
  },
  {
    id: "2",
    role: "user",
    content: "Why did you choose the Base network right now?",
    timestamp: new Date(Date.now() - 180000),
  },
  {
    id: "3",
    role: "agent",
    content:
      "I analyzed 12 chains. Currently, Uniswap v4 on Base offers a 18.7% APY due to high trading volume. The Auto-Compound Hook I detected boosts this by an extra 6.2% compared to Aave on Arbitrum.",
    timestamp: new Date(Date.now() - 120000),
  },
];

const actionChips = [
  "Update my ENS Risk Profile",
  "Explain this Strategy",
  "Check Li.Fi Bridge Status",
];

export function AICoPilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(mockConversation);
  const [inputValue, setInputValue] = useState("");

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInputValue("");

    // Simulate agent response after a delay
    setTimeout(() => {
      const agentResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content:
          "I'm analyzing your request and monitoring the latest on-chain data. This is a demo response.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentResponse]);
    }, 1000);
  };

  const handleChipClick = (chipText: string) => {
    setInputValue(chipText);
  };

  const highlightKeywords = (text: string) => {
    const keywords = [
      "Uniswap v4",
      "Base",
      "Hook",
      "Auto-Compound",
      "Li.Fi",
      "ENS",
      "Aave",
      "Arbitrum",
    ];
    let highlightedText = text;

    keywords.forEach((keyword) => {
      const regex = new RegExp(`(${keyword})`, "gi");
      highlightedText = highlightedText.replace(
        regex,
        '<span class="keyword-highlight">$1</span>',
      );
    });

    return highlightedText;
  };

  return (
    <>
      {/* Floating Co-Pilot Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 group"
          >
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 20px rgba(6, 182, 212, 0.4)",
                  "0 0 40px rgba(6, 182, 212, 0.7)",
                  "0 0 20px rgba(6, 182, 212, 0.4)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#06b6d4] to-[#3b82f6] backdrop-blur-xl border-2 border-[#06b6d4] shadow-2xl"
            >
              {/* Pulsing Neural Node Animation */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 180, 360],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-2 rounded-full border-2 border-white/30"
              />
              <motion.div
                animate={{
                  scale: [1.2, 1, 1.2],
                  rotate: [360, 180, 0],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-4 rounded-full border-2 border-white/20"
              />
              <Sparkles className="h-7 w-7 text-white relative z-10" />

              {/* Notification Dot */}
              <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#10b981] border-2 border-[#0a0e1a] animate-pulse" />
            </motion.div>

            {/* Tooltip */}
            <div className="absolute bottom-full right-0 mb-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="rounded-lg bg-[#0a0e1a] border-2 border-[#06b6d4] px-3 py-2 whitespace-nowrap shadow-xl">
                <p className="text-xs font-mono font-bold text-white">
                  AI Co-Pilot
                </p>
                <p className="text-[10px] font-mono text-[#8b92a8]">
                  Ask me anything
                </p>
              </div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[420px] h-[600px] rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: "rgba(10, 14, 26, 0.95)",
              backdropFilter: "blur(20px)",
              border: "2px solid rgba(6, 182, 212, 0.5)",
              boxShadow: "0 0 40px rgba(6, 182, 212, 0.3)",
            }}
          >
            {/* Header */}
            <div className="relative border-b-2 border-[#1e2433] bg-gradient-to-r from-[#0a0e1a] to-[#141823] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{
                      rotate: [0, 360],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#06b6d4] to-[#3b82f6]"
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.3, 1],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-1 rounded-full border border-white/40"
                    />
                    <Sparkles className="h-5 w-5 text-white relative z-10" />
                  </motion.div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      AI Co-Pilot
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
                      <p className="text-xs font-mono text-[#8b92a8]">
                        Online • Monitoring
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e2433] hover:bg-[#2a3244] transition-colors"
                >
                  <X className="h-4 w-4 text-[#8b92a8]" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="h-[420px] overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl p-3 ${
                      message.role === "user"
                        ? "bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] text-white"
                        : "bg-[#141823] border-2 border-[#1e2433] text-white"
                    }`}
                  >
                    {message.role === "agent" ? (
                      <div
                        className="text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: highlightKeywords(message.content),
                        }}
                      />
                    ) : (
                      <p className="text-sm leading-relaxed">
                        {message.content}
                      </p>
                    )}
                    <p
                      className={`mt-2 text-[10px] font-mono ${
                        message.role === "user"
                          ? "text-white/60"
                          : "text-[#8b92a8]"
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Smart Suggestion Chips */}
            <div className="border-t-2 border-[#1e2433] bg-[#0a0e1a] p-3">
              <div className="flex flex-wrap gap-2 mb-3">
                {actionChips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleChipClick(chip)}
                    className="rounded-lg bg-[#141823] border border-[#1e2433] hover:border-[#06b6d4] hover:bg-[#1e2433] px-3 py-1.5 text-xs font-mono text-[#8b92a8] hover:text-white transition-all"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Ask the AI Agent..."
                  className="flex-1 rounded-lg bg-[#141823] border-2 border-[#1e2433] focus:border-[#06b6d4] px-3 py-2 text-sm text-white placeholder:text-[#8b92a8] focus:outline-none font-mono"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim()}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#06b6d4] to-[#3b82f6] hover:from-[#0891b2] hover:to-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSS for Keyword Highlighting */}
      <style>{`
        .keyword-highlight {
          color: #06b6d4;
          font-weight: 700;
          font-family: ui-monospace, SFMono-Regular, monospace;
        }
      `}</style>
    </>
  );
}
