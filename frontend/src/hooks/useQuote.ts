import { useMutation } from "@tanstack/react-query";
import api from "@/lib/api";
import type { QuoteResponse } from "@/types/api";

interface QuoteRequest {
  from_chain: number;
  from_token: string;
  from_amount: string;
  to_chain: number;
  to_token: string;
  vault_address: string;
  slippage?: number;
}

export function useQuote() {
  return useMutation<QuoteResponse, Error, QuoteRequest>({
    mutationFn: async (request) => {
      const { data } = await api.post<QuoteResponse>(
        "/positions/quote/",
        request,
      );
      return data;
    },
  });
}
