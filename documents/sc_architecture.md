# Smart Contract Architecture - AI Cross-Chain Yield Optimizer (Final MVP)

This document defines **ONLY** the Smart Contract Architecture.
- No backend implementation
- No frontend implementation
- No contract code

This is the **core structure** that Claude / Backend / Frontend must follow.

---

## System Overview

The platform is an autonomous DeFi yield optimizer where:

- Users deposit USDC
- Each user has an isolated Vault
- An AI Agent runs off-chain
- The AI decides strategies
- An Agent Wallet executes transactions on-chain
- Funds move across chains using Li.Fi
- Platform charges 10% performance fee ONLY on profits

> **IMPORTANT:**
> - Backend does NOT custody funds
> - AI does NOT hold funds
> - Only Smart Contracts hold funds

---

## Core Principle

| Component | Role |
|-----------|------|
| Vaults | Hold funds |
| Agent | Executes actions |
| AI | Decides strategy |
| Factory | Deploys vaults |

---

## On-Chain Roles

### User

**Responsibilities:**
- Connect wallet
- Create vault
- Deposit USDC
- Withdraw funds

User owns their vault. User never interacts directly with protocols.

---

### Vault Factory

**Purpose:** Deploy one vault per user, store global configuration

**Responsibilities:**
- Define Agent Wallet
- Define Treasury Address
- Define USDC Token
- Deploy YieldVault contracts

**Deployment:** One Factory per chain

**Chains:**
- Base
- Arbitrum
- Optimism

> Factories are independent per chain.

---

### Yield Vault (Per User)

**Purpose:** Custody user funds, execute strategies, track principal, calculate performance fee

**Stores:**
- owner
- agent wallet
- treasury
- USDC token
- principal deposited

**Capabilities:**
- Accept deposits
- Allow withdrawals
- Allow agent execution
- Approve protocol interactions

> Vault is the ONLY contract holding funds.

---

### Agent Wallet

**Type:** Externally Owned Account (EOA)

**Purpose:**
- Execute strategies
- Move funds between protocols
- Initiate bridges
- Deploy destination vaults

> Agent Wallet DOES NOT hold funds.
> Agent Wallet only calls Vault functions.

**Permission:** Set in Factory, immutable per vault

---

### AI Agent (Off-Chain)

**Location:** Backend service

**Responsibilities:**
- Monitor APY
- Choose protocol
- Choose chain
- Decide migration timing

**AI DOES NOT:**
- Sign transactions
- Hold funds
- Interact with contracts directly

> AI only produces decisions.

---

### Execution Engine (Backend)

**Purpose:**
- Convert AI decisions into transactions
- Build calldata
- Send tx requests to Agent Wallet signer

> Execution Engine DOES NOT custody funds.

---

### Treasury

**Purpose:** Receive 10% performance fee

**Fee Rule:**
- Fee only on PROFITS
- No fee on principal
- No fee on losses

---

## Cross-Chain Architecture

Vaults are **NOT** universal across chains. Each chain has independent vault deployments.

**When migrating chains:**

1. Agent exits protocol
2. Funds return to current vault
3. Agent withdraws from vault
4. Agent bridges USDC via Li.Fi
5. Destination chain Factory deploys new vault
6. Agent deposits funds into new vault
7. Old vault becomes inactive

> Vault addresses differ per chain. Backend tracks vault mapping.

---

## Strategy Execution Flow

| Step | Action |
|------|--------|
| 1 | AI decides best APY location |
| 2 | Backend builds strategy transaction |
| 3 | Agent Wallet signs transaction |
| 4 | Agent calls Vault.executeStrategy() |
| 5 | Vault interacts with protocol |

**Result:** Funds remain inside vault custody.

---

## Deposit Flow

1. User connects wallet
2. User creates vault via Factory
3. Vault deployed
4. User deposits USDC into vault
5. Vault records principal

---

## Withdraw Flow

1. User requests withdraw
2. Agent exits protocol if needed
3. Vault calculates: `profit = balance - principal`
4. Treasury receives: **10% of profit**
5. User receives: **principal + 90% profit**
6. Vault principal resets

---

## Security Model

**Funds held ONLY inside vaults.**

| Role | Permissions |
|------|------------|
| Agent Wallet | Can execute strategies, CANNOT withdraw funds to itself |
| User | Only address allowed to withdraw |
| AI | No blockchain permissions |
| Backend | No custody |

---

## Minimum Contract Set

**Contracts Required:**
1. VaultFactory
2. YieldVault

- No upgrades
- No proxies
- No governance
- No multisig required for MVP

---

## Chain Deployment Model

Each chain must deploy:
- VaultFactory

Vaults are deployed dynamically per user per chain.

---

## Trust Model

**Trust Required:**
- Agent Wallet must be trusted
- AI decisions assumed honest
- Backend execution assumed correct

**Trust NOT Required:**
- Backend custody
- Shared pool custody
- Centralized funds

---

## Final Architecture Summary

| Aspect | Value |
|--------|-------|
| User Funds Location | Vault Contracts |
| Strategy Executor | Agent Wallet |
| Decision Maker | AI Agent (Backend) |
| Vault Deployment | VaultFactory per chain |
| Cross Chain Movement | Li.Fi |
| Performance Fee | 10% of profits only |
| Isolation Model | One Vault per User, One Chain per Active Vault |

---

**END OF SMART CONTRACT ARCHITECTURE**
