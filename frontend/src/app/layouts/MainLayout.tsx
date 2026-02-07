import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/app/components/header";
import { Sidebar } from "@/app/components/sidebar";
import { AICoPilot } from "@/app/components/ai-copilot";
import { Toaster } from "sonner";

type ViewType = "dashboard" | "settings" | "activity" | "vault";

const VIEW_TO_ROUTE: Record<ViewType, string> = {
  dashboard: "/",
  settings: "/settings",
  activity: "/history",
  vault: "/vault",
};

const ROUTE_TO_VIEW: Record<string, ViewType> = {
  "/": "dashboard",
  "/settings": "settings",
  "/history": "activity",
  "/vault": "vault",
};

export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentView: ViewType =
    ROUTE_TO_VIEW[location.pathname] || "dashboard";

  const handleViewChange = (view: ViewType) => {
    navigate(VIEW_TO_ROUTE[view]);
  };

  return (
    <div className="dark min-h-screen bg-[#0a0e1a]">
      <Sidebar currentView={currentView} onViewChange={handleViewChange} />

      <div className="ml-20">
        <Header />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <Outlet />
        </main>
      </div>

      <AICoPilot />
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: {
            background: "#141823",
            border: "1px solid #1e2433",
            color: "#fff",
          },
        }}
      />
    </div>
  );
}
