import { useState, useCallback } from "react";
import { useAccount, useSwitchChain, usePublicClient, useConfig } from "wagmi";
import { parseUnits, zeroAddress } from "viem";
import { getPublicClient } from "wagmi/actions";
import { VAULT_FACTORIES, USDC_DECIMALS } from "@/lib/constants";
import { VAULT_FACTORY_ABI } from "@/lib/contracts";
import { useVaultFactory } from "./useVaultFactory";
import { useUSDCApproval } from "./useUSDCApproval";
import { useVaultActions } from "./useVaultActions";

export type DepositStep =
  | "idle"
  | "checking_vault"
  | "deploying_vault"
  | "registering_vault"
  | "switching_chain"
  | "approving_usdc"
  | "depositing"
  | "confirming"
  | "complete"
  | "error";

export interface DepositState {
  step: DepositStep;
  txHash?: string;
  vaultAddress?: `0x${string}`;
  error?: string;
}

export function useDepositFlow() {
  const { address, chainId: currentChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { deployVault, registerVault } = useVaultFactory();
  const config = useConfig();

  const [state, setState] = useState<DepositState>({ step: "idle" });
  const [targetChainId, setTargetChainId] = useState<number | undefined>();
  const [vaultAddr, setVaultAddr] = useState<`0x${string}` | undefined>();

  const { needsApproval, approve } = useUSDCApproval(
    targetChainId,
    address,
    vaultAddr,
  );

  const { deposit: vaultDeposit } = useVaultActions(vaultAddr, targetChainId);

  const readVaultAddress = useCallback(
    async (chainId: number, userAddress: `0x${string}`): Promise<`0x${string}` | null> => {
      const factory = VAULT_FACTORIES[chainId] as `0x${string}` | undefined;
      if (!factory) return null;

      const client = getPublicClient(config, { chainId });
      if (!client) return null;

      const vault = await client.readContract({
        address: factory,
        abi: VAULT_FACTORY_ABI,
        functionName: "getVault",
        args: [userAddress],
      });

      const result = vault as `0x${string}`;
      if (!result || result === zeroAddress) return null;
      return result;
    },
    [config],
  );

  const executeDeposit = useCallback(
    async (chainId: number, amount: number, userAddress: `0x${string}`) => {
      try {
        setTargetChainId(chainId);
        const factory = VAULT_FACTORIES[chainId];
        if (!factory) {
          setState({ step: "error", error: "Contracts not deployed on this chain" });
          return;
        }

        // Step 1: Check if vault already exists on-chain
        setState({ step: "checking_vault" });
        let vault = await readVaultAddress(chainId, userAddress);

        // Step 2: Deploy vault if needed
        if (!vault) {
          setState({ step: "deploying_vault" });
          const deployHash = await deployVault(chainId, userAddress);
          if (!deployHash) {
            setState({ step: "error", error: "Vault deployment failed" });
            return;
          }

          // Wait for tx confirmation
          setState({ step: "registering_vault", txHash: deployHash });
          const client = getPublicClient(config, { chainId });
          if (client) {
            await client.waitForTransactionReceipt({ hash: deployHash });
          }

          // Read the vault address from factory after confirmation
          vault = await readVaultAddress(chainId, userAddress);
          if (!vault) {
            setState({ step: "error", error: "Vault deployed but could not read address. Please try again." });
            return;
          }
        }

        setVaultAddr(vault);

        // Register vault with backend
        try {
          await registerVault(chainId, vault);
        } catch {
          // Non-fatal: vault already registered or backend down
        }

        // Step 3: Switch chain if needed
        if (currentChainId !== chainId) {
          setState({ step: "switching_chain", vaultAddress: vault });
          await switchChainAsync({ chainId });
        }

        // Step 4: Approve USDC if needed
        if (needsApproval(amount)) {
          setState({ step: "approving_usdc", vaultAddress: vault });
          await approve(amount);
          // Wait for approval confirmation
          await new Promise((r) => setTimeout(r, 3000));
        }

        // Step 5: Deposit USDC into vault
        setState({ step: "depositing", vaultAddress: vault });
        const depositHash = await vaultDeposit(amount);
        if (!depositHash) {
          setState({ step: "error", error: "Deposit transaction failed" });
          return;
        }

        // Step 6: Confirm
        setState({ step: "confirming", txHash: depositHash, vaultAddress: vault });
        const client = getPublicClient(config, { chainId });
        if (client) {
          await client.waitForTransactionReceipt({ hash: depositHash });
        }

        setState({ step: "complete", txHash: depositHash, vaultAddress: vault });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setState({ step: "error", error: message });
      }
    },
    [
      config,
      currentChainId,
      readVaultAddress,
      deployVault,
      registerVault,
      switchChainAsync,
      needsApproval,
      approve,
      vaultDeposit,
    ],
  );

  const reset = useCallback(() => {
    setState({ step: "idle" });
    setTargetChainId(undefined);
    setVaultAddr(undefined);
  }, []);

  return {
    state,
    executeDeposit,
    reset,
  };
}
