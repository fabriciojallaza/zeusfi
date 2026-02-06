import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Wallet } from "@/types/api";

interface AuthState {
  token: string | null;
  wallet: Wallet | null;
  isAuthenticated: boolean;
  setAuth: (token: string, wallet: Wallet) => void;
  logout: () => void;
  updateWallet: (wallet: Wallet) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      wallet: null,
      isAuthenticated: false,
      setAuth: (token, wallet) =>
        set({ token, wallet, isAuthenticated: true }),
      logout: () =>
        set({ token: null, wallet: null, isAuthenticated: false }),
      updateWallet: (wallet) => set({ wallet }),
    }),
    { name: "zeusfi-auth" },
  ),
);
