import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { PositionSummary } from "@/types/api";
import { useAuthStore } from "@/store/authStore";

export function usePositions(address: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<PositionSummary>({
    queryKey: ["positions", address],
    queryFn: async () => {
      const { data } = await api.get<PositionSummary>(
        `/positions/${address}/`,
      );
      return data;
    },
    enabled: !!address && isAuthenticated,
  });
}
