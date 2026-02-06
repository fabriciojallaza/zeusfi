import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { BrowserRouter } from "react-router-dom";
import { wagmiConfig } from "@/lib/wagmi";
import { configureApiAuth } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import App from "./app/App.tsx";
import "@rainbow-me/rainbowkit/styles.css";
import "./styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// Wire API client to auth store (avoids circular imports)
configureApiAuth(
  () => useAuthStore.getState().token,
  () => useAuthStore.getState().logout(),
);

createRoot(document.getElementById("root")!).render(
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider
        theme={darkTheme({ accentColor: "#3b82f6" })}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>,
);
