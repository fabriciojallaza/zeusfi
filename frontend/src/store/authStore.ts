import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Wallet } from "@/types/api";

interface AuthState {
  token: string | null;
  wallet: Wallet | null;
  isAuthenticated: boolean;
  sessionExpired: boolean;
  setAuth: (token: string, wallet: Wallet) => void;
  logout: () => void;
  updateWallet: (wallet: Wallet) => void;
  setSessionExpired: (expired: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      wallet: null,
      isAuthenticated: false,
      sessionExpired: false,
      setAuth: (token, wallet) =>
        set({ token, wallet, isAuthenticated: true, sessionExpired: false }),
      logout: () =>
        set({ token: null, wallet: null, isAuthenticated: false, sessionExpired: false }),
      updateWallet: (wallet) => set({ wallet }),
      setSessionExpired: (expired) => set({ sessionExpired: expired }),
    }),
    {
      name: "zeusfi-auth",
      partialize: (state) => ({
        token: state.token,
        wallet: state.wallet,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
