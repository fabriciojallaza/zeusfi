import { useState, useCallback } from "react";
import { useAccount, useConfig } from "wagmi";
import { getPublicClient, writeContract, switchChain } from "wagmi/actions";
import { zeroAddress, formatUnits } from "viem";
import { VAULT_FACTORIES, USDC_DECIMALS } from "@/lib/constants";
import { VAULT_FACTORY_ABI, YIELD_VAULT_ABI } from "@/lib/contracts";
import api from "@/lib/api"; // Used by unwindAndWithdraw

export type WithdrawStep =
  | "idle"
  | "resolving_vault"
  | "reading_balance"
  | "switching_chain"
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
  const { chainId: currentChainId } = useAccount();

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

  /** Resolve protocol positions: use passed data, fall back to API.
   *  Returns null if positions couldn't be determined (distinct from empty). */
  const resolvePositions = useCallback(
    async (
      userAddress: string,
      passedPositions?: ProtocolPosition[],
    ): Promise<{ protocolPositions: ProtocolPosition[]; protocolValue: number } | null> => {
      // 1. Try passed positions first (from usePositions in DashboardPage)
      const fromPassed = (passedPositions ?? []).filter(
        (p) => p.protocol !== "wallet",
      );
      if (fromPassed.length > 0) {
        const value = fromPassed.reduce(
          (sum, p) => sum + parseFloat(p.amount_usd || "0"),
          0,
        );
        console.log("[withdraw] using passed positions:", fromPassed.length, "value:", value);
        return { protocolPositions: fromPassed, protocolValue: value };
      }

      // 2. Fallback: fetch from API (in case passed positions were empty/stale)
      //    Use 45s timeout — backend reads multiple chains via RPC which can be slow
      console.log("[withdraw] no passed positions, fetching from API...");
      try {
        const res = await api.get(`/positions/${userAddress}/`, { timeout: 45_000 });
        const allPositions: ProtocolPosition[] = res.data?.positions || [];
        const fromApi = allPositions.filter((p) => p.protocol !== "wallet");
        const value = fromApi.reduce(
          (sum, p) => sum + parseFloat(p.amount_usd || "0"),
          0,
        );
        console.log("[withdraw] API positions:", fromApi.length, "value:", value);
        return { protocolPositions: fromApi, protocolValue: value };
      } catch (err) {
        console.error("[withdraw] positions API failed:", err);
        // Return null to signal that we couldn't check — distinct from "no positions"
        return null;
      }
    },
    [],
  );

  /** Pre-check: resolve vault, read balance, AND check protocol positions.
   *  Pass `positions` from usePositions() to avoid a duplicate API call. */
  const preflight = useCallback(
    async (
      targetChainId: number,
      userAddress: `0x${string}`,
      positions?: ProtocolPosition[],
    ) => {
      try {
        setState({ step: "resolving_vault" });
        console.log("[withdraw] preflight start — chain:", targetChainId, "passedPositions:", positions?.length ?? 0);

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

        // Read vault USDC balance and resolve positions in parallel
        const [balance, posData] = await Promise.all([
          readVaultBalance(targetChainId, vault),
          resolvePositions(userAddress, positions),
        ]);

        const balanceNum = parseFloat(formatUnits(balance, USDC_DECIMALS));

        // If positions couldn't be determined AND vault is empty, show error
        if (!posData && balanceNum < 0.01) {
          console.warn("[withdraw] positions unknown and vault empty — can't proceed");
          setState({
            step: "error",
            error: "Could not check protocol positions (API timed out). Please close and try again.",
            errorAtStep: "reading_balance",
          });
          return null;
        }

        const protocolPositions = posData?.protocolPositions ?? [];
        const protocolValue = posData?.protocolValue ?? 0;

        console.log("[withdraw] vault USDC balance:", balanceNum, "protocolValue:", protocolValue, "needsUnwind:", protocolPositions.length > 0 && protocolValue > 0.01);

        // needsUnwind = true if there are funds deployed in protocols
        const needsUnwind = protocolPositions.length > 0 && protocolValue > 0.01;

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
        console.error("[withdraw] preflight error:", message);
        setState((prev) => ({
          step: "error",
          error: message,
          errorAtStep: prev.step !== "error" ? prev.step : prev.errorAtStep,
        }));
        return null;
      }
    },
    [readVaultAddress, readVaultBalance, resolvePositions],
  );

  /** Switch chain if needed, returns true if on correct chain. */
  const ensureChain = useCallback(
    async (targetChainId: number): Promise<boolean> => {
      if (currentChainId === targetChainId) return true;
      try {
        setState((prev) => ({ ...prev, step: "switching_chain" }));
        console.log("[withdraw] switching chain to", targetChainId);
        await switchChain(config, { chainId: targetChainId });
        return true;
      } catch (err) {
        console.error("[withdraw] chain switch failed:", err);
        setState({
          step: "error",
          error: "Failed to switch chain. Please switch manually in your wallet.",
          errorAtStep: "switching_chain",
        });
        return false;
      }
    },
    [config, currentChainId],
  );

  /** Unwind protocol positions via agent, then poll vault until USDC arrives. */
  const unwindAndWithdraw = useCallback(
    async (targetChainId: number, vault: `0x${string}`) => {
      try {
        // Step 1: Call agent unwind
        setState({ step: "unwinding" });
        console.log("[withdraw] requesting agent unwind...");

        let data;
        try {
          const res = await api.post("/agent/unwind/", {}, { timeout: 120_000 });
          data = res.data;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          const isTimeout = msg.includes("timeout") || msg.includes("ECONNABORTED");
          setState({
            step: "error",
            error: isTimeout
              ? "Unwind request timed out. The agent may still be processing — check back in a minute."
              : `Unwind request failed: ${msg}`,
            errorAtStep: "unwinding",
          });
          return;
        }

        if (data.status === "failed") {
          setState({
            step: "error",
            error: `Unwind failed: ${data.errors?.join(", ") || "Unknown error"}`,
            errorAtStep: "unwinding",
          });
          return;
        }

        if (data.status === "no_funds") {
          setState({
            step: "error",
            error: "No funds found in vault or protocols.",
            errorAtStep: "unwinding",
          });
          return;
        }

        if (data.status === "already_idle") {
          // Backend says USDC is already in vault — verify on-chain before proceeding
          console.log("[withdraw] backend says already_idle, verifying vault balance...");
          const balance = await readVaultBalance(targetChainId, vault);
          if (balance === 0n) {
            setState({
              step: "error",
              error: "No USDC found in vault. Funds may be on a different chain or still processing.",
              errorAtStep: "unwinding",
            });
            return;
          }
          console.log("[withdraw] confirmed vault has USDC, proceeding to withdraw");
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
              error: "Timed out waiting for USDC to return to vault. The unwind may still be processing on-chain.",
              errorAtStep: "polling_balance",
            });
            return;
          }
        }

        // Step 3: Switch chain if needed
        if (!(await ensureChain(targetChainId))) return;

        // Step 4: Withdraw from vault to user wallet
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
          const receipt = await client.waitForTransactionReceipt({ hash });
          if (receipt.status === "reverted") {
            setState({
              step: "error",
              error: "Withdraw transaction reverted on-chain. The vault may be empty.",
              errorAtStep: "withdrawing",
              txHash: hash,
            });
            return;
          }
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
    [config, readVaultBalance, ensureChain],
  );

  /** Direct withdrawal when USDC is already in vault. */
  const executeWithdraw = useCallback(
    async (targetChainId: number, vault: `0x${string}`) => {
      try {
        // Switch chain if needed
        if (!(await ensureChain(targetChainId))) return;

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
          const receipt = await client.waitForTransactionReceipt({ hash });
          if (receipt.status === "reverted") {
            setState({
              step: "error",
              error: "Withdraw transaction reverted on-chain. The vault may be empty.",
              errorAtStep: "withdrawing",
              txHash: hash,
            });
            return;
          }
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
    [config, ensureChain],
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
