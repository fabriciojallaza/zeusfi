import {
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { YIELD_VAULT_ABI } from "@/lib/contracts";
import { parseUnits } from "viem";
import { USDC_DECIMALS } from "@/lib/constants";
import { useState } from "react";

export function useVaultActions(
  vaultAddress: `0x${string}` | undefined,
  chainId: number | undefined,
) {
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { data: vaultBalance } = useReadContract({
    address: vaultAddress,
    abi: YIELD_VAULT_ABI,
    functionName: "getBalance",
    chainId,
    query: { enabled: !!vaultAddress },
  });

  const { data: principal } = useReadContract({
    address: vaultAddress,
    abi: YIELD_VAULT_ABI,
    functionName: "principal",
    chainId,
    query: { enabled: !!vaultAddress },
  });

  const { writeContractAsync } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const deposit = async (amount: number) => {
    if (!vaultAddress || !chainId) return;
    const amountWei = parseUnits(String(amount), USDC_DECIMALS);
    const hash = await writeContractAsync({
      address: vaultAddress,
      abi: YIELD_VAULT_ABI,
      functionName: "deposit",
      args: [amountWei],
      chainId,
    });
    setTxHash(hash);
    return hash;
  };

  const withdraw = async (amount: number) => {
    if (!vaultAddress || !chainId) return;
    const amountWei = parseUnits(String(amount), USDC_DECIMALS);
    const hash = await writeContractAsync({
      address: vaultAddress,
      abi: YIELD_VAULT_ABI,
      functionName: "withdraw",
      args: [amountWei],
      chainId,
    });
    setTxHash(hash);
    return hash;
  };

  return {
    vaultBalance: vaultBalance as bigint | undefined,
    principal: principal as bigint | undefined,
    deposit,
    withdraw,
    isConfirming,
    isSuccess,
    txHash,
  };
}
