import { Routes, Route } from "react-router-dom";
import { MainLayout } from "@/app/layouts/MainLayout";
import { DashboardPage } from "@/app/pages/DashboardPage";
import { SettingsPage } from "@/app/pages/SettingsPage";
import { HistoryPage } from "@/app/pages/HistoryPage";
import { VaultPage } from "@/app/pages/VaultPage";
import { NotFoundPage } from "@/app/pages/NotFoundPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
