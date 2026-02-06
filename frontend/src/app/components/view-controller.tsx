import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useState } from "react";

type AppView = "deposit" | "processing" | "active";

interface ViewControllerProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

const views: AppView[] = ["deposit", "processing", "active"];
const viewLabels: Record<AppView, string> = {
  deposit: "Token Selection / Deposit",
  processing: "Processing Modal",
  active: "Active Dashboard",
};

export function ViewController({
  currentView,
  onViewChange,
}: ViewControllerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const currentIndex = views.indexOf(currentView);

  const goToPrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : views.length - 1;
    onViewChange(views[newIndex]);
  };

  const goToNext = () => {
    const newIndex = currentIndex < views.length - 1 ? currentIndex + 1 : 0;
    onViewChange(views[newIndex]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Toggle Button */}
      {!isExpanded && (
        <Button
          onClick={() => setIsExpanded(true)}
          className="h-12 w-12 rounded-full bg-[#3b82f6] hover:bg-[#2563eb] shadow-lg shadow-[#3b82f6]/30"
        >
          <Settings className="h-5 w-5 text-white" />
        </Button>
      )}

      {/* Expanded Controller */}
      {isExpanded && (
        <div className="rounded-xl bg-[#141823] border border-[#1e2433] p-4 shadow-2xl min-w-[320px]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              View Controller
            </h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-[#8b92a8] hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Current View Display */}
          <div className="mb-4 rounded-lg bg-[#0a0e1a] border border-[#1e2433] p-3">
            <p className="mb-1 text-xs text-[#8b92a8]">Current View</p>
            <p className="text-sm font-semibold text-white">
              {viewLabels[currentView]}
            </p>
            <p className="mt-1 text-xs text-[#8b92a8]">
              {currentIndex + 1} of {views.length}
            </p>
          </div>

          {/* Navigation Buttons */}
          <div className="mb-4 flex gap-2">
            <Button
              onClick={goToPrevious}
              variant="outline"
              className="flex-1 bg-transparent border-[#1e2433] hover:bg-[#1e2433] text-white"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              onClick={goToNext}
              variant="outline"
              className="flex-1 bg-transparent border-[#1e2433] hover:bg-[#1e2433] text-white"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {/* Direct View Selection */}
          <div className="space-y-2">
            <p className="text-xs text-[#8b92a8] mb-2">Jump to View:</p>
            {views.map((view) => (
              <button
                key={view}
                onClick={() => onViewChange(view)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                  currentView === view
                    ? "bg-[#3b82f6] text-white"
                    : "bg-[#0a0e1a] text-[#8b92a8] hover:bg-[#1e2433] hover:text-white"
                }`}
              >
                {viewLabels[view]}
              </button>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-[#1e2433]">
            <p className="text-xs text-[#8b92a8]">
              Use this panel to navigate between different app states
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
