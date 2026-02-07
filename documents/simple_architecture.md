# ZeusFi - Simple Architecture

## The Big Picture

```
User Wallet  ←→  Frontend  ←→  Backend  ←→  Blockchain
                  (Web)       (API+Agent)   (Vaults, Protocols)
```

**Supported Chains:** Base, Arbitrum, Optimism

---

## What Each Part Does

### Frontend (The Face)

**User can:**
- Connect wallet
- See yield opportunities
- Deposit money into vault
- Withdraw money from vault
- Set preferences (via ENS)
- View agent activity history

**Tech:** Vite + React + TailwindCSS + RainbowKit
**Hosted:** Vercel (free)

---

### Backend (The Brain)

Two components:

#### 1. Django API + Celery Tasks

| Task | Schedule | Purpose |
|------|----------|---------|
| Yield Monitor | Every 30 min | Fetches APY data from DeFiLlama |
| ENS Cache Warmer | Every 30 min | Reads user preferences from ENS text records |

**API:** Serves data to frontend (yields, positions, history, quotes)

#### 2. Agent (Deterministic - runs daily 6AM UTC)

For each user:
1. Where is their money now?
2. What do they want? (from ENS)
3. Where's the best yield?
4. Should we move? (if gain > cost)
5. **DECIDES** action (does NOT execute directly)

> Agent engine produces decisions → VaultExecutor builds TX → Agent Wallet (EOA) signs and executes on-chain

**Tech:** Python + Django + DRF + Celery + PostgreSQL
**Hosted:** AWS (EC2 + RDS)

---

### Blockchain (The Vault)

**Chains:** Base, Arbitrum, Optimism

#### Your Contracts (2 total per chain):

**VaultFactory (1 per chain)**
- Creates new vaults for users
- Stores global config: Agent Wallet, Treasury, USDC
- Factories are INDEPENDENT per chain

**YieldVault (1 per user PER CHAIN)**
- Stores: owner, agent wallet, treasury, USDC, principal
- User can: deposit, withdraw
- Agent can: executeStrategy (move to yield protocols)
- Agent CANNOT: steal money, withdraw to itself

> **IMPORTANT:** Vaults are NOT universal across chains! User can have multiple vaults (one per chain)

**Treasury**
- Receives 10% performance fee on PROFITS only

#### External Contracts (not yours):

| Contract | Address | Purpose |
|----------|---------|---------|
| LI.FI Diamond | `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE` | Handles swapping & bridging & protocol deposits |
| Yield Protocols | Aave V3, Morpho, Euler | Where money actually earns yield |
| ENS | Ethereum Mainnet | Stores user preferences (read via mainnet RPC) |

---

## How Money Flows

### Deposit

```
User's Wallet ($10,000 USDC)  →  User's Vault (Base)
                                  Vault records principal = $10,000
```

### Rebalance (same chain)

```
User's Vault (Base)  →  LI.FI Composer  →  Aave (Base)
     $10,000 USDC          Agent calls        $10,000 aUSDC (6.2%)
```

- Agent Wallet calls `Vault.executeStrategy()`
- Vault interacts with protocol via LI.FI
- **Agent NEVER holds the money!**

### Cross-Chain Migration

When migrating chains (e.g., Base → Arbitrum):

1. Agent exits protocol (Aave Base → Vault Base)
2. Agent withdraws from vault (returns USDC to vault)
3. Agent bridges USDC via LI.FI
4. Factory on Arbitrum deploys NEW vault for user
5. Agent deposits funds into NEW vault on Arbitrum
6. OLD vault (Base) becomes INACTIVE

> User can have multiple vaults. Backend tracks vault mapping.

### Withdraw (with performance fee)

Example: User deposited $10,000, now has $10,500 (gained $500)

| Calculation | Value |
|-------------|-------|
| Profit | Balance - Principal = $10,500 - $10,000 = **$500** |
| Treasury receives | 10% of $500 = **$50** |
| User receives | $10,000 + 90% of $500 = **$10,450** |
| Vault principal | Resets to 0 |

> User can ALWAYS withdraw. Agent cannot block this.
> Fee is ONLY on profits, never on principal or losses.

---

## External APIs We Use

### LI.FI API (li.quest)

- **We send:** "Move $10k USDC from Ethereum to Arbitrum"
- **They return:** Transaction data to execute it
- **Why:** We don't build bridges. LI.FI aggregates 18+ bridges and finds the best route.

### DeFiLlama API (yields.llama.fi)

- **We ask:** "What are all the USDC yields?"
- **They return:** List of protocols, chains, APYs
- **Why:** We don't scrape 100 protocols. DeFiLlama already aggregates this data.

### ENS (via Ethereum RPC)

- **We read:** `alice.eth` → `yield.minAPY` = `"5"`
- **User writes:** Sets their preferences in ENS app
- **Why:** Decentralized config. Portable across apps.

---

## Security Summary

### Who Can Do What

#### User (owner of vault)
- ✅ Create vault via Factory
- ✅ Deposit USDC
- ✅ Withdraw funds (anytime, with 10% fee on profits)
- ✅ Set preferences via ENS

#### Agent Wallet (EOA controlled by backend)
- ✅ Execute strategies (move to Aave, Morpho, Euler)
- ✅ Move funds cross-chain via LI.FI
- ✅ Deploy destination vaults on new chains
- ❌ CANNOT withdraw funds to itself
- ❌ CANNOT send to random addresses
- ❌ CANNOT touch other users' vaults
- ❌ CANNOT block user withdrawals

#### Agent Engine (off-chain, deterministic)
- ✅ Produces decisions (which protocol, which chain)
- ❌ Does NOT sign transactions
- ❌ Does NOT hold funds
- ❌ Does NOT interact with contracts directly

### Trust Model

**TRUSTED:**
- Agent Wallet must be trusted (executes strategies)
- AI decisions assumed honest
- Backend execution assumed correct

**NOT TRUSTED (custody not required):**
- Backend custody (no funds there)
- Database (no private keys, just public data)

---

## Tech Stack (Simple)

| What | Tech | Why |
|------|------|-----|
| Frontend | Vite + React | Fast, good for web3 |
| Wallet | RainbowKit | Best wallet connection UX |
| Backend | Python + Django + DRF | Robust API framework |
| Agent | Deterministic engine | Decision logic (no AI/LLM) |
| Tasks | Celery + Redis | Background job processing |
| Database | PostgreSQL (AWS RDS) | Reliable, scalable |
| Cache | Redis | Fast yield data access |
| Contracts | Solidity | Standard for EVM |
| Testing | Foundry | Fast contract tests |
| Hosting | AWS (EC2 + RDS) | Production-ready infra |

---

## What We Build vs What We Use

### We Build:
- Frontend UI
- Backend API
- AI Agent logic
- Execution Engine
- VaultFactory
- YieldVault

### We Use (already exists):
- LI.FI (bridging)
- DeFiLlama (data)
- ENS (preferences)
- Aave V3 (yield)
- Morpho (yield)
- Euler (yield)

> **We're building the GLUE that connects existing pieces!**
