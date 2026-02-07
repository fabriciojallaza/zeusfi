import { useState, useCallback } from "react";
import { useReadContract } from "wagmi";
import { zeroAddress } from "viem";
import { VAULT_FACTORIES } from "@/lib/constants";
import { VAULT_FACTORY_ABI } from "@/lib/contracts";
import { useVaultActions } from "./useVaultActions";
import api from "@/lib/api";

export type WithdrawStep =
  | "idle"
  | "checking_balance"
  | "requesting_unwind"
  | "waiting_unwind"
  | "withdrawing"
  | "confirming"
  | "complete"
  | "error";

export interface WithdrawState {
  step: WithdrawStep;
  txHash?: string;
  error?: string;
}

export function useWithdrawFlow() {
  const [state, setState] = useState<WithdrawState>({ step: "idle" });
  const [vaultAddr, setVaultAddr] = useState<`0x${string}` | undefined>();
  const [chainId, setChainId] = useState<number | undefined>();

  const { withdraw: vaultWithdraw, vaultBalance } = useVaultActions(
    vaultAddr,
    chainId,
  );

  const executeWithdraw = useCallback(
    async (targetChainId: number, userAddress: `0x${string}`) => {
      try {
        setChainId(targetChainId);

        const factory = VAULT_FACTORIES[targetChainId] as
          | `0x${string}`
          | undefined;
        if (!factory) {
          setState({
            step: "error",
            error: "Contracts not deployed on this chain",
          });
          return;
        }

        // Step 1: Check vault balance
        setState({ step: "checking_balance" });

        // We need to find the vault address first
        // For now, trigger the agent to unwind if needed, then withdraw
        // The vault address will be read from the hook

        // Step 2: If USDC is in protocol, request agent unwind
        // Check if vault has direct USDC balance
        const hasBalance = vaultBalance && vaultBalance > 0n;

        if (!hasBalance) {
          setState({ step: "requesting_unwind" });
          try {
            await api.post("/agent/trigger/", {
              wallet_address: userAddress,
            });
          } catch {
            // Agent trigger is best-effort
          }

          // Wait for agent to unwind (poll for balance)
          setState({ step: "waiting_unwind" });
          // In production: poll vault.getBalance() until > 0
          // For MVP: wait a fixed time
          await new Promise((r) => setTimeout(r, 10000));
        }

        // Step 3: Withdraw from vault
        setState({ step: "withdrawing" });
        const hash = await vaultWithdraw();
        if (!hash) {
          setState({
            step: "error",
            error: "Withdraw transaction failed or was rejected",
          });
          return;
        }

        // Step 4: Confirm
        setState({ step: "confirming", txHash: hash });
        await new Promise((r) => setTimeout(r, 5000));

        setState({ step: "complete", txHash: hash });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setState({ step: "error", error: message });
      }
    },
    [vaultWithdraw, vaultBalance],
  );

  const reset = useCallback(() => {
    setState({ step: "idle" });
    setVaultAddr(undefined);
    setChainId(undefined);
  }, []);

  return {
    state,
    executeWithdraw,
    reset,
  };
}
