import {
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { VAULT_FACTORY_ABI } from "@/lib/contracts";
import { VAULT_FACTORIES } from "@/lib/constants";
import api from "@/lib/api";
import { toast } from "sonner";
import { useCallback, useState } from "react";

export function useVaultFactory() {
  const { writeContractAsync } = useWriteContract();
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
      await api.post("/wallet/register-vault/", {
        chain_id: chainId,
        vault_address: vaultAddress,
      });
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
