import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { RebalanceHistory } from "@/types/api";
import { useAuthStore } from "@/store/authStore";

interface UseRebalanceHistoryOptions {
  status?: string;
  chain_id?: number;
  limit?: number;
  offset?: number;
}

export function useRebalanceHistory(
  address: string | undefined,
  options: UseRebalanceHistoryOptions = {},
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<RebalanceHistory[]>({
    queryKey: ["rebalanceHistory", address, options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.status) params.set("status", options.status);
      if (options.chain_id) params.set("chain_id", String(options.chain_id));
      if (options.limit) params.set("limit", String(options.limit));
      if (options.offset) params.set("offset", String(options.offset));

      const { data } = await api.get(
        `/positions/${address}/history/?${params.toString()}`,
      );
      return Array.isArray(data) ? data : data.history ?? data.results ?? [];
    },
    enabled: !!address && isAuthenticated,
  });
}
