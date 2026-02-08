import { useState, useCallback } from "react";
import { useConfig } from "wagmi";
import { getPublicClient, writeContract } from "wagmi/actions";
import { zeroAddress, formatUnits } from "viem";
import { VAULT_FACTORIES, USDC_DECIMALS } from "@/lib/constants";
import { VAULT_FACTORY_ABI, YIELD_VAULT_ABI } from "@/lib/contracts";
import api from "@/lib/api";

export type WithdrawStep =
  | "idle"
  | "resolving_vault"
  | "reading_balance"
  | "unwinding"
  | "polling_balance"
  | "withdrawing"
  | "confirming"
  | "complete"
  | "error";

export interface ProtocolPosition {
  chain_id: number;
  chain_name: string;
  protocol: string;
  token: string;
  amount: string;
  amount_usd: string;
  current_apy: string;
}

export interface WithdrawState {
  step: WithdrawStep;
  txHash?: string;
  error?: string;
  errorAtStep?: WithdrawStep;
  vaultBalance?: number;
  needsUnwind?: boolean;
  /** Fresh position data fetched during preflight */
  protocolValue?: number;
  protocolPositions?: ProtocolPosition[];
}

export function useWithdrawFlow() {
  const [state, setState] = useState<WithdrawState>({ step: "idle" });
  const config = useConfig();

  const readVaultAddress = useCallback(
    async (chainId: number, userAddress: `0x${string}`): Promise<`0x${string}` | null> => {
      const factory = VAULT_FACTORIES[chainId] as `0x${string}` | undefined;
      if (!factory) return null;

      const client = getPublicClient(config, { chainId });
      if (!client) return null;

      let vault: unknown;
      try {
        vault = await client.readContract({
          address: factory,
          abi: VAULT_FACTORY_ABI,
          functionName: "getVault",
          args: [userAddress],
        });
      } catch (err) {
        console.error("[withdraw] readContract getVault failed:", err);
        throw new Error(
          "Failed to read vault from contract. RPC may be rate-limited — try again in a moment.",
        );
      }

      const result = vault as `0x${string}`;
      if (!result || result === zeroAddress) return null;
      return result;
    },
    [config],
  );

  const readVaultBalance = useCallback(
    async (chainId: number, vault: `0x${string}`): Promise<bigint> => {
      const client = getPublicClient(config, { chainId });
      if (!client) return 0n;

      const balance = await client.readContract({
        address: vault,
        abi: YIELD_VAULT_ABI,
        functionName: "getBalance",
      });
      return balance as bigint;
    },
    [config],
  );

  /** Pre-check: resolve vault and read balance. Returns info for the modal. */
  const preflight = useCallback(
    async (targetChainId: number, userAddress: `0x${string}`) => {
      try {
        setState({ step: "resolving_vault" });

        const factory = VAULT_FACTORIES[targetChainId];
        if (!factory) {
          setState({ step: "error", error: "Contracts not deployed on this chain", errorAtStep: "resolving_vault" });
          return null;
        }

        const vault = await readVaultAddress(targetChainId, userAddress);
        if (!vault) {
          setState({ step: "error", error: "No vault found on this chain", errorAtStep: "resolving_vault" });
          return null;
        }

        console.log("[withdraw] vault resolved:", vault);

        setState({ step: "reading_balance" });
        const balance = await readVaultBalance(targetChainId, vault);
        const balanceNum = parseFloat(formatUnits(balance, USDC_DECIMALS));
        console.log("[withdraw] vault USDC balance:", balanceNum);

        const needsUnwind = balanceNum === 0;

        // If vault USDC is 0, fetch fresh positions from API to show protocol value
        let protocolValue = 0;
        let protocolPositions: ProtocolPosition[] = [];
        if (needsUnwind) {
          try {
            const posRes = await api.get(`/positions/${userAddress}/`);
            const posData = posRes.data;
            protocolValue = parseFloat(posData.total_value_usd || "0");
            protocolPositions = posData.positions || [];
          } catch {
            // Non-fatal — modal still works, just shows 0
          }
        }

        setState({
          step: "idle",
          vaultBalance: balanceNum,
          needsUnwind,
          protocolValue,
          protocolPositions,
        });
        return { vault, balance: balanceNum, needsUnwind };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setState((prev) => ({
          step: "error",
          error: message,
          errorAtStep: prev.step !== "error" ? prev.step : prev.errorAtStep,
        }));
        return null;
      }
    },
    [readVaultAddress, readVaultBalance],
  );

  /** Unwind protocol positions via agent, then poll vault until USDC arrives. */
  const unwindAndWithdraw = useCallback(
    async (targetChainId: number, vault: `0x${string}`) => {
      try {
        // Step 1: Call agent unwind
        setState({ step: "unwinding" });
        console.log("[withdraw] requesting agent unwind...");

        const res = await api.post("/agent/unwind/", {}, { timeout: 120_000 });
        const data = res.data;

        if (data.status === "failed") {
          setState({
            step: "error",
            error: `Unwind failed: ${data.errors?.join(", ") || "Unknown error"}`,
            errorAtStep: "unwinding",
          });
          return;
        }

        if (data.status === "already_idle") {
          // USDC is already in vault — just proceed to withdraw
          console.log("[withdraw] already idle, proceeding to withdraw");
        } else {
          // Step 2: Poll vault balance until USDC appears
          setState({ step: "polling_balance" });
          console.log("[withdraw] polling vault balance...");

          let balance = 0n;
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            balance = await readVaultBalance(targetChainId, vault);
            if (balance > 0n) break;
          }

          if (balance === 0n) {
            setState({
              step: "error",
              error: "Timed out waiting for USDC to return to vault",
              errorAtStep: "polling_balance",
            });
            return;
          }
        }

        // Step 3: Withdraw from vault to user wallet
        setState({ step: "withdrawing" });
        console.log("[withdraw] calling withdraw() on vault:", vault);

        const hash = await writeContract(config, {
          address: vault,
          abi: YIELD_VAULT_ABI,
          functionName: "withdraw",
          args: [],
          chainId: targetChainId,
        });

        if (!hash) {
          setState({ step: "error", error: "Withdraw transaction failed or was rejected", errorAtStep: "withdrawing" });
          return;
        }

        console.log("[withdraw] waiting for tx receipt:", hash);
        setState({ step: "confirming", txHash: hash });

        const client = getPublicClient(config, { chainId: targetChainId });
        if (client) {
          await client.waitForTransactionReceipt({ hash });
        }

        console.log("[withdraw] complete!");
        setState({ step: "complete", txHash: hash });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setState((prev) => ({
          step: "error",
          error: message,
          errorAtStep: prev.step !== "error" ? prev.step : prev.errorAtStep,
        }));
      }
    },
    [config, readVaultBalance],
  );

  /** Direct withdrawal when USDC is already in vault. */
  const executeWithdraw = useCallback(
    async (targetChainId: number, vault: `0x${string}`) => {
      try {
        setState({ step: "withdrawing" });
        console.log("[withdraw] calling withdraw() on vault:", vault, "chain:", targetChainId);

        const hash = await writeContract(config, {
          address: vault,
          abi: YIELD_VAULT_ABI,
          functionName: "withdraw",
          args: [],
          chainId: targetChainId,
        });

        if (!hash) {
          setState({ step: "error", error: "Withdraw transaction failed or was rejected", errorAtStep: "withdrawing" });
          return;
        }

        console.log("[withdraw] waiting for tx receipt:", hash);
        setState({ step: "confirming", txHash: hash });

        const client = getPublicClient(config, { chainId: targetChainId });
        if (client) {
          await client.waitForTransactionReceipt({ hash });
        }

        console.log("[withdraw] complete!");
        setState({ step: "complete", txHash: hash });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setState((prev) => ({
          step: "error",
          error: message,
          errorAtStep: prev.step !== "error" ? prev.step : prev.errorAtStep,
        }));
      }
    },
    [config],
  );

  const reset = useCallback(() => {
    setState({ step: "idle" });
  }, []);

  return {
    state,
    preflight,
    executeWithdraw,
    unwindAndWithdraw,
    reset,
  };
}
