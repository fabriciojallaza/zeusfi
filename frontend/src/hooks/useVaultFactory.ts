import {
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { VAULT_FACTORY_ABI } from "@/lib/contracts";
import { VAULT_FACTORIES } from "@/lib/constants";
import api from "@/lib/api";
import { toast } from "sonner";
import { useCallback, useState } from "react";

export function useVaultFactory() {
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const deployVault = useCallback(
    async (chainId: number, ownerAddress: `0x${string}`) => {
      const factoryAddress = VAULT_FACTORIES[chainId];
      if (!factoryAddress) {
        toast.error(
          "Contracts not deployed yet on this chain. Coming soon!",
        );
        return null;
      }

      const hash = await writeContractAsync({
        address: factoryAddress,
        abi: VAULT_FACTORY_ABI,
        functionName: "deployVault",
        args: [ownerAddress],
        chainId,
      });

      setTxHash(hash);

      // Register with backend after confirmation
      // The caller should wait for isSuccess and then call registerVault
      return hash;
    },
    [writeContractAsync],
  );

  const registerVault = useCallback(
    async (chainId: number, vaultAddress: string) => {
      // Retry up to 3 times with backoff — backend may be slow
      // (runs agent cycle synchronously on register)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await api.post(
            "/wallet/register-vault/",
            { chain_id: chainId, vault_address: vaultAddress },
            { timeout: 30_000 },
          );
          // Refresh wallet data so vaults list is up-to-date
          queryClient.invalidateQueries({ queryKey: ["wallet"] });
          return;
        } catch (err) {
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          } else {
            throw err;
          }
        }
      }
    },
    [],
  );

  return {
    deployVault,
    registerVault,
    isConfirming,
    isSuccess,
    txHash,
  };
}
