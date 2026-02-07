import { useEffect, useCallback } from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { useAuthStore } from "@/store/authStore";
import { configureApiAuth } from "@/lib/api";
import api from "@/lib/api";
import type { NonceResponse, VerifyResponse } from "@/types/api";
import { toast } from "sonner";
import axios from "axios";

// Module-level lock — shared across all useAuth() instances to prevent
// multiple components from triggering auth simultaneously.
let _authenticating = false;
let _authFailed = false;

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
  const {
    token,
    wallet,
    isAuthenticated,
    sessionExpired,
    setAuth,
    logout,
    setSessionExpired,
  } = useAuthStore();
  // Using module-level _authenticating / _authFailed instead of refs
  // so the lock is shared across all components that call useAuth().

  // Configure API auth — use setSessionExpired instead of hard logout on 401
  useEffect(() => {
    configureApiAuth(
      () => useAuthStore.getState().token,
      () => useAuthStore.getState().setSessionExpired(true),
    );
  }, []);

  // Watch sessionExpired — show toast with reconnect action
  useEffect(() => {
    if (!sessionExpired) return;

    toast.error("Session expired", {
      description: "Please reconnect your wallet.",
      duration: Infinity,
      action: {
        label: "Reconnect",
        onClick: () => {
          setSessionExpired(false);
          logout();
          disconnect();
        },
      },
    });
  }, [sessionExpired, setSessionExpired, logout, disconnect]);

  const authenticate = useCallback(async () => {
    if (!address || _authenticating) return;
    _authenticating = true;
    _authFailed = false;

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
      _authFailed = true;
      const message = extractErrorMessage(err);
      // Show toast for all failures including user rejection
      toast.error("Authentication failed", {
        description: message.includes("User rejected") || message.includes("User denied")
          ? "Signature rejected. Please sign to log in."
          : message,
      });
    } finally {
      _authenticating = false;
    }
  }, [address, signMessageAsync, setAuth]);

  const handleLogout = useCallback(() => {
    logout();
    disconnect();
  }, [logout, disconnect]);

  // Auto-authenticate when wallet connects and not yet authed (only once)
  useEffect(() => {
    if (isConnected && address && !isAuthenticated && !_authFailed) {
      authenticate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, isAuthenticated]);

  // Reset failure flag when wallet changes so new address can try auth
  useEffect(() => {
    _authFailed = false;
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
