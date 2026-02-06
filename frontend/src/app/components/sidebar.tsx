import { motion } from "motion/react";
import { Home, Settings, Activity, Vault, Sparkles } from "lucide-react";

type ViewType = "dashboard" | "settings" | "activity" | "vault";

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const navigationItems = [
  { id: "dashboard" as ViewType, icon: Home, label: "Dashboard" },
  { id: "settings" as ViewType, icon: Settings, label: "Agent Settings" },
  { id: "activity" as ViewType, icon: Activity, label: "Activity Log" },
  { id: "vault" as ViewType, icon: Vault, label: "Vault Details" },
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-20 border-r border-[#1e293b] bg-[#0f172a] z-40 flex flex-col">
      {/* Logo/Brand */}
      <div className="flex h-20 items-center justify-center border-b border-[#1e293b]">
        <motion.div
          animate={{
            boxShadow: [
              "0 0 15px rgba(59, 130, 246, 0.3)",
              "0 0 25px rgba(59, 130, 246, 0.6)",
              "0 0 15px rgba(59, 130, 246, 0.3)",
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6]"
        >
          <Sparkles className="h-6 w-6 text-white" />
        </motion.div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-8">
        <div className="space-y-2 px-3">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`group relative flex w-full flex-col items-center justify-center gap-1.5 rounded-xl py-3 transition-all ${
                  isActive
                    ? "bg-[#3b82f6]/20 text-white"
                    : "text-[#64748b] hover:bg-[#1e293b] hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute inset-0 rounded-xl border-2 border-[#3b82f6]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className="h-5 w-5 relative z-10" />
                <span className="text-[10px] font-mono font-bold uppercase relative z-10">
                  {item.label.split(" ")[0]}
                </span>

                {/* Tooltip */}
                <div className="absolute left-full ml-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="rounded-lg bg-[#1e293b] border border-[#3b82f6] px-3 py-2 whitespace-nowrap shadow-xl">
                    <p className="text-xs font-mono font-bold text-white">
                      {item.label}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Bottom Indicator */}
      <div className="p-4 border-t border-[#1e293b]">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
          </div>
        </div>
      </div>
    </aside>
  );
}
