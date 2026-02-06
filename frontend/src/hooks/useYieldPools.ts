import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { YieldPool } from "@/types/api";
import { useAuthStore } from "@/store/authStore";

interface UseYieldPoolsOptions {
  chain?: string;
  best?: boolean;
  project?: string;
  symbol?: string;
}

export function useYieldPools(options: UseYieldPoolsOptions = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<YieldPool[]>({
    queryKey: ["yieldPools", options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.chain) params.set("chain", options.chain);
      if (options.best) params.set("best", "true");
      if (options.project) params.set("project", options.project);
      if (options.symbol) params.set("symbol", options.symbol);

      const { data } = await api.get(`/yields/?${params.toString()}`);
      // Backend returns { results: [...] } for paginated or direct array
      return Array.isArray(data) ? data : data.results ?? data.pools ?? [];
    },
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });
}
