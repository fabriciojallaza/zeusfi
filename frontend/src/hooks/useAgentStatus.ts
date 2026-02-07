import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { AgentStatus } from "@/types/api";
import { useAuthStore } from "@/store/authStore";

export function useAgentStatus() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<AgentStatus>({
    queryKey: ["agent-status"],
    queryFn: async () => {
      const { data } = await api.get<AgentStatus>("/agent/status/");
      return data;
    },
    enabled: isAuthenticated,
    refetchInterval: 60_000, // poll every minute
  });
}
