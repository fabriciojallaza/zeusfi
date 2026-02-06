// Matches backend VaultSerializer
export interface Vault {
  id: number;
  chain_id: number;
  chain_name: string;
  vault_address: string;
  is_active: boolean;
  created_at: string;
}

// Matches backend WalletSerializer
export interface Wallet {
  address: string;
  ens_name: string | null;
  created_at: string;
  ens_min_apy: string | null;
  ens_max_risk: string | null;
  ens_chains: string[];
  ens_protocols: string[];
  ens_auto_rebalance: boolean;
  ens_updated_at: string | null;
  vaults: Vault[];
}

// Matches backend YieldPoolSerializer
export interface YieldPool {
  pool_id: string;
  chain: string;
  chain_id: number;
  chain_name: string;
  project: string;
  symbol: string;
  tvl_usd: number;
  apy: number;
  apy_base: number;
  apy_reward: number | null;
  risk_score: number;
  risk_level: string;
  stable_coin: boolean;
  il_risk: string | null;
  pool_meta: string | null;
  updated_at: string;
}

// Matches backend PositionSerializer
export interface Position {
  id: number;
  vault_address: string;
  chain_id: number;
  chain_name: string;
  protocol: string;
  token: string;
  amount: string;
  amount_usd: string;
  current_apy: string;
  updated_at: string;
}

// Matches backend PositionSummarySerializer
export interface PositionSummary {
  total_value_usd: string;
  average_apy: string;
  positions: Position[];
  by_chain: Record<string, unknown>;
  by_protocol: Record<string, unknown>;
}

// Matches backend RebalanceHistorySerializer
export interface RebalanceHistory {
  id: number;
  from_chain_id: number;
  from_chain_name: string;
  from_protocol: string;
  from_token: string;
  to_chain_id: number;
  to_chain_name: string;
  to_protocol: string;
  to_token: string;
  amount: string;
  amount_usd: string;
  tx_hash: string | null;
  status: string;
  from_apy: string | null;
  to_apy: string | null;
  apy_improvement: string | null;
  agent_reasoning: string;
  is_cross_chain: boolean;
  created_at: string;
  completed_at: string | null;
}

// Matches backend NonceResponseSerializer
export interface NonceResponse {
  nonce: string;
  message: string;
  expires_at: string;
}

// Matches backend VerifyResponseSerializer
export interface VerifyResponse {
  token: string;
  wallet: Wallet;
}

// Matches backend TransactionRequestSerializer
export interface TransactionRequest {
  to: string;
  data: string;
  value: string;
  gas_limit: string | null;
  chain_id: number | null;
}

// Matches backend QuoteResponseSerializer
export interface QuoteResponse {
  quote_id: string;
  type: string;
  tool: string;
  is_cross_chain: boolean;
  from_chain: number;
  from_token: string;
  from_amount: string;
  to_chain: number;
  to_token: string;
  to_amount: string;
  to_amount_min: string;
  gas_cost_usd: string;
  execution_duration: number | null;
  transaction_request: TransactionRequest | null;
}
