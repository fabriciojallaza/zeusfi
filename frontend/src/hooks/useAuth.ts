import { useEffect, useCallback, useRef } from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { NonceResponse, VerifyResponse } from "@/types/api";
import { toast } from "sonner";
import axios from "axios";

function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === "ERR_NETWORK" || err.code === "ECONNREFUSED") {
      return "Cannot connect to backend server. Is it running?";
    }
    const data = err.response?.data;
    if (data?.detail) return data.detail;
    if (data?.message) return data.message;
    if (err.response?.status === 500) return "Server error. Try again later.";
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Authentication failed";
}

export function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { token, wallet, isAuthenticated, setAuth, logout } = useAuthStore();
  const authenticatingRef = useRef(false);
  const authFailedRef = useRef(false);

  const authenticate = useCallback(async () => {
    if (!address || authenticatingRef.current) return;
    authenticatingRef.current = true;
    authFailedRef.current = false;

    try {
      // Step 1: Get nonce + SIWE message
      const { data: nonceData } = await api.post<NonceResponse>(
        "/auth/nonce/",
        { wallet_address: address },
      );

      // Step 2: Sign the message
      const signature = await signMessageAsync({
        message: nonceData.message,
      });

      // Step 3: Verify signature, get JWT
      const { data: verifyData } = await api.post<VerifyResponse>(
        "/auth/verify/",
        {
          wallet_address: address,
          message: nonceData.message,
          signature,
          nonce: nonceData.nonce,
        },
      );

      setAuth(verifyData.token, verifyData.wallet);
    } catch (err: unknown) {
      authFailedRef.current = true;
      const message = extractErrorMessage(err);
      // Don't toast if user rejected the signature
      if (!message.includes("User rejected") && !message.includes("User denied")) {
        toast.error("Authentication failed", { description: message });
      }
    } finally {
      authenticatingRef.current = false;
    }
  }, [address, signMessageAsync, setAuth]);

  const handleLogout = useCallback(() => {
    logout();
    disconnect();
  }, [logout, disconnect]);

  // Auto-authenticate when wallet connects and not yet authed (only once)
  useEffect(() => {
    if (isConnected && address && !isAuthenticated && !authFailedRef.current) {
      authenticate();
    }
  }, [isConnected, address, isAuthenticated, authenticate]);

  // Reset failure flag when wallet changes so new address can try auth
  useEffect(() => {
    authFailedRef.current = false;
  }, [address]);

  // Clear auth when wallet disconnects
  useEffect(() => {
    if (!isConnected && isAuthenticated) {
      logout();
    }
  }, [isConnected, isAuthenticated, logout]);

  return {
    isConnected,
    isAuthenticated,
    address,
    wallet,
    token,
    authenticate,
    logout: handleLogout,
  };
}
