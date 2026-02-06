import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Wallet } from "@/types/api";
import { useAuthStore } from "@/store/authStore";

export function useWalletData(address: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const updateWallet = useAuthStore((s) => s.updateWallet);

  return useQuery<Wallet>({
    queryKey: ["wallet", address],
    queryFn: async () => {
      const { data } = await api.get<Wallet>(`/wallet/${address}/`);
      updateWallet(data);
      return data;
    },
    enabled: !!address && isAuthenticated,
  });
}
