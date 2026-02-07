# ZeusFi - System Architecture

## Overview

A cross-chain yield farming agent that automatically moves user funds to the highest-yielding protocols.

- **Supported Chains:** Base, Arbitrum, Optimism
- **Supported Protocols:** Aave V3, Morpho, Euler
- **Token:** USDC only (MVP)

---

## System Components

```
User Wallet  →  Frontend (Web)  →  Backend (API + Agent)  →  Blockchain
                                          ↓
                                   - User's Vault (smart contract)
                                   - LI.FI (bridging/swapping)
                                   - Yield Protocols (Aave, etc)
                                   - ENS (user preferences)
```

---

## 1. Frontend

**Purpose:** User interface for managing vault and viewing yields

**Tech:** Vite, React, TailwindCSS, RainbowKit, wagmi

### Pages

| Page | Purpose |
|------|---------|
| `/` | Dashboard - show current position, APY, agent activity |
| `/vault` | Deposit, withdraw, emergency exit |
| `/settings` | Configure ENS preferences (risk, min APY, chains) |
| `/history` | View past rebalances |

### Key Features

- Connect wallet (MetaMask, WalletConnect, etc.)
- Display ENS name if user has one
- Show real-time yield opportunities
- Deposit/withdraw from vault
- Configure preferences (writes to ENS)

---

## 2. Backend

**Purpose:** API server + AI Agent that monitors and decides rebalancing

**Tech:** Python 3.12+, Django 5.2, Django REST Framework, Celery, PostgreSQL, Redis

### 2.1 API Server

Serves data to the frontend.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/yields` | GET | Get all yield opportunities |
| `/api/user/:address` | GET | Get user's vault info & position |
| `/api/user/:address/history` | GET | Get rebalance history |
| `/api/vault/deploy` | POST | Get TX data to deploy vault |
| `/api/quote` | POST | Get LI.FI quote for a move |

### 2.2 Services

#### Yield Monitor
- **Runs:** Every 30 minutes
- **Does:** Fetches APY data from DeFiLlama + protocols
- **Stores:** In Redis cache + PostgreSQL

#### ENS Service
- **Does:** Reads user preferences from ENS text records
- **Records:** `yield.minAPY`, `yield.maxRisk`, `yield.chains`
- **Caches:** 1 hour TTL in Redis

#### LI.FI Service
- **Does:** Gets quotes for cross-chain moves
- **Returns:** Best route + transaction calldata
- **API:** `https://li.quest/v1/quote`

### 2.3 Agent Engine + Vault Executor

The Agent Engine (deterministic algorithm) makes decisions. The VaultExecutor builds transactions. The Agent Wallet (EOA) executes on-chain.

#### Agent Engine (`apps/agent/engine.py`)

- **Runs:** Daily 6AM UTC (Celery beat task)
- **Location:** Backend service

**Core Functions:**
- `find_best_pool(pools, wallet)` - Filter by ENS prefs, return best yield pool
- `should_rebalance(positions, best_pool, wallet)` - Decide if rebalancing is profitable

**Agent DOES NOT:**
- Use AI/LLM APIs (purely deterministic)
- Sign transactions
- Hold funds
- Interact with contracts directly

> Agent only produces DECISIONS

#### Vault Executor (`apps/agent/executor.py`)

**Purpose:**
- Convert decisions into transactions
- Build calldata for LI.FI
- Call `executeStrategy()` on YieldVault via Agent Wallet

**Core Functions:**
- `deploy_to_protocol()` - Move idle USDC from vault to yield protocol
- `unwind_position()` - Move funds from protocol back to USDC in vault
- `rebalance()` - Move from protocol A to protocol B

> Vault Executor DOES NOT custody funds

#### Agent Wallet (EOA)

- **Type:** Externally Owned Account (EOA)

**Purpose:**
- Execute strategies (calls `Vault.executeStrategy`)
- Move funds between protocols
- Initiate bridges via LI.FI
- Deploy destination vaults on new chains

> Agent Wallet DOES NOT hold funds
> Agent Wallet only calls Vault functions
> Permission: Set in Factory, immutable per vault

### 2.4 Strategy Execution Flow

| Step | Action |
|------|--------|
| 1 | Agent engine decides best APY location (e.g., "Move to Aave on Arbitrum @ 6.2%") |
| 2 | VaultExecutor builds strategy transaction (gets LI.FI quote, prepares calldata) |
| 3 | Agent Wallet signs transaction |
| 4 | Agent calls `Vault.executeStrategy()` |
| 5 | Vault interacts with protocol via LI.FI |

**Result:** Funds remain inside vault custody

---

## 3. Smart Contracts

**Purpose:** Hold user funds securely, execute agent commands

**Tech:** Solidity, Foundry

**Chains:** Base, Arbitrum, Optimism (one Factory per chain)

### 3.1 VaultFactory (One Per Chain)

Deploys new vaults for users. Stores global configuration.

**Configuration (set at deployment):**
- `agentWallet` → EOA that executes strategies
- `treasury` → Receives 10% performance fee
- `usdcToken` → USDC address on this chain

**Functions:**
- `deployVault(owner)` → Creates a new YieldVault for the user
- `getVault(owner)` → Returns user's vault address (or zero if none)

> Factories are INDEPENDENT per chain.
> Vaults deployed dynamically per user per chain.

### 3.2 YieldVault (One Per User Per Chain)

Holds user's funds. Only user can withdraw. Only agent can execute strategies.

**Storage:**
- `owner` → User's wallet address
- `agentWallet` → EOA that can execute strategies
- `treasury` → Receives performance fee
- `usdcToken` → USDC token address
- `principal` → Amount user deposited (for fee calculation)

**Permissions:**
- **OWNER (user's wallet):** Can deposit, withdraw
- **AGENT WALLET (EOA):** Can executeStrategy (only via LI.FI Diamond)

**Functions:**

| Function | Description |
|----------|-------------|
| `deposit(amount)` | User sends USDC to vault, principal += amount |
| `withdraw(amount)` | Calculates profit, Treasury gets 10%, User gets rest, principal resets |
| `executeStrategy(lifiCalldata)` | Agent moves funds to yield protocol, can ONLY call LI.FI Diamond |

**Security:**
- Only owner can withdraw
- Only agent can execute strategy
- Agent can only call LI.FI Diamond (whitelisted)
- Agent cannot withdraw funds to itself
- User can always exit, even if agent disappears

> **IMPORTANT:** Vaults are NOT universal across chains! Each chain has independent vault deployments.

### 3.3 Cross-Chain Migration

When migrating chains (e.g., Base → Arbitrum):

1. Agent exits protocol (returns USDC to vault on current chain)
2. Agent withdraws USDC from current vault
3. Agent bridges USDC via LI.FI to destination chain
4. Destination chain Factory deploys NEW vault for user
5. Agent deposits funds into NEW vault
6. OLD vault becomes INACTIVE

> Vault addresses differ per chain. Backend tracks vault mapping across chains.

---

## 4. External Services

### 4.1 LI.FI (Composer)

**What:** Cross-chain bridge & DEX aggregator with protocol integrations

**LI.FI Diamond Address:** `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE`

**We use it for:**
- Getting best route for cross-chain moves
- Getting transaction calldata to execute swaps/bridges
- Depositing into yield protocols via Composer (Aave, Morpho, Euler supported)

**Composer Integration:**

Simple Quote API - use vault token (e.g., aUSDC) as toToken. LI.FI handles the deposit into the protocol automatically!

Example: USDC → Aave supply
- `toToken`: aUSDC address on destination chain
- LI.FI builds the route: swap → bridge → deposit to Aave

**Flow:**
1. Backend calls LI.FI `/quote` API with: fromChain, fromToken, fromAmount, toChain, toToken (vault token like aUSDC)
2. LI.FI returns: Best route, Transaction calldata, Estimated output & gas
3. Agent Wallet calls `Vault.executeStrategy(calldata)`
4. Vault approves LI.FI Diamond, executes the transaction
5. Funds arrive at destination protocol (e.g., Aave)

### 4.2 ENS

**What:** Ethereum Name Service (decentralized naming)

**We use it for:**
- Storing user preferences in text records
- Making preferences portable across apps

**Records we use:**
```
alice.eth
├── yield.strategy      = "balanced"
├── yield.minAPY        = "5"
├── yield.maxRisk       = "medium"
├── yield.chains        = "ethereum,arbitrum,base"
├── yield.protocols     = "aave,compound,yearn"
└── yield.autoRebalance = "true"
```

### 4.3 DeFiLlama

**What:** DeFi data aggregator

**We use it for:**
- Fetching yield/APY data across all protocols
- Getting TVL data (for risk assessment)

**API:** `https://yields.llama.fi/pools`

---

## 5. Database Schema

### Table: wallets

| Column | Type | Description |
|--------|------|-------------|
| wallet_address (PK) | string | User's wallet address |
| ens_name | string (nullable) | ENS name if available |
| created_at | datetime | When registered |

ENS preferences cached on wallet: `ens_min_apy`, `ens_max_risk`, `ens_chains`, `ens_protocols`

### Table: vaults

User can have multiple vaults (one per chain)

| Column | Type | Description |
|--------|------|-------------|
| wallet | FK | User's wallet |
| chain_id | int | Chain ID |
| vault_address | string | Vault contract address |
| active | bool | Is this vault active? |
| created | datetime | When deployed |

### Table: positions

Current state of user's funds

| Column | Type | Description |
|--------|------|-------------|
| vault | FK | Vault reference |
| chain | string | Chain name |
| protocol | string | Protocol name |
| token | string | Token symbol |
| amount | decimal | Amount deposited |
| apy | decimal | Current APY |

### Table: rebalance_history

| Column | Type | Description |
|--------|------|-------------|
| wallet | FK | User's wallet |
| from | string | Source (protocol/chain) |
| to | string | Destination (protocol/chain) |
| amount | decimal | Amount moved |
| timestamp | datetime | When it happened |

Additional fields: `tx_hash`, `status`, `agent_reasoning`

### Table: yield_pools

Refreshed every 30 min from DeFiLlama

| Column | Type | Description |
|--------|------|-------------|
| protocol | string | Protocol name |
| chain | string | Chain name |
| token | string | Token symbol |
| apy | decimal | Current APY |
| tvl | decimal | Total value locked |
| updated | datetime | Last refresh |

Additional fields: `pool_id`, `risk_score`, `apy_base`, `apy_reward`, `il_risk`, `stable_coin`

---

## 6. User Flows (Complete Journey)

### Step 1: Connect Wallet (Frontend Only)

User clicks "Connect Wallet" via MetaMask/RainbowKit. Frontend now has `wallet_address`.

> No backend call yet.

---

### Step 2: Authenticate (SIWE)

| Actor | Action |
|-------|--------|
| Frontend | `POST /auth/nonce/` with `{wallet_address}` |
| Backend | Generate nonce, store in DB |
| Backend | Return `{nonce, message}` |
| Frontend | User signs message with MetaMask |
| Frontend | `POST /auth/verify/` with `{wallet, message, signature, nonce}` |
| Backend | Verify signature, create/get Wallet, generate JWT |
| Backend | Return `{token, wallet}` |
| Frontend | Store JWT locally |

**Result:** User is authenticated. Wallet record exists in DB (but no vaults yet).

---

### Step 3: Create Vault (The Vault Problem)

User wants to deposit USDC. Where is the vault?

#### Option A: Frontend Creates Vault (Current Design)

| Actor | Action |
|-------|--------|
| Frontend | Call `VaultFactory.createVault()` on chain |
| Blockchain | Deploy YieldVault, return `vault_address` |
| Frontend | `POST /wallet/register-vault/` with `{chain_id, vault_address}` |
| Backend | **⚠️ TRUSTS the address without on-chain verification** |
| Backend | Return `{vault registered}` |

#### Option B: Backend Verifies Vault (Safer)

| Actor | Action |
|-------|--------|
| Frontend | `POST /wallet/register-vault/` with `{chain_id, vault_address}` |
| Backend | Query `VaultFactory.vaults(wallet_address)` on chain |
| Blockchain | Return actual vault address (or zero) |
| Backend | Verify submitted address matches factory record |
| Backend | Return `{vault registered}` ✅ or `{error: invalid}` ❌ |

---

### Step 4: Deposit USDC Into Vault

| Actor | Action |
|-------|--------|
| Frontend | Call `USDC.approve(vault, amount)` - User signs |
| Frontend | Call `vault.deposit(amount)` - User signs |
| Blockchain | Vault now holds user's USDC (not yet earning yield) |

> No backend call here - pure on-chain.

---

### Step 5: View Available Yields

| Actor | Action |
|-------|--------|
| Frontend | `GET /yields/?chain=base` |
| Backend | Return cached DeFiLlama data |
| Frontend | `GET /yields/?best=true` |
| Backend | Filter by user's ENS preferences, return best pools |

**User sees:** "Aave on Arbitrum has 6.2% APY vs your 4.5% on Base"

---

### Step 6: AI Agent Rebalances (Background/Automatic)

This happens automatically, not user-triggered:

| Actor | Action |
|-------|--------|
| AI Agent | Analyze yields & user preferences |
| AI Agent | Decision: Move funds Base Aave → Arbitrum Aave |
| AI Agent | `POST /positions/rebalance/` with route details |
| Backend | Get LI.FI quote |
| Backend | Sign transaction with Agent Wallet key |
| Backend | Submit TX to blockchain |
| Blockchain | Execute cross-chain move via LI.FI |
| Backend | Poll status, update RebalanceHistory |
| Backend | Return `{status: success, tx_hash}` |

---

### Step 7: View Positions & History

| Actor | Action |
|-------|--------|
| Frontend | `GET /positions/{address}/` |
| Backend | Read on-chain positions, return current state |
| Frontend | `GET /positions/{address}/history/` |
| Backend | Return rebalance history with APY improvements |

**User sees:** "Your funds were moved to Arbitrum for +1.7% APY"

---

### Endpoint Call Order Summary

| Step | Endpoint | Who Calls | When |
|------|----------|-----------|------|
| 1 | `POST /auth/nonce/` | Frontend | User connects wallet |
| 2 | `POST /auth/verify/` | Frontend | User signs SIWE |
| 3 | `POST /wallet/register-vault/` | Frontend | After on-chain vault deploy |
| 4 | `GET /yields/` | Frontend | User views opportunities |
| 5 | `GET /yields/?best=true` | Frontend | User wants recommendations |
| 6 | `POST /positions/rebalance/` | AI Agent | Auto, when better yield found |
| 7 | `GET /positions/{addr}/` | Frontend | User checks portfolio |
| 8 | `GET /positions/{addr}/history/` | Frontend | User views past moves |

---

## 7. Security Model

### What User Controls

| Action | Who | Notes |
|--------|-----|-------|
| Connect wallet | User | Via SIWE authentication |
| Create vault | User | Via Factory on any chain |
| Deposit USDC | User | User signs TX |
| Withdraw | User only | Can't be blocked, 10% fee on profits |
| Set preferences | User only | Via ENS text records |

### What Agent Wallet Can Do

| Action | Allowed | Notes |
|--------|---------|-------|
| Execute strategy | ✅ Yes | Calls `Vault.executeStrategy()` |
| Move to Aave/Morpho/Euler | ✅ Yes | Via LI.FI Diamond |
| Move cross-chain | ✅ Yes | Via LI.FI bridging |
| Deploy destination vault | ✅ Yes | Via Factory on new chain |
| Withdraw to agent | ❌ No | Blocked by contract |
| Send to random address | ❌ No | Only LI.FI Diamond calls |
| Touch other vaults | ❌ No | Each vault separate |

### What AI Agent Can Do

| Action | Allowed | Notes |
|--------|---------|-------|
| Monitor APY data | ✅ Yes | Reads DeFiLlama |
| Read ENS preferences | ✅ Yes | Via Ethereum RPC |
| Decide strategy | ✅ Yes | Produces decisions |
| Sign transactions | ❌ No | Only Agent Wallet does |
| Hold funds | ❌ No | Only Vault does |

### Vault Registration Security

**The Problem (Without Verification):**

A malicious user could:
1. Call `POST /wallet/register-vault/` with `{vault_address: "0xHACKER"}`
2. Backend says "OK, saved!" (trusts the address)
3. Later, Agent sends funds to "0xHACKER"

**The Solution (With Verification):**

Backend must verify vault ownership on-chain:
1. User submits `{vault_address: "0xCLAIMED"}`
2. Backend queries `VaultFactory.vaults(wallet_address)` on chain
3. Chain returns `"0xREAL"` (or zero address)
4. Backend checks: `0xCLAIMED == 0xREAL`?
5. If mismatch → `ERROR: "Invalid vault"` (Agent never sees fake vault)

> **Recommendation:** Always verify vault addresses on-chain before storing.

---

### Trust Model

**TRUST REQUIRED:**
- Agent Wallet must be trusted (executes strategies)
- AI decisions assumed honest
- Backend execution assumed correct

**TRUST NOT REQUIRED:**
- Backend custody (no funds there)
- Shared pool custody (isolated vaults)
- Centralized funds (each user has own vault)

**SECURITY GUARANTEES:**
- Funds held ONLY inside vaults
- Agent Wallet cannot withdraw to itself
- User is the ONLY address that can withdraw
- AI has NO blockchain permissions
- Backend has NO custody

### Performance Fee

```
Fee: 10% of PROFITS only
Treasury receives fee on withdraw

profit = balance - principal
fee = 10% of profit (if profit > 0)
user_receives = principal + 90% of profit

No fee on principal.
No fee on losses.
```

---

## 8. Tech Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Vite + React 18 | UI framework |
| Frontend | RainbowKit | Wallet connection |
| Frontend | wagmi + viem | Ethereum interactions |
| Frontend | TailwindCSS | Styling |
| Backend | Python 3.12 + Django 5.2 | API framework |
| Backend | Django REST Framework | REST API |
| Backend | Celery + Redis | Background tasks |
| Backend | PostgreSQL (AWS RDS) | Database |
| Backend | Redis | Caching + Celery broker |
| Backend | web3.py | Ethereum/ENS interactions |
| Backend | httpx | Async HTTP client |
| Agent | Deterministic engine | Decision logic (no AI/LLM) |
| Contracts | Solidity | Smart contracts |
| Contracts | Foundry | Testing & deployment |
| External | LI.FI API | Cross-chain execution |
| External | DeFiLlama API | Yield data |
| External | ENS | User preferences |
| Hosting | AWS EC2 | Backend server |
| Hosting | AWS RDS | PostgreSQL database |
| Hosting | Vercel | Frontend (Vite build) |

---

## 9. Deployment Architecture

### Production Setup

**Vercel (Frontend)**
- Static pages
- Client-side wallet calls

**AWS EC2 (Backend - Docker Compose)**
- Django API
- Celery worker
- Celery beat
- AI Agent
- Redis

**AWS RDS**
- PostgreSQL database

**Blockchain (3 Chains)**
- Base: Factory + Vaults
- Arbitrum: Factory + Vaults
- Optimism: Factory + Vaults

> Each chain has independent factory deployment.
> Vaults deployed dynamically per user per chain.

---

## 10. MVP Scope

### Phase 1: Core (Days 1-4)

- [ ] Frontend: Connect wallet, display yields
- [ ] Backend: Yield monitor service
- [ ] Backend: LI.FI integration
- [ ] Contract: YieldVault (single chain)

### Phase 2: Agent (Days 5-6)

- [ ] Backend: ENS service
- [ ] Backend: Agent decision engine
- [ ] Backend: Cron job for rebalancing
- [ ] Contract: VaultFactory

### Phase 3: Polish (Day 7)

- [ ] Frontend: Settings page (ENS write)
- [ ] Frontend: History page
- [ ] Testing & bug fixes
- [ ] Demo video
