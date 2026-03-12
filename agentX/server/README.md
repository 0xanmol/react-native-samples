# Server — agentX

> Long-running AI agent server powering the agentX trading assistant. Exposes REST and WebSocket endpoints for the mobile client, orchestrates Claude tool calls, monitors SOL prices, and builds Jupiter swap transactions.

**Tech Stack:** Node.js 22, Fastify 4, Claude Sonnet 4.6, PostgreSQL, Jupiter API, Expo Push

**Note:** Android client only.

📖 **[View Communication & Architecture Deep Dive →](TECHNICAL-GUIDE.md)**

## Features

- AI agent powered by Claude Sonnet 4.6 with streaming tool calls
- Real-time WebSocket streaming (per-token output, tool call / result events)
- Autonomous price monitoring — polls CoinGecko every 60s, invokes agent when alerts trigger
- Jupiter v6 mainnet swap transaction building (SOL ↔ USDC)
- Expo push notifications (FCM relay) for background mobile wake
- PostgreSQL for session continuity, price alerts, and pending transaction state

---

## Quick Start

### Prerequisites

- Node.js 22+
- Docker (for Postgres)
- `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com)

### Installation

```bash
# 1. Start Postgres
docker run -d --name agentx-pg \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:16

# 2. Create the database (once)
psql postgres://postgres:postgres@localhost:5432/postgres -c "CREATE DATABASE agentx;"

# 3. Configure env (from repo root)
cp server/.env.example server/.env
# Edit server/.env — set ANTHROPIC_API_KEY at minimum

# 4. Install deps (from repo root — workspaces hoists to root node_modules/)
npm install
```

### Running

```bash
# Development (hot-reload via tsx watch)
npm run dev

# Production build
npm run build && node dist/index.js
```

Server starts at **http://localhost:8080**.

> **Note on `node_modules`:** npm workspaces hoists all packages to root `node_modules/`. There is no separate `server/node_modules`. This is expected.

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `8080` | HTTP port |
| `API_KEY` | Yes | `helloworld` | Secret for `X-Api-Key` header (all clients) |
| `ANTHROPIC_API_KEY` | Yes | — | Claude API key |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `NODE_ENV` | No | `development` | `production` disables pretty-print logs |
| `SOLANA_RPC_URL` | No | mainnet default | Solana RPC endpoint (for Jupiter) |
| `PRICE_MONITOR_INTERVAL_MS` | No | `30000` | How often to check alerts (ms) |
| `PRICE_FETCH_INTERVAL_MS` | No | `60000` | How often to fetch from CoinGecko (ms) |

---

## Project Structure

```
server/
├── src/
│   ├── index.ts                  # Entry point — env validation + startup sequence
│   ├── server.ts                 # Fastify setup + plugin registration
│   ├── agent/
│   │   ├── AgentRunner.ts        # Agent orchestration, serialized queue, streaming ⭐
│   │   └── tools/
│   │       └── solana.ts         # getSolanaPrice, createPriceAlert, queueSigningRequest, getPendingSigningRequests
│   ├── routes/
│   │   ├── agentRouter.ts        # POST /agent/prompt, GET /agent/history
│   │   ├── wsRouter.ts           # WebSocket /ws — bidirectional message handling ⭐
│   │   ├── ordersRouter.ts       # Price alert CRUD
│   │   ├── deviceRouter.ts       # Push token + wallet address registration
│   │   ├── simulateRouter.ts     # ⚠️ Dev/test endpoints (price triggers, mock tx push)
│   │   └── healthRouter.ts       # GET /health
│   ├── jobs/
│   │   └── priceMonitor.ts       # 30s polling loop, alert evaluation, agent invocation ⭐
│   ├── solana/
│   │   ├── buildTx.ts            # Jupiter API — swap quote + VersionedTransaction build
│   │   └── confirmTx.ts          # Solana RPC polling for on-chain confirmation ⭐
│   ├── db/
│   │   ├── database.ts           # PostgreSQL connection + schema init
│   │   └── alertsDb.ts           # All DB queries (alerts, pending txs, devices)
│   ├── ws/
│   │   └── clientRegistry.ts     # WebSocket client registry + broadcast
│   ├── notifications/
│   │   └── expoPush.ts           # Expo push notification sender
│   └── protocol/
│       └── schemas.ts            # Zod schemas for all WS + REST message types
├── scripts/
│   └── clear-db.ts               # Dev utility — wipe all tables
└── .env.example
```

---

## Key Concepts

### Authentication

All routes except `GET /health` require:
```
X-Api-Key: <value of API_KEY env var>
```
WebSocket connections are closed with code `1008 Policy Violation` if the key is missing or wrong.

### Agent Runner

`AgentRunner` is a singleton EventEmitter with a serialized prompt queue — only one prompt runs at a time. This prevents race conditions when the agent reads or writes shared DB state. Streaming events (`agent_delta`, `tool_call`, `tool_result`, `agent_done`) are emitted as Claude generates output and broadcast to all connected WS clients.

**File:** [src/agent/AgentRunner.ts](src/agent/AgentRunner.ts)

### Price Monitor

A background job polls CoinGecko every 60s and checks active price alerts every 30s. When an alert triggers, the agent is invoked autonomously with context about the price event — it can then call `queueSigningRequest` to build and push a swap transaction. Alerts are marked `triggered` immediately to prevent duplicate invocations.

**File:** [src/jobs/priceMonitor.ts](src/jobs/priceMonitor.ts)

### On-Chain Confirmation

After the mobile app returns a `tx_signed` message, the server marks the transaction as `signed` immediately and kicks off a background polling loop (`confirmTxOnChain`) that calls `getSignatureStatuses` every 3 seconds for up to 2 minutes. When the status reaches `confirmed` or `finalized`, it broadcasts `tx_confirmed` to all WS clients and updates the DB. If the RPC returns an error (e.g. blockhash expired, insufficient funds) or the window times out, it broadcasts `tx_failed` instead.

**File:** [src/solana/confirmTx.ts](src/solana/confirmTx.ts)

### Simulate Endpoints (Dev Only)

`/simulate/*` routes let you manually trigger the full flow without waiting for real prices. Set a mock price, fire alerts instantly, push test transactions, or reset state between test cycles. See [TECHNICAL-GUIDE.md](TECHNICAL-GUIDE.md#simulate-endpoints-reference) for the full reference.

**File:** [src/routes/simulateRouter.ts](src/routes/simulateRouter.ts)

For full implementation details, see [TECHNICAL-GUIDE.md](TECHNICAL-GUIDE.md).

---

## API Endpoints

### Authentication

All endpoints except `GET /health` require `X-Api-Key: <API_KEY>` header.

### REST

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Uptime check (no auth required) |
| `POST` | `/agent/prompt` | Enqueue a prompt — returns `session_id` immediately |
| `GET` | `/agent/history` | Fetch all messages across all sessions |
| `POST` | `/orders/alert` | Create a price alert |
| `GET` | `/orders/alerts` | List alerts (filter by `?status=active\|triggered\|cancelled`) |
| `DELETE` | `/orders/alerts/:id` | Cancel an alert |
| `POST` | `/device/register` | Register Expo push token + wallet address |
| `POST` | `/simulate/price-trigger` | ⚠️ Dev: set mock price + run alert check |
| `GET` | `/simulate/prices` | ⚠️ Dev: view current price cache |
| `POST` | `/simulate/push-tx` | ⚠️ Dev: build and push a test tx directly |
| `POST` | `/simulate/resend-tx` | ⚠️ Dev: rebuild expired tx with fresh Jupiter quote |
| `POST` | `/simulate/reset` | ⚠️ Dev: reset test state between cycles |

### WebSocket — `GET /ws`

Persistent bidirectional connection. The mobile client sends prompts and tx outcomes; the server streams agent output and pushes signing requests.

For the full message protocol and flow examples, see [TECHNICAL-GUIDE.md](TECHNICAL-GUIDE.md#websocket-protocol).

### Quick Test

```bash
# Health (no auth)
curl http://localhost:8080/health

# Send a prompt
curl -X POST http://localhost:8080/agent/prompt \
  -H "X-Api-Key: helloworld" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the current price of SOL?"}'
# → 202 { "session_id": "..." }

# Create a price alert
curl -X POST http://localhost:8080/orders/alert \
  -H "X-Api-Key: helloworld" \
  -H "Content-Type: application/json" \
  -d '{"token":"SOL","target_price":150,"direction":"below","from_token":"SOL","to_token":"USDC","amount":1}'

# Simulate the alert triggering
curl -X POST http://localhost:8080/simulate/price-trigger \
  -H "X-Api-Key: helloworld" \
  -H "Content-Type: application/json" \
  -d '{"token":"SOL","price":140}'

# Stream agent output via WebSocket
npx wscat -c ws://localhost:8080/ws -H "X-Api-Key: helloworld"
# → {"type":"prompt","payload":{"prompt":"Buy SOL when it drops below $150"}}
```

---

## Common Issues

### `ECONNREFUSED` connecting to Postgres

**Solution:** Start the Docker container:
```bash
docker start agentx-pg
```
If the container doesn't exist: see [Quick Start](#quick-start).

### Agent isn't responding / `error` frame on WS

**Cause:** Missing or invalid `ANTHROPIC_API_KEY`.

**Solution:** Check `server/.env` — the key must be set and valid.

### Jupiter transaction build fails

**Cause:** Wallet address not registered, or no active devices in DB.

**Solution:** Ensure `POST /device/register` was called from the mobile app with a valid wallet address before trying to build a swap.

### Price alerts not triggering

**Cause:** Price monitor polls CoinGecko every 60s — the cache may not have updated yet.

**Solution:** Use `POST /simulate/price-trigger` to manually set a price and trigger alert evaluation instantly.

---

## Documentation

- **[TECHNICAL-GUIDE.md](TECHNICAL-GUIDE.md)** — Full WebSocket protocol, agent architecture, communication flow, Jupiter integration, and simulate endpoint reference
- **[Root README](../README.md)** — App overview and full project setup
- **[mobile/README.md](../mobile/README.md)** — Mobile client setup and signing flow

---

## Resources

### Official Documentation
- [Anthropic API Docs](https://docs.anthropic.com/)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Jupiter V6 Swap API](https://station.jup.ag/docs/apis/swap-api)
- [Fastify Docs](https://fastify.dev/)

### Developer Tools
- [Solana Explorer (Mainnet)](https://explorer.solana.com/)
- [CoinGecko API Docs](https://docs.coingecko.com/reference/introduction)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)

---

## License

MIT License — See [LICENSE](../../LICENSE) for details
