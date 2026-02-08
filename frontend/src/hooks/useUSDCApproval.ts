import { useReadContract, useWriteContract } from "wagmi";
import { ERC20_ABI } from "@/lib/contracts";
import { CHAIN_CONFIG } from "@/lib/chains";
import { parseUnits } from "viem";
import { USDC_DECIMALS } from "@/lib/constants";

export function useUSDCApproval(
  chainId: number | undefined,
  owner: `0x${string}` | undefined,
  spender: `0x${string}` | undefined,
) {
  const usdcAddress = chainId
    ? (CHAIN_CONFIG[chainId]?.usdc as `0x${string}`)
    : undefined;

  const { data: balance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    chainId,
    query: { enabled: !!usdcAddress && !!owner },
  });

  const { data: allowance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    chainId,
    query: { enabled: !!usdcAddress && !!owner && !!spender },
  });

  const { writeContractAsync } = useWriteContract();

  const needsApproval = (amount: number): boolean => {
    if (!allowance) return true;
    const amountWei = parseUnits(String(amount), USDC_DECIMALS);
    return (allowance as bigint) < amountWei;
  };

  const approve = async (
    amount: number,
    overrideChainId?: number,
    overrideSpender?: `0x${string}`,
  ) => {
    const cid = overrideChainId ?? chainId;
    const sp = overrideSpender ?? spender;
    const usdc = cid ? (CHAIN_CONFIG[cid]?.usdc as `0x${string}`) : usdcAddress;
    if (!usdc || !sp || !cid) {
      console.warn("[useUSDCApproval] approve skipped — missing params", { usdc, sp, cid });
      return;
    }
    console.log("[useUSDCApproval] approving", { amount, usdc, spender: sp, chainId: cid });
    const amountWei = parseUnits(String(amount), USDC_DECIMALS);
    return writeContractAsync({
      address: usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [sp, amountWei],
      chainId: cid,
    });
  };

  return {
    balance: balance as bigint | undefined,
    allowance: allowance as bigint | undefined,
    needsApproval,
    approve,
  };
}
