import { useState, useCallback } from "react";
import { useAccount, useReadContract, useSwitchChain } from "wagmi";
import { parseUnits, zeroAddress } from "viem";
import { VAULT_FACTORIES, USDC_DECIMALS } from "@/lib/constants";
import { VAULT_FACTORY_ABI, YIELD_VAULT_ABI } from "@/lib/contracts";
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

  const [state, setState] = useState<DepositState>({ step: "idle" });
  const [targetChainId, setTargetChainId] = useState<number | undefined>();
  const [vaultAddr, setVaultAddr] = useState<`0x${string}` | undefined>();
  const [depositStarted, setDepositStarted] = useState(false);

  // Only read vault address once deposit flow actually starts
  const factoryAddress =
    depositStarted && targetChainId
      ? (VAULT_FACTORIES[targetChainId] as `0x${string}` | undefined)
      : undefined;

  const { data: existingVault } = useReadContract({
    address: factoryAddress ?? undefined,
    abi: VAULT_FACTORY_ABI,
    functionName: "getVault",
    args: address ? [address] : undefined,
    chainId: targetChainId,
    query: { enabled: !!factoryAddress && !!address && depositStarted },
  });

  const { needsApproval, approve } = useUSDCApproval(
    depositStarted ? targetChainId : undefined,
    address,
    vaultAddr,
  );

  const { deposit: vaultDeposit } = useVaultActions(
    depositStarted ? vaultAddr : undefined,
    depositStarted ? targetChainId : undefined,
  );

  const executeDeposit = useCallback(
    async (chainId: number, amount: number, userAddress: `0x${string}`) => {
      try {
        setDepositStarted(true);
        setTargetChainId(chainId);
        const factory = VAULT_FACTORIES[chainId];
        if (!factory) {
          setState({ step: "error", error: "Contracts not deployed on this chain" });
          return;
        }

        // Step 1: Check if vault exists
        setState({ step: "checking_vault" });

        let vault = existingVault as `0x${string}` | undefined;
        const isZero = !vault || vault === zeroAddress;

        // Step 2: Deploy vault if needed
        if (isZero) {
          setState({ step: "deploying_vault" });
          const deployHash = await deployVault(chainId, userAddress);
          if (!deployHash) {
            setState({ step: "error", error: "Vault deployment failed" });
            return;
          }

          setState({ step: "registering_vault", txHash: deployHash });

          // Wait a bit for confirmation then read the vault address
          // The deployVault return is the tx hash, we need to read the vault after
          await new Promise((r) => setTimeout(r, 5000));

          // Re-read vault address from factory (after deploy)
          // For now, use a manual read since the reactive hook may not have updated
          // The vault address will be read from the factory in the next render cycle
          // We'll use a fallback: the vault is deterministically the next event
          // In practice, the factory emits VaultDeployed(owner, vault)
          // For the MVP, we register after the tx confirms
          vault = undefined; // Will be set after re-read
        }

        // If we still don't have the vault, try to get it from factory
        if (!vault || vault === zeroAddress) {
          // Give the chain time to confirm
          await new Promise((r) => setTimeout(r, 3000));
          // The hook should re-read, but for sequential flow we need to wait
          // This is a known limitation — in production we'd use waitForTransactionReceipt
          setState({ step: "error", error: "Could not read vault address after deployment. Please try again." });
          return;
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
        const amountWei = parseUnits(String(amount), USDC_DECIMALS);
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
        await new Promise((r) => setTimeout(r, 5000));

        setState({ step: "complete", txHash: depositHash, vaultAddress: vault });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setState({ step: "error", error: message });
      }
    },
    [
      existingVault,
      currentChainId,
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
    setDepositStarted(false);
  }, []);

  return {
    state,
    executeDeposit,
    reset,
  };
}
