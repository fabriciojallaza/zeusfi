# ZeusFi

Cross-chain yield farming agent. Deposits USDC into the best-performing DeFi pools across multiple chains, and automatically rebalances when better opportunities show up.

Built for Base, Arbitrum, and Optimism. Supports Aave V3, Morpho, and Euler V2.

---

## How it works

1. User connects their wallet and deposits USDC into a personal on-chain vault
2. The backend fetches live yield data from DeFiLlama every 30 minutes
3. An agent evaluates all eligible pools and picks the highest-yielding one
4. Funds are moved on-chain through per-user vault contracts, using LI.FI for cross-chain bridging and protocol deposits
5. The agent runs daily to check if rebalancing makes sense (factoring in gas costs, yield difference thresholds, etc.)
6. Users control their strategy through ENS text records -- minimum APY, risk tolerance, chain preferences, and whether auto-rebalancing is enabled

---

## Project structure

```
zeusfi/
├── backend/        Django API + Celery workers
├── frontend/       React app (Vite + Tailwind)
├── contracts/      Solidity smart contracts (Foundry)
└── documents/      Architecture notes and specs
```

### `backend/`

Django REST API that handles everything server-side: authentication, yield data syncing, position tracking, and the rebalancing agent.

```
backend/
├── apps/
│   ├── wallets/       Auth (SIWE), wallet and vault models
│   ├── yields/        Pool data, DeFiLlama sync task
│   ├── positions/     On-chain position tracking, rebalance history
│   └── agent/         Decision engine + executor for rebalances
├── integrations/
│   ├── defillama/     Yield pool data from DeFiLlama API
│   ├── ens/           User preference reads from ENS text records
│   ├── lifi/          Cross-chain quotes and route building
│   └── contracts/     Web3 calls for reading on-chain state
├── config/            Chain IDs, protocol addresses, contract addresses
├── tofu/              Infrastructure as code (OpenTofu)
├── scripts/           Utility scripts
└── core/              Django project settings, URL config, Celery setup
```

**Key tech:** Django 5, DRF, Celery + Redis, web3.py, httpx, Pydantic

**Auth flow:** SIWE (Sign-In with Ethereum) -- the wallet address is the user identity, no traditional username/password.

### `frontend/`

Single-page app for connecting a wallet, depositing funds, and monitoring active positions.

```
frontend/src/
├── app/
│   ├── App.tsx               Main app shell, view state management
│   └── components/
│       ├── header.tsx         Wallet connection (RainbowKit)
│       ├── deposit-card.tsx   Deposit flow
│       ├── active-dashboard.tsx  Position monitoring
│       ├── analysis-overlay.tsx  AI analysis modal
│       ├── lifi-execution.tsx    Transaction execution progress
│       ├── ens-config-panel.tsx  ENS preference editor
│       └── ui/                   Shadcn components
├── hooks/         Custom React hooks
├── store/         Zustand state management
├── types/         TypeScript type definitions
└── styles/        Tailwind CSS
```

**Key tech:** React 18, Vite, TailwindCSS 4, Shadcn/Radix UI, wagmi + viem, RainbowKit, Recharts, Zustand

The app has three main views: **deposit** (select token, enter amount) -> **processing** (analysis + on-chain execution) -> **active** (dashboard with live position data).

### `contracts/`

Foundry project with the on-chain components. One `VaultFactory` deployed per chain, which creates a personal `YieldVault` for each user.

```
contracts/
├── src/
│   ├── VaultFactory.sol    Deploys per-user vaults
│   ├── YieldVault.sol      Holds USDC, agent executes strategies via LI.FI
│   └── MockUSDC.sol        Testnet token for testing
├── script/
│   ├── DeployTestnet.s.sol
│   └── DeployMainnet.s.sol
├── test/
│   └── YieldVault.t.sol    29 tests covering deposits, withdrawals, access control
└── foundry.toml
```

**Solidity 0.8.24**, OpenZeppelin for access control and token safety. The vault is non-custodial -- only the designated agent wallet can execute strategies, and only the vault owner can withdraw.

### `documents/`

Internal architecture docs and spec notes. Not part of the running application.

---

## Running the project

Here's how to get the full stack running locally. You'll need three terminal windows for the backend (API, Celery worker, Celery beat) and one for the frontend.

### Prerequisites

| Tool | Version | What for |
|------|---------|----------|
| [Python](https://www.python.org/) | 3.12+ | Backend |
| [uv](https://github.com/astral-sh/uv) | latest | Python package manager |
| [Node.js](https://nodejs.org/) | 18+ | Frontend |
| [Docker](https://www.docker.com/) | latest | Redis (message broker) |
| [Foundry](https://book.getfoundry.sh/) | latest | Smart contract compilation and tests |

### 1. Environment setup

**Backend** -- copy the example env file and fill in your values:

```bash
cd backend
cp dev.env .env
```

The key variables you need to set:

| Variable | Required | Description |
|----------|----------|-------------|
| `ETHEREUM_RPC_URL` | Yes | Ethereum mainnet RPC for ENS reads (public RPCs work fine) |
| `LIFI_API_KEY` | Yes | API key from [LI.FI](https://li.fi/) for cross-chain routing |
| `JWT_SECRET_KEY` | Yes | Any random string for signing auth tokens |
| `AGENT_WALLET_ADDRESS` | Yes | EOA address that executes vault strategies |
| `AGENT_WALLET_PRIVATE_KEY` | Yes | Private key for the agent wallet (**use a test wallet only**) |
| `AGENT_DRY_RUN` | No | Set to `TRUE` to log decisions without executing on-chain (default: `FALSE`) |
| `USE_DEFAULT_DB` | No | Set to `FALSE` to use SQLite instead of Postgres (recommended for local dev) |
| `USE_REDIS_CACHE` | No | Set to `FALSE` to skip Redis cache and use local memory |

**Frontend** -- create a `.env` in the frontend directory:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

You can get a free WalletConnect project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com/).

**Contracts** -- if you want to deploy, create `.env` in the contracts directory:

```env
PRIVATE_KEY=your_deployer_private_key
BASESCAN_API_KEY=your_key
ARBISCAN_API_KEY=your_key
OPSCAN_API_KEY=your_key
```

### 2. Start the backend

```bash
cd backend

# Install dependencies
make setup

# Start Redis (needed for Celery task queue)
make docker-up

# Run database migrations
make migrate

# Start the API server (Terminal 1)
make serve
# -> running on http://localhost:8000
```

Open two more terminals:

```bash
# Terminal 2 -- background task worker
cd backend
make celery

# Terminal 3 -- scheduled task runner
cd backend
make celery-beat
```

The Celery beat scheduler kicks off these tasks automatically:

| Task | Schedule | What it does |
|------|----------|-------------|
| `fetch_yields` | Every 30 min | Syncs pool data from DeFiLlama |
| `warm_ens_cache` | Every 30 min | Reads ENS preferences for all wallets |
| `run_agent_cycle` | Daily 6 AM UTC | Evaluates and executes rebalances |
| `monitor_pending_txs` | Every 5 min | Tracks pending transaction status |

### 3. Start the frontend

```bash
cd frontend

npm install
npm run dev
# -> running on http://localhost:5173
```

### 4. Build and test the contracts

```bash
cd contracts

forge install       # pull OpenZeppelin + forge-std
forge build         # compile
forge test          # run all 29 tests
```

To deploy to testnets:

```bash
forge script script/DeployTestnet.s.sol --rpc-url base_sepolia --broadcast --verify
```

### 5. Verify everything works

Once all services are running:

- **Frontend:** [http://localhost:5173](http://localhost:5173) -- connect wallet, see the deposit flow
- **Backend API:** [http://localhost:8000/api/v1/](http://localhost:8000/api/v1/) -- JSON responses
- **Yield data:** Populated automatically once Celery beat runs `fetch_yields` (or trigger manually via `make shell` then `from apps.yields.tasks import fetch_yields; fetch_yields()`)

### Quick Docker alternative

If you'd rather run the entire backend in Docker:

```bash
cd backend
docker compose -f compose.yml -f compose.dev.yml up
```

This spins up the Django server, Redis, Celery worker, and Celery beat together. The frontend still runs separately with `npm run dev`.

---

## ENS integration

ENS isn't just used for resolving names here. It's the backbone of how users configure their yield strategy -- entirely on-chain, no centralized database involved.

### How users set preferences

Users store their strategy parameters as ENS text records on their name. The frontend has a dedicated config panel (`ens-config-panel.tsx`) that lets users write these records directly through their wallet:

| Text Record | Example Value | What it controls |
|-------------|---------------|-----------------|
| `yield.minAPY` | `5.0` | Minimum APY threshold -- pools below this are ignored |
| `yield.maxRisk` | `medium` | Risk tolerance: `low`, `medium`, or `high` |
| `yield.chains` | `base,arbitrum` | Which chains the agent is allowed to use |
| `yield.protocols` | `aave,morpho` | Which protocols are acceptable |
| `yield.autoRebalance` | `true` | Whether the agent can move funds between pools |

The frontend uses wagmi hooks (`useWriteContract`, `useReadContract`) to interact with the ENS Public Resolver contract. Users switch to Ethereum Mainnet, sign a transaction for each text record, and the preferences are written on-chain. No backend write path exists for these -- users own their data entirely through ENS.

### How the backend reads them

A Celery task (`warm_ens_cache`) runs every 30 minutes and syncs ENS text records into the database for fast access. It uses web3.py to call the ENS resolver on Ethereum mainnet, reads all five text records, and caches the parsed values on the Wallet model.

When the agent runs its daily cycle, it doesn't make any RPC calls to ENS. It reads directly from the cached preferences in the database:

1. **Filter by chain** -- only pools on chains the user has allowed
2. **Filter by protocol** -- only pools on protocols the user trusts
3. **Filter by minimum APY** -- skip anything below the threshold
4. **Filter by risk** -- map `low`/`medium`/`high` to a risk score ceiling
5. **Sort by APY** -- return the best remaining option

If a user doesn't have an ENS name or hasn't set any preferences, the agent falls back to sensible defaults (medium risk, all chains, all protocols).

### Why ENS instead of a regular database

The whole point is that your yield strategy lives on-chain. You set it once from any device, any frontend, any wallet that supports ENS text records -- and any agent or protocol can read it. It's not locked to our app. If another DeFi tool wants to respect the same `yield.*` records, they can. The user doesn't need to reconfigure anything.

It also means preferences survive regardless of what happens to our backend. Your ENS name is yours.

### What the frontend does

The ENS config panel at `/settings` provides a clean UI for managing these records:

- **Risk tolerance** -- three toggle buttons (conservative / balanced / aggressive)
- **Minimum APY** -- number input with percentage
- **Allowed chains** -- toggle buttons for Base, Arbitrum, Optimism
- Reads the current resolver to verify the user's ENS name is set up properly
- Prompts chain switch to Ethereum Mainnet if needed
- Writes each text record as a separate on-chain transaction
- Shows progress feedback ("Saving record 2 of 3...")

The wallet detail endpoint (`GET /api/v1/wallet/{address}/`) returns the cached ENS preferences alongside other wallet data, so the frontend can display what's currently set without needing to make its own RPC calls.

---

## LI.FI integration

LI.FI is how ZeusFi moves money. Every cross-chain bridge, every swap, every protocol deposit goes through LI.FI's routing layer. The integration uses the [LI.FI Composer](https://docs.li.fi/) pattern -- a single API call that chains together swap, bridge, and contract call steps into one atomic flow.

### What it enables

The core value prop: a user deposits USDC on Base, and the agent can seamlessly move those funds into an Aave pool on Arbitrum, a Morpho vault on Optimism, or an Euler market back on Base -- whatever has the best yield. LI.FI handles figuring out which bridge to use, which DEX to route through, and how to deposit into the target protocol. The agent just says "I want USDC on Base to become aUSDC on Arbitrum" and gets back a ready-to-sign transaction.

This works across at least two chains (Base, Arbitrum, Optimism) and covers both same-chain deposits and cross-chain moves.

### Backend: the LiFi client and executor

The backend integration lives in `backend/integrations/lifi/` and has two layers:

**LiFiClient** (`client.py`) -- async HTTP client that talks to the LI.FI API:

- `get_quote()` -- fetches the optimal route for a given token move (supports cross-chain). Returns full transaction calldata ready to execute.
- `get_status()` -- polls a transaction by hash until it completes on the destination chain. Handles PENDING, DONE, FAILED states.
- Extends `BaseAsyncClient` with tenacity retry logic and a 60-second timeout for bridge quotes (longer than usual because bridging routes can be complex).

**LiFiExecutor** (`executor.py`) -- high-level orchestrator that handles the full lifecycle:

1. **Get quote** -- call LI.FI for the optimal route
2. **Check and approve** -- ensure the vault has approved the LI.FI Diamond contract to spend USDC
3. **Execute** -- sign and submit the transaction with the agent wallet
4. **Wait for completion** -- poll LI.FI status until the destination chain confirms (up to 30 minutes for cross-chain)

### How a cross-chain rebalance works end-to-end

Say the agent decides USDC sitting in a vault on Base should move to Aave on Arbitrum because the APY is better. Here's the actual flow:

```
1. Agent calls LiFiClient.get_quote()
   from: USDC on Base (chain 8453)
   to:   aUSDC on Arbitrum (chain 42161)

2. LI.FI responds with:
   - Best bridge (Stargate, Across, etc.)
   - Encoded calldata for the full route
   - Gas cost estimate in USD
   - Estimated execution time

3. Agent checks: does the 30-day yield gain outweigh gas costs?
   Yes -> proceed. No -> skip.

4. VaultExecutor calls vault.executeStrategy(token, amount, lifiCalldata)
   - The YieldVault contract approves USDC to the LI.FI Diamond
   - Forwards the calldata to LI.FI
   - LI.FI atomically: swaps -> bridges -> deposits into Aave

5. Agent polls get_status() until Arbitrum confirms receipt of aUSDC

6. RebalanceHistory record saved with tx hash, APY improvement, reasoning
```

The LI.FI Composer pattern is what makes the "swap + bridge + deposit" happen in a single transaction from the vault's perspective. The vault doesn't need to know about bridges or DEXs -- it just calls the LI.FI Diamond with the calldata and gets deposit tokens back.

### Frontend: quote display and execution progress

On the frontend side:

- **Analysis overlay** (`analysis-overlay.tsx`) -- when a user initiates a deposit, the app fetches a real LI.FI quote and displays the routing details: which bridge/DEX will be used, estimated gas cost in USD, and expected execution time.

- **Execution progress** (`lifi-execution.tsx`) -- a step-by-step timeline showing the deposit flow in real time:
  1. Check vault status
  2. Deploy vault (if first deposit)
  3. Switch chain (if needed)
  4. Approve USDC
  5. Deposit into vault

- **Quote hook** (`useQuote`) -- React Query wrapper that calls `POST /api/v1/positions/quote/` to get a LI.FI quote before execution.

### API endpoints

| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/api/v1/positions/quote/` | POST | Get a LI.FI quote for a given token move (chain, token, amount, destination) |
| `/api/v1/positions/rebalance/` | POST | Execute a rebalance using the agent wallet via LI.FI |
| `/api/v1/positions/{address}/` | GET | Current positions enriched with APY data |
| `/api/v1/positions/{address}/history/` | GET | Full rebalance history with tx hashes and agent reasoning |

### Gas-aware decision making

The agent doesn't blindly chase the highest APY. Before every rebalance, it:

- Estimates gas cost in USD (higher for cross-chain moves)
- Calculates expected yield gain over 30 days
- Only executes if the yield gain meaningfully exceeds the gas cost
- Requires at least 1% APY improvement over the current position
- Respects the user's `yield.autoRebalance` ENS preference

This prevents the agent from burning money on gas for marginal yield improvements.

---

## Supported protocols

| Protocol | Base | Arbitrum | Optimism |
|----------|------|----------|----------|
| Aave V3  | Yes  | Yes      | Yes      |
| Morpho   | Yes  | --       | Yes      |
| Euler V2 | Yes  | Yes      | --       |

USDC only for now. Multi-asset support is on the roadmap.

---

## Architecture at a glance

```
                    ┌──────────────┐
                    │   Frontend   │
                    │  React/Vite  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   Backend    │
                    │  Django API  │
                    └──┬───┬───┬──┘
                       │   │   │
          ┌────────────┘   │   └────────────┐
          ▼                ▼                ▼
   ┌─────────────┐  ┌───────────┐   ┌─────────────┐
   │  DeFiLlama  │  │   ENS     │   │    LI.FI    │
   │  Yield Data │  │ User Prefs│   │  Bridging   │
   └─────────────┘  └───────────┘   └──────┬──────┘
                                           │
                                    ┌──────▼──────┐
                                    │   On-Chain   │
                                    │ VaultFactory │
                                    │  YieldVault  │
                                    └─────────────┘
```

The agent runs as a Celery task on a daily schedule. It pulls the latest yield data, compares it against current positions, and if the numbers justify a move (after gas costs), it builds a transaction through LI.FI and executes it on-chain through the user's vault. User preferences from ENS text records filter which pools the agent considers.

---

## API reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/auth/nonce/` | POST | No | Get SIWE nonce + message to sign |
| `/api/v1/auth/verify/` | POST | No | Submit signature, get JWT |
| `/api/v1/wallet/{address}/` | GET | JWT | Wallet info + vaults + ENS preferences |
| `/api/v1/wallet/register-vault/` | POST | JWT | Register a vault address |
| `/api/v1/yields/` | GET | JWT | List yield pools (`?chain=`, `?best=true`) |
| `/api/v1/yields/{pool_id}/` | GET | JWT | Pool details |
| `/api/v1/positions/{address}/` | GET | JWT | Current on-chain positions |
| `/api/v1/positions/{address}/history/` | GET | JWT | Rebalance history |
| `/api/v1/positions/quote/` | POST | JWT | Get a LI.FI quote |
| `/api/v1/positions/rebalance/` | POST | JWT | Execute a rebalance |
| `/agent/trigger/` | POST | JWT | Manually trigger agent cycle |
| `/agent/status/` | GET | JWT | Agent cycle status |

---

## License

Proprietary. All rights reserved.
