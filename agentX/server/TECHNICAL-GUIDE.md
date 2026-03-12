# Technical Guide — agentX Server

> **📖 Deep Dive Documentation**
> This is a comprehensive technical guide explaining the server architecture, WebSocket communication protocol, and all integration details.
> For setup and API overview, see [README.md](README.md).

## Table of Contents

1. [Overview](#overview)
2. [Trust Model](#trust-model)
3. [Project Structure](#project-structure)
4. [Agent Architecture](#agent-architecture)
5. [WebSocket Protocol](#websocket-protocol)
6. [REST API Reference](#rest-api-reference)
7. [Agent Tools Reference](#agent-tools-reference)
8. [Price Monitor](#price-monitor)
9. [Jupiter Integration](#jupiter-integration)
10. [Push Notifications](#push-notifications)
11. [Database Schema](#database-schema)
12. [End-to-End Communication Flows](#end-to-end-communication-flows)
13. [Simulate Endpoints Reference](#simulate-endpoints-reference)
14. [Common Issues & Solutions](#common-issues--solutions)

---

## Overview

agentX is built around one architectural principle: **the agent lives on the server, the phone is a signing terminal.**

The agent runs persistently on the server. It reasons over live market data, creates price alerts, and builds swap transactions entirely server-side. The mobile app's only jobs are to display the agent's output and to sign transactions the user approves — it never runs business logic and never touches a private key directly. The WebSocket connection is the bridge between them: the server streams agent reasoning to the phone in real time, and the phone sends back signing outcomes.

This separation matters for two reasons:
- **Security**: private keys stay in the device's secure enclave (Seed Vault), never transmitted to the server. The server only ever sees the user's public key, which it needs solely as the `feePayer` for Jupiter transaction building.
- **Autonomy**: because the agent is server-side, it can act on price alerts even when the app is in the background or killed — the push notification is just a wake signal to surface the already-built transaction.

In practice, the server:

1. Accepts prompts from the mobile app via WebSocket or REST
2. Runs Claude Sonnet 4.6 with access to Solana-aware tools
3. Streams the agent's reasoning back to the mobile app token-by-token
4. Monitors SOL prices autonomously and invokes the agent when alerts trigger
5. Builds real Jupiter swap transactions and pushes them to the phone for signing
6. Polls the Solana RPC after signing to confirm the transaction landed on-chain

---

## Trust Model

Understanding who holds what is essential for extending this system.

| Entity | Holds | Never holds |
|--------|-------|-------------|
| Server | Business logic, conversation history, price alerts, serialized (unsigned) transactions, wallet *public* key | Private keys, seed phrases |
| Mobile app | UI state, session ID, push token | Business logic, unsigned transactions (only shown briefly in modal) |
| Device wallet (Seed Vault / MWA) | Private keys | Nothing from agentX |

**The signing flow enforces this boundary:**

1. The agent builds a `VersionedTransaction` on the server using the user's *public* key as `feePayer`
2. The serialized (still unsigned) transaction is sent to the phone over WebSocket
3. The `AgentTxModal` shows the trade details and the agent's reason — the user decides to approve or reject
4. On approval, MWA passes the transaction to the device wallet (Seed Vault). The private key never leaves the secure enclave — the wallet signs inside it and returns only the signature
5. The mobile app sends the base58 signature back to the server via `tx_signed`
6. The server records the signature and confirms on-chain — it cannot modify or replay the transaction

**What the server can and cannot do:**

- ✅ Build a transaction for any swap the agent decides on
- ✅ Push that transaction to the phone and send a push notification
- ❌ Sign anything — it has no key material
- ❌ Force a swap — the user must tap "Sign & Send" in the modal
- ❌ See what else is in the user's wallet or submit transactions without user approval

The result: the agent is autonomous up until the moment money moves. That step always requires an explicit human action on the device.

---

## Project Structure

```
server/src/
├── index.ts                    # Startup sequence: env validation → DB init → server → price monitor
├── server.ts                   # Fastify instance, CORS, WebSocket plugin, route registration
├── agent/
│   ├── AgentRunner.ts          # Core agent loop — serialized queue + streaming ⭐
│   └── tools/
│       └── solana.ts           # 4 trading tools available to Claude ⭐
├── routes/
│   ├── agentRouter.ts          # REST prompt + history endpoints
│   ├── wsRouter.ts             # WebSocket connection handler ⭐
│   ├── ordersRouter.ts         # Price alert CRUD
│   ├── deviceRouter.ts         # Device / push token registration
│   ├── simulateRouter.ts       # ⚠️ Dev/test endpoints
│   └── healthRouter.ts         # GET /health
├── jobs/
│   └── priceMonitor.ts         # Background polling loop + alert evaluation ⭐
├── solana/
│   ├── buildTx.ts              # Jupiter quote + VersionedTransaction serialization
│   └── confirmTx.ts            # Solana RPC polling for on-chain confirmation ⭐
├── db/
│   ├── database.ts             # PostgreSQL connection pool + schema initialization
│   └── alertsDb.ts             # All database queries
├── ws/
│   └── clientRegistry.ts       # Active WS connections registry + broadcast utility
├── notifications/
│   └── expoPush.ts             # Expo push notification sender (FCM relay)
└── protocol/
    └── schemas.ts              # Zod schemas for all message types
```

### Key Integration Points

- **[AgentRunner.ts](src/agent/AgentRunner.ts)** — The agent orchestrator. All Claude interactions go through here.
- **[wsRouter.ts](src/routes/wsRouter.ts)** — The WebSocket handler. All real-time communication passes through here.
- **[priceMonitor.ts](src/jobs/priceMonitor.ts)** — The autonomous loop. This is what makes the system "agentic" without user interaction.
- **[solana.ts](src/agent/tools/solana.ts)** — The tools Claude can call. This is where agent decisions become on-chain actions.

---

## Agent Architecture

### Why Claude Sonnet 4.6?

Claude was chosen over alternatives for three reasons specific to this use case:

1. **Native tool-calling** — Anthropic's SDK provides structured tool definitions with full TypeScript types. The agent can chain `getSolanaPrice` → `createPriceAlert` → `queueSigningRequest` reliably without brittle prompt engineering.
2. **Reliable multi-step reasoning** — The agent must reason: "the user said buy the dip → price is now at the target → check for duplicate pending requests → build the transaction → send reason to user". This requires stable multi-hop tool usage.
3. **Vercel AI SDK compatibility** — `streamText` from the `ai` package provides a clean async iterator over the full event stream (text deltas, tool calls, tool results), making streaming to WebSocket clients straightforward.

### Serialized Prompt Queue

`AgentRunner` processes prompts one at a time via a simple async queue:

```
Prompt A arrives → enqueued
Prompt B arrives → enqueued
[A runs] → streams output → completes
[B runs] → streams output → completes
```

**Why single-threaded?**

- The agent reads DB state (conversation history, pending txs) at the start of each run
- The agent writes DB state (new messages, new alerts, new txs) during the run
- Running two prompts concurrently would cause read-after-write races — e.g., the agent creates an alert in run A, then run B doesn't see it and creates a duplicate
- Fastify handles HTTP concurrency; the queue just serializes agent runs

### Streaming with Vercel AI SDK

```typescript
// src/agent/AgentRunner.ts
const result = streamText({
  model: anthropic("claude-sonnet-4-6"),
  system: SYSTEM_PROMPT,
  messages,
  maxSteps: 5,
  tools: {
    getSolanaPrice: getSolanaPriceTool,
    createPriceAlert: createPriceAlertTool,
    // Factory: captures sessionId so the tool can read the trigger context
    // set by priceMonitor and store it on the pending_tx row.
    queueSigningRequest: createQueueSigningRequestTool(sessionId),
    getPendingSigningRequests: getPendingSigningRequestsTool,
  },
});

for await (const chunk of result.fullStream) {
  if (chunk.type === 'text-delta') {
    emit('agent_delta', sessionId, chunk.textDelta);
  } else if (chunk.type === 'tool-call') {
    emit('tool_call', sessionId, chunk.toolName, chunk.args);
  } else if (chunk.type === 'tool-result') {
    emit('tool_result', sessionId, chunk.toolName, chunk.result);
  }
}
```

Each event is then broadcast to all WebSocket clients via `clientRegistry.broadcast()`.

**Why emit `tool_call` and `tool_result` separately?**

The mobile app uses `tool_call` events to show a "Fetching price..." indicator *immediately* when Claude decides to call a tool — before the result arrives. This creates a responsive feel even when Jupiter's API takes a few hundred milliseconds.

### System Prompt Design

The agent's system prompt (in `AgentRunner.ts`) establishes:

- **Identity**: autonomous Solana trading agent, acts on behalf of the user
- **Scope restriction**: only SOL ↔ USDC swaps are supported (no other tokens)
- **Autonomous session instructions**: when invoked by the price monitor (not a user), produce a single one-line outcome message, not conversational text
- **Anti-repetition**: the agent must echo specific prices/amounts in its responses, not generic phrases like "I've set up your alert"

### Session Model

Sessions group related messages for conversation context:

- **User sessions**: UUID generated on first app launch, persisted in `AsyncStorage`. Passed in every prompt so Claude sees full history.
- **Autonomous sessions**: created by the price monitor with an `alert_<id>` prefix (e.g., `alert_3`). These are separate from the user's chat session — they don't appear in the chat history.

**Why separate autonomous sessions?**

When a price alert fires at 3am, you don't want "SOL dropped to $142, I'm executing the swap" to appear as a user message in the chat log. The agent's autonomous session produces internal reasoning, but only the signing request appears in the UI.

---

## WebSocket Protocol

### Connection

```
ws://<host>:8080/ws
Header: X-Api-Key: <API_KEY>
```

Authentication is checked on upgrade. Invalid key → connection closed with code `1008 Policy Violation`.

On successful connect, the server re-delivers any non-expired pending signing requests immediately. This handles the case where the user opens the app to find a tx waiting.

### Why WebSocket Over REST Polling?

- **Streaming**: agent text deltas arrive as Claude generates them — polling would require buffering and introduce latency
- **Server-initiated push**: the server needs to push `tx_signing_request` messages asynchronously (triggered by price monitor, not by a user request). Polling can't do this efficiently.
- **Tool call visibility**: `tool_call`/`tool_result` events fire during the agent's run, not at response-completion time. These can't be returned in a single REST response.

### Messages: Client → Server

All messages are JSON text frames.

---

#### `prompt` — send a message to the agent

```json
{
  "type": "prompt",
  "payload": {
    "prompt": "Buy SOL when it drops below $150",
    "session_id": "4df6ab7a-b99b-4d95-8dd5-deef11d0aaeb"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `payload.prompt` | string | Yes | The user's message |
| `payload.session_id` | string | No | Continue an existing conversation. Omit for a new session. |

The agent runs asynchronously. Expect a stream of `agent_delta`, `tool_call`, `tool_result`, and `agent_done` frames in response.

---

#### `tx_signed` — user approved and wallet signed

Sent after the user approves a signing request in `AgentTxModal` and MWA returns a signature.

```json
{
  "type": "tx_signed",
  "payload": {
    "tx_id": "2e31b14f-1a42-4e91-8ffc-216e3f16c70d",
    "signature": "5Uf8XmFt..."
  }
}
```

| Field | Type | Description |
|---|---|---|
| `tx_id` | string | From the original `tx_signing_request` |
| `signature` | string | Base58 Solana transaction signature returned by MWA |

The server marks status as `signed` immediately and starts polling the Solana RPC in the background. When the transaction lands on-chain, a `tx_confirmed` message is broadcast. If it fails or times out, `tx_failed` is broadcast instead.

---

#### `tx_rejected` — user dismissed the signing request

```json
{
  "type": "tx_rejected",
  "payload": {
    "tx_id": "2e31b14f-1a42-4e91-8ffc-216e3f16c70d",
    "reason": "User dismissed"
  }
}
```

The server marks status as `rejected`. The alert is still `triggered` — it won't fire again unless reset.

---

#### `ping` — keepalive

```json
{ "type": "ping" }
```

Server replies with `{ "type": "pong" }`. Send this periodically to keep the connection alive through NAT/proxy timeouts.

---

### Messages: Server → Client

---

#### `agent_delta` — streaming text token

Fired for each text token as Claude generates its response. Append these to the current message bubble to create a live typing effect.

```json
{
  "type": "agent_delta",
  "payload": {
    "session_id": "4df6ab7a-...",
    "text": "Setting up your "
  }
}
```

**Implementation note:** Replace the accumulated delta text with the final `agent_done.text` value when it arrives — `agent_done.text` is the authoritative complete response.

---

#### `agent_done` — response complete

```json
{
  "type": "agent_done",
  "payload": {
    "session_id": "4df6ab7a-...",
    "text": "Done! I've set a price alert: I'll queue a 1 SOL → USDC swap when SOL drops below $150."
  }
}
```

Persist this message to your local history and finalize the message bubble.

---

#### `tool_call` — agent is invoking a tool

```json
{
  "type": "tool_call",
  "payload": {
    "session_id": "4df6ab7a-...",
    "tool": "getSolanaPrice",
    "input": { "tokenSymbol": "SOL" }
  }
}
```

Use this to show a contextual indicator: map `tool` name to a user-friendly string:

| Tool | Suggested indicator |
|---|---|
| `getSolanaPrice` | "Fetching price..." |
| `createPriceAlert` | "Setting up alert..." |
| `queueSigningRequest` | "Building swap..." |
| `getPendingSigningRequests` | "Checking pending..." |

---

#### `tool_result` — tool returned a value

```json
{
  "type": "tool_result",
  "payload": {
    "session_id": "4df6ab7a-...",
    "tool": "getSolanaPrice",
    "output": { "symbol": "SOL", "price": 185.42, "currency": "USD" }
  }
}
```

Hide the tool indicator when this arrives.

---

#### `tx_signing_request` — agent queued a swap for the user to sign

The most important server-initiated message. Displayed as a modal in the mobile app.

```json
{
  "type": "tx_signing_request",
  "payload": {
    "tx_id": "2e31b14f-1a42-4e91-8ffc-216e3f16c70d",
    "from_token": "SOL",
    "to_token": "USDC",
    "amount": 1.0,
    "serialized_tx": "<base64-encoded Jupiter v0 VersionedTransaction>",
    "reason": "SOL dropped to $142 — executing your buy-the-dip strategy targeting $150 recovery.",
    "trigger": {
      "alert_id": 3,
      "token": "SOL",
      "target_price": 150.00,
      "triggered_price": 142.10,
      "direction": "below"
    },
    "expires_at": "2026-02-27T10:05:00.000Z"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `tx_id` | string (UUID) | Unique ID — include in `tx_signed` / `tx_rejected` responses |
| `serialized_tx` | string (base64) | Decode to `Uint8Array`, deserialize as `VersionedTransaction`, pass to MWA |
| `reason` | string | Agent's one-line explanation — show this to the user |
| `trigger` | object | Which price alert fired this (alert_id 0 = agent-initiated directly) |
| `expires_at` | ISO 8601 | **Check before signing** — Jupiter quotes expire ~90s after creation; refuse to sign if past this time |

---

#### `error` — agent or server-side error

```json
{
  "type": "error",
  "payload": {
    "session_id": "4df6ab7a-...",
    "message": "Anthropic API rate limit exceeded"
  }
}
```

The WebSocket connection remains open after an error — only the individual agent run failed.

---

#### `tx_confirmed` — transaction landed on-chain

Broadcast after `confirmTxOnChain` sees `confirmationStatus: 'confirmed'` or `'finalized'` from the Solana RPC. The signature can be used to link to Solana Explorer.

```json
{
  "type": "tx_confirmed",
  "payload": {
    "tx_id": "2e31b14f-1a42-4e91-8ffc-216e3f16c70d",
    "signature": "5Uf8XmFt..."
  }
}
```

---

#### `tx_failed` — transaction failed or timed out on-chain

Broadcast when the RPC returns a non-null `err` for the signature, or when the 2-minute polling window expires without confirmation. Common causes: blockhash expired before broadcast, insufficient SOL for fees, slippage exceeded.

```json
{
  "type": "tx_failed",
  "payload": {
    "tx_id": "2e31b14f-1a42-4e91-8ffc-216e3f16c70d",
    "reason": "Transaction failed on-chain: {\"InstructionError\":[0,\"InsufficientFunds\"]}"
  }
}
```

---

#### `pong`

```json
{ "type": "pong" }
```

---

### Complete Flow Example — Agent-Initiated Swap

```
→ { "type": "prompt", "payload": { "prompt": "SOL looks cheap. Swap 0.5 SOL to USDC." } }

← { "type": "agent_delta",  "payload": { "text": "Let me check the current price first..." } }

← { "type": "tool_call",   "payload": { "tool": "getSolanaPrice", "input": { "tokenSymbol": "SOL" } } }
← { "type": "tool_result", "payload": { "tool": "getSolanaPrice", "output": { "price": 142.10 } } }

← { "type": "tool_call",   "payload": { "tool": "queueSigningRequest",
     "input": { "from_token": "SOL", "to_token": "USDC", "amount": 0.5,
                "reason": "SOL is at $142 — swapping 0.5 SOL to USDC to lock in profits." } } }

← { "type": "tx_signing_request", "payload": {
      "tx_id": "2e31b14f-...",
      "from_token": "SOL", "to_token": "USDC", "amount": 0.5,
      "serialized_tx": "<base64>",
      "reason": "SOL is at $142 — swapping 0.5 SOL to USDC to lock in profits.",
      "expires_at": "2026-02-27T10:05:00.000Z"
   } }

← { "type": "tool_result", "payload": { "tool": "queueSigningRequest", "output": { "success": true } } }

← { "type": "agent_done", "payload": { "text": "Done! Swap request sent to your phone." } }

  [user taps Sign & Send in AgentTxModal → MWA opens wallet → user approves]

→ { "type": "tx_signed", "payload": { "tx_id": "2e31b14f-...", "signature": "5Uf8X..." } }

  [server marks status='signed', starts polling Solana RPC every 3s]

← { "type": "tx_confirmed", "payload": { "tx_id": "2e31b14f-...", "signature": "5Uf8X..." } }
  (or tx_failed if the network rejected it)
```

---

## REST API Reference

All endpoints except `GET /health` require `X-Api-Key: <API_KEY>` header.

---

### `GET /health`

No auth. Returns server uptime.

```json
{ "ok": true, "uptime": 42.3 }
```

---

### `POST /agent/prompt`

Enqueue a prompt. Returns immediately with `session_id`. Connect to `WS /ws` to receive streaming output.

**Request:**
```json
{
  "prompt": "What is the price of SOL?",
  "session_id": "optional-uuid-to-continue-conversation"
}
```

**Response `202`:**
```json
{ "session_id": "4df6ab7a-b99b-4d95-8dd5-deef11d0aaeb" }
```

---

### `GET /agent/history`

Fetch all messages across all sessions, ordered oldest-first. Used to hydrate the chat UI on app launch before opening the WebSocket.

**Response `200`:**
```json
{
  "messages": [
    { "id": 1, "session_id": "...", "role": "user", "content": "...", "created_at": "2026-02-22T21:09:00.000Z" },
    { "id": 2, "session_id": "...", "role": "agent", "content": "...", "created_at": "2026-02-22T21:09:03.000Z" }
  ]
}
```

**Note:** Only `user` and `agent` roles appear — autonomous agent sessions (`alert_*`) are excluded.

---

### `POST /orders/alert`

Create a price alert. When SOL crosses the target, the server autonomously invokes Claude, which builds a Jupiter swap tx and pushes it to the mobile app.

**Request:**
```json
{
  "token": "SOL",
  "target_price": 150.00,
  "direction": "below",
  "from_token": "SOL",
  "to_token": "USDC",
  "amount": 1.0
}
```

| Field | Type | Description |
|---|---|---|
| `token` | string | Token to watch — only `"SOL"` currently supported |
| `target_price` | number | Price level that triggers the alert |
| `direction` | `"above"` \| `"below"` | Fire when price goes above or below target |
| `from_token` | `"SOL"` \| `"USDC"` | Token to sell when alert fires |
| `to_token` | `"SOL"` \| `"USDC"` | Token to buy |
| `amount` | number | Amount of `from_token` to swap |

**Response `201`:**
```json
{
  "alert_id": 3, "token": "SOL", "target_price": 150.00,
  "direction": "below", "status": "active", "created_at": "..."
}
```

---

### `GET /orders/alerts`

List price alerts. Filter by `?status=active|triggered|cancelled`.

**Response `200`:** Array of alert objects (same shape as `POST` response).

---

### `DELETE /orders/alerts/:id`

Cancel an active alert. Returns `404` if alert doesn't exist or is already inactive.

**Response `200`:** `{ "ok": true, "alert_id": 3 }`

---

### `POST /device/register`

Register a mobile device's Expo push token. Call on every app launch. Also accepts the user's Solana wallet address — the server needs this to build Jupiter swap transactions (the `feePayer` field requires a real public key).

**Request:**
```json
{
  "push_token": "ExponentPushToken[xxxxxx]",
  "wallet_address": "So11111111111111111111111111111111111111112"
}
```

**Response `201`:** `{ "ok": true }`

---

## Agent Tools Reference

These are the tools available to Claude. All live data comes from the price monitor cache (CoinGecko) and Jupiter API (mainnet).

---

### `getSolanaPrice`

Returns the current price of SOL or USDC from the in-memory price cache.

**Input:**
```json
{ "tokenSymbol": "SOL" }
```

**Output:**
```json
{ "symbol": "SOL", "price": 185.42, "currency": "USD" }
```

**Why a cache instead of live fetch?** Jupiter's API rate limits aggressive polling. The price monitor polls CoinGecko on a fixed schedule (60s) and the result is shared across all tool calls and price checks. This avoids hammering external APIs while keeping prices reasonably fresh.

---

### `createPriceAlert`

Registers a price alert in PostgreSQL. The price monitor checks active alerts on every tick.

**Input:**
```json
{
  "token": "SOL",
  "target_price": 150.0,
  "direction": "below",
  "from_token": "SOL",
  "to_token": "USDC",
  "amount": 1.0
}
```

**Output:**
```json
{ "success": true, "alert_id": 3, ... }
```

**When does this get called?** When the user says something like "buy SOL if it drops below $150" in the chat. Claude interprets the intent and calls this tool with the appropriate parameters.

---

### `queueSigningRequest`

The most consequential tool. It:
1. Fetches a fresh Jupiter quote
2. Builds a serialized `VersionedTransaction`
3. Stores it in `pending_txs` with a 5-minute expiry
4. Broadcasts `tx_signing_request` to all WS clients
5. Sends an Expo push notification to wake the app

**Input:**
```json
{
  "from_token": "SOL",
  "to_token": "USDC",
  "amount": 0.5,
  "reason": "SOL dropped to $142 — executing your strategy."
}
```

**Output:**
```json
{ "success": true, "tx_id": "2e31b14f-...", "connected_clients": 1, "message": "..." }
```

**When does this get called?**
- By the agent during a chat session when the user requests an immediate swap
- By the agent during an autonomous price-alert session when the price target is reached

---

### `getPendingSigningRequests`

Returns all signing requests awaiting user approval. The agent calls this before creating a new signing request to avoid spamming the user with duplicates.

**Input:** *(none)*

**Output:**
```json
{
  "count": 1,
  "pending": [
    { "tx_id": "...", "from_token": "SOL", "to_token": "USDC", "amount": 0.5, "expires_at": "..." }
  ]
}
```

---

## Price Monitor

**File:** [src/jobs/priceMonitor.ts](src/jobs/priceMonitor.ts)

### Polling Intervals

Two independent timers run after server start:

```
Every 60s: fetchPrices()    — call CoinGecko, update in-memory cache
Every 30s: checkAlerts()    — evaluate all active alerts against cached price
```

The fetch interval is longer because CoinGecko has rate limits. The check interval is shorter because price movements can be sudden and we want to catch alerts quickly once the price updates.

### Alert Evaluation

For each active alert:
1. Look up current price from cache (e.g., SOL = $142)
2. Compare against `target_price` and `direction`
3. If triggered: mark alert as `triggered` in DB **immediately** (idempotency gate)
4. Enqueue an autonomous agent session with price context

**Idempotency:** The status is updated to `triggered` in a single DB write before the agent runs. If the 30s tick fires again while the agent is running, it won't find the alert as `active` and won't re-trigger it.

### Autonomous Agent Invocation

When an alert fires, the price monitor calls `AgentRunner.runAutonomous()` with a system-generated prompt:

```
[SYSTEM — price alert triggered]
Token: SOL
Current price: $142.10
User's target: price goes below $150
Configured trade: swap 1 SOL → USDC
Decide whether to queue a signing request.
```

Claude sees this in a fresh session (`alert_3`) and typically:
1. Calls `getSolanaPrice` to confirm the live price
2. Calls `getPendingSigningRequests` to check for existing pending txs
3. Calls `queueSigningRequest` if no duplicates exist

---

## Jupiter Integration

**File:** [src/solana/buildTx.ts](src/solana/buildTx.ts)

### Why Jupiter?

Jupiter is the leading DEX aggregator on Solana. Using Jupiter means:
- Best execution price across all Solana liquidity pools automatically
- No need to integrate individual DEXes (Raydium, Orca, etc.)
- A single API that handles routing and transaction construction

### Transaction Build Flow

For a swap (e.g., 1 SOL → USDC):

```
1. GET https://quote-api.jup.ag/v6/quote
   ?inputMint=So11111111111111111111111111111111111111112    ← SOL mint
   &outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v  ← USDC mint
   &amount=1000000000    ← 1 SOL in lamports (1e9)
   &slippageBps=50       ← 0.5% slippage tolerance

2. POST https://quote-api.jup.ag/v6/swap
   Body: { quoteResponse, userPublicKey, dynamicComputeUnitLimit: true }
   → Returns: { swapTransaction: "<base64 VersionedTransaction>" }

3. Store base64 string in pending_txs.payload
4. Include in tx_signing_request WS message as serialized_tx
```

### Why Base64 for Transport?

`VersionedTransaction` is a binary format. JSON only supports strings, so we base64-encode for transport. The mobile app decodes it:

```typescript
// mobile: agent-provider.tsx
const txBytes = Buffer.from(serialized_tx, 'base64');
const versionedTx = VersionedTransaction.deserialize(txBytes);
const signature = await signAndSendTransaction(versionedTx);
```

### Transaction Expiry

Jupiter quotes embed a recent blockhash. Solana transactions expire after ~150 blocks (~90 seconds). The server sets `expires_at = now + 5 minutes` — conservative enough for the user to see and act on the notification.

**Why 5 minutes if blockhash expires in ~90s?**

The `expires_at` field signals when the signing request UI should be dismissed, not when the transaction itself expires on-chain. If a user tries to sign after the blockhash is stale, the Solana network will reject it. Use `POST /simulate/resend-tx` to rebuild with a fresh quote and re-push.

---

## Push Notifications

**File:** [src/notifications/expoPush.ts](src/notifications/expoPush.ts)

### Why Expo Push (FCM Relay)?

Expo's push service acts as a relay to Firebase Cloud Messaging (FCM). Benefits:
- One API call to Expo's servers handles FCM delivery
- No need to manage FCM credentials server-side
- Works across Expo managed and bare workflow
- Expo handles batching and error reporting

### Registration Flow

1. Mobile app calls `expo-notifications.getExpoPushTokenAsync()` on launch
2. Token (format: `ExponentPushToken[xxx]`) is sent to `POST /device/register`
3. Server stores token + wallet address in `devices` table
4. On `queueSigningRequest`: server calls `sendPushToDevices()` which sends to all registered tokens

### Notification Payload

```typescript
// When the agent queues a signing request
await sendPushToDevices("agentX: Trade Ready to Sign", reason, {
  type: "tx_signing_request",
  tx_id: tx.tx_id,
});
```

The mobile app's notification handler opens the app and surfaces the signing modal when tapped.

---

## Database Schema

**File:** [src/db/database.ts](src/db/database.ts)

```sql
-- Groups messages into conversations
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chat messages — both user and agent turns
CREATE TABLE messages (
  id         BIGSERIAL PRIMARY KEY,
  session_id TEXT REFERENCES sessions(session_id),
  role       TEXT CHECK (role IN ('user', 'agent')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Price alerts set by user or agent
CREATE TABLE price_alerts (
  id           BIGSERIAL PRIMARY KEY,
  session_id   TEXT,                        -- Which chat session created this
  token        TEXT NOT NULL,               -- "SOL"
  target_price NUMERIC NOT NULL,            -- e.g. 150.00
  direction    TEXT CHECK (direction IN ('above', 'below')),
  from_token   TEXT NOT NULL,               -- "SOL" | "USDC"
  to_token     TEXT NOT NULL,               -- "SOL" | "USDC"
  amount       NUMERIC NOT NULL,
  status       TEXT DEFAULT 'active'
               CHECK (status IN ('active', 'triggered', 'cancelled')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Swap transactions awaiting user signature
CREATE TABLE pending_txs (
  tx_id         TEXT PRIMARY KEY,           -- UUID
  alert_id      BIGINT REFERENCES price_alerts(id),
  from_token    TEXT NOT NULL,
  to_token      TEXT NOT NULL,
  amount        NUMERIC NOT NULL,
  payload       TEXT NOT NULL,              -- base64 serialized VersionedTransaction
  trigger_price NUMERIC,                    -- SOL price that fired the alert; null for manual trades
  status        TEXT DEFAULT 'pending_signature'
                CONSTRAINT pending_txs_status_check
                CHECK (status IN ('pending_signature', 'signed', 'rejected', 'expired', 'confirmed', 'failed')),
  signature     TEXT,                       -- Set when user signs (base58)
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Registered mobile devices for push notifications
CREATE TABLE devices (
  id             BIGSERIAL PRIMARY KEY,
  push_token     TEXT UNIQUE NOT NULL,      -- ExponentPushToken[xxx]
  wallet_address TEXT,                      -- Solana public key (for Jupiter feePayer)
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

### Why PostgreSQL Instead of SQLite?

- Concurrent reads/writes are safe (agent runner + HTTP handlers + price monitor all hit DB)
- Railway provides managed Postgres with automatic `DATABASE_URL` injection
- `NUMERIC` type avoids float precision issues with prices and lamport amounts

### Why Store `wallet_address` in `devices`?

Jupiter's swap API requires a `userPublicKey` to build a transaction — it's the `feePayer` for network fees. The server doesn't hold any private keys, so it needs the public key registered separately. The mobile app sends it during `POST /device/register` right after connecting the wallet.

---

## End-to-End Communication Flows

### Flow 1: User Chat → Agent Response

```
[Mobile App]                           [Server]
     │                                     │
     │ POST /device/register               │
     │ { push_token, wallet_address }      │
     │────────────────────────────────────►│ Store in devices table
     │                                     │
     │ GET /agent/history                  │
     │────────────────────────────────────►│
     │◄────────────────────────────────────│ { messages: [...] }
     │ (hydrate chat UI)                   │
     │                                     │
     │ WS /ws (X-Api-Key header)           │
     │════════════════════════════════════►│ Validate key, register client
     │                                     │ Re-deliver pending txs (if any)
     │                                     │
     │ → { type: "prompt", payload: {      │
     │     prompt: "Buy SOL at $145"       │
     │     session_id: "abc-123" } }       │
     │────────────────────────────────────►│ Enqueue in AgentRunner
     │                                     │
     │                                     │ [AgentRunner dequeues]
     │                                     │ Fetch history for session abc-123
     │                                     │ Call streamText (Claude Sonnet 4.6)
     │                                     │
     │ ← { type: "tool_call",              │
     │     tool: "getSolanaPrice" }        │
     │◄────────────────────────────────────│ Claude calls getSolanaPrice tool
     │ (show "Fetching price...")          │
     │                                     │
     │ ← { type: "tool_result",            │
     │     output: { price: 142.10 } }     │
     │◄────────────────────────────────────│
     │ (hide indicator)                    │
     │                                     │
     │ ← { type: "tool_call",              │
     │     tool: "createPriceAlert" }      │
     │◄────────────────────────────────────│ Claude calls createPriceAlert
     │ (show "Setting up alert...")        │ → alert stored in DB
     │                                     │
     │ ← { type: "agent_delta",            │
     │     text: "Done! I've set " }       │
     │◄────────────────────────────────────│ Claude streams response
     │ (append to bubble)                  │
     │                                     │
     │ ← { type: "agent_done",             │
     │     text: "Done! Alert set at $145"}│
     │◄────────────────────────────────────│ Response complete
     │ (finalize bubble, save to history)  │ Save to messages table
```

---

### Flow 2: Price Alert → Autonomous Swap → User Signing

This is the most important flow and the least obvious one to follow in the code. There are three non-trivial design decisions worth understanding before reading the diagram.

**1. The trigger context pipeline**

When `priceMonitor` detects that an alert has fired, it needs to pass the alert's metadata (target price, triggered price, direction, token) all the way through to the `pending_txs` row so that clients reconnecting later see accurate data in re-delivered signing requests — not placeholder zeros. The challenge is that this data travels through two async hops: `priceMonitor` → `AgentRunner` → `queueSigningRequest` tool.

The solution is a module-level `Map` in `priceMonitor.ts`:

```typescript
// priceMonitor.ts — when an alert fires
alertTriggerContext.set(`alert_${alert.id}`, {
  alertId: alert.id, token: alert.token,
  targetPrice: target, triggeredPrice: price, direction: alert.direction,
});
agentRunner.enqueue(prompt, `alert_${alert.id}`);
```

**2. Why `queueSigningRequest` is a factory function**

The four agent tools are module-level constants — they have no access to the current session. `queueSigningRequest` is the exception because it needs the session ID to look up the trigger context Map. Making it a factory solves this cleanly:

```typescript
// AgentRunner.ts — inside run(sessionId, prompt)
tools: {
  getSolanaPrice: getSolanaPriceTool,        // static — no session context needed
  createPriceAlert: createPriceAlertTool,    // static
  queueSigningRequest: createQueueSigningRequestTool(sessionId),  // captures sessionId
  getPendingSigningRequests: getPendingSigningRequestsTool,       // static
}
```

Inside the factory, the tool reads and deletes the trigger context in one step:

```typescript
// solana.ts — inside createQueueSigningRequestTool(sessionId).execute()
const ctx = alertTriggerContext.get(sessionId); // e.g. { triggeredPrice: 142.10, ... }
alertTriggerContext.delete(sessionId);           // consume — won't be re-used
await createPendingTx({ ..., trigger_price: ctx?.triggeredPrice, alert_id: ctx?.alertId });
```

**3. Reconnect re-delivery**

If the app was closed when the signing request arrived, it reconnects and the server re-delivers all non-expired pending txs. Because `trigger_price` is now stored on the `pending_txs` row and the query JOINs `price_alerts` for `target_price` and `direction`, the re-delivered message is identical to the original — no placeholder zeros.

```
[PriceMonitor]                [AgentRunner]              [Mobile App]

Every 60s: CoinGecko fetch
  SOL = $142.10
  (below alert target $145)

Every 30s: checkAlerts()
  Alert #3: target=$145, below
  ✓ Triggered!
  UPDATE status='triggered'
         │
         │ runAutonomous("alert_3", context)
         └─────────────────►│
                            │ streamText with alert context
                            │
                            │ tool: getSolanaPrice
                            │   → { price: 142.10 }
                            │ tool: getPendingSigningRequests
                            │   → { count: 0 }
                            │ tool: queueSigningRequest
                            │   → buildJupiterSwapTx(SOL→USDC, 1.0)
                            │   → INSERT pending_txs
                            │   → clientRegistry.broadcast(tx_signing_request)
                            │   → sendPushToDevices(...)
                            │                        │
                            │         ← { type: "tx_signing_request",
                            │             tx_id: "2e31b14f-...",
                            │             serialized_tx: "<base64>",
                            │             reason: "SOL hit $142..." }
                            │                        │
                            │              [AgentTxModal appears]
                            │              User taps "Sign & Send"
                            │              MWA opens wallet
                            │              User approves
                            │                        │
                            │         → { type: "tx_signed",
                            │             tx_id: "2e31b14f-...",
                            │             signature: "5Uf8X..." }
                            │                        │
                            │   UPDATE pending_txs SET status='signed',
                            │                           signature='5Uf8X...'
                            │   confirmTxOnChain("5Uf8X...") ← polls RPC every 3s
                            │                        │
                            │         ← { type: "tx_confirmed",
                            │             tx_id: "2e31b14f-...",
                            │             signature: "5Uf8X..." }
                            │                        │
                            │   UPDATE pending_txs SET status='confirmed'
```

---

### Reconnection Handling

When the mobile app reconnects to WS:

```typescript
// wsRouter.ts — on new connection
// JOIN with price_alerts so re-delivered messages carry accurate trigger metadata
// (real target_price, triggered_price, direction) instead of placeholder zeros.
const pending = await getPendingTxsWithTrigger();
for (const tx of pending) {
  send(socket, {
    type: "tx_signing_request",
    payload: {
      tx_id: tx.tx_id,
      from_token: tx.from_token,
      to_token: tx.to_token,
      amount: Number(tx.amount),
      serialized_tx: tx.payload,
      reason: "Pending signing request from a previous agent decision",
      trigger: {
        alert_id: Number(tx.alert_id ?? 0),
        token: tx.alert_token ?? tx.from_token,
        target_price: Number(tx.alert_target_price ?? 0),
        triggered_price: Number(tx.trigger_price ?? 0),
        direction: tx.alert_direction ?? "below",
      },
      expires_at: tx.expires_at,
    },
  });
}
```

This ensures signing requests aren't lost if the app was killed between the push notification arriving and the user tapping it.

---

## Simulate Endpoints Reference

**File:** [src/routes/simulateRouter.ts](src/routes/simulateRouter.ts)

These endpoints let you test the full price-alert → agent → signing flow in seconds without waiting for real price movements.

### `POST /simulate/price-trigger`

Set a mock price and run `checkAlerts()` immediately.

**Request:**
```json
{ "token": "SOL", "price": 140 }
```

**Response:**
```json
{ "ok": true, "token": "SOL", "simulated_price": 140, "message": "Mock price for SOL set to 140; active alerts evaluated." }
```

**Typical test flow:**
```bash
# 1. Create an alert
curl -X POST http://localhost:8080/orders/alert -H "X-Api-Key: helloworld" \
  -H "Content-Type: application/json" \
  -d '{"token":"SOL","target_price":150,"direction":"below","from_token":"SOL","to_token":"USDC","amount":1}'

# 2. Trigger it
curl -X POST http://localhost:8080/simulate/price-trigger -H "X-Api-Key: helloworld" \
  -H "Content-Type: application/json" \
  -d '{"token":"SOL","price":140}'
# → Agent is invoked → builds tx → pushes to mobile WS + Expo push

# 3. Reset for next test cycle
curl -X POST http://localhost:8080/simulate/reset -H "X-Api-Key: helloworld"
```

---

### `GET /simulate/prices`

Show current price cache (what the price monitor and tools see).

**Response:**
```json
{ "prices": { "SOL": 185.42, "USDC": 1.0 } }
```

---

### `POST /simulate/push-tx`

Build a real Jupiter swap tx and push it directly — no agent, no alert needed. Use this to test the notification → `AgentTxModal` → signing flow in isolation.

**Prerequisites:** Mobile app must be connected and `POST /device/register` must have been called with a wallet address.

**Response `201`:**
```json
{ "ok": true, "tx_id": "...", "ws_clients_notified": 1, "expires_at": "..." }
```

The amount is hardcoded to 0.01 SOL → USDC (small enough to be safe for testing on mainnet).

---

### `POST /simulate/resend-tx`

Rebuild an expired or stale tx with a fresh Jupiter quote and re-push to all WS clients. Jupiter quotes embed a blockhash that expires in ~90s — use this when the user didn't sign in time.

**Request:**
```json
{ "tx_id": "2e31b14f-..." }
```
Omit body to resend all pending txs.

---

### `POST /simulate/reset`

Reset test state between cycles without restarting the server:
- Flips all `triggered` alerts back to `active`
- Deletes all `pending_signature` txs

**Response:**
```json
{ "ok": true, "alerts_reset": 2, "message": "2 alert(s) back to active, pending txs cleared." }
```

---

## Common Issues & Solutions

### "crypto.getRandomValues() not supported"

**Cause:** React Native (mobile side) lacks a Web Crypto implementation. Not a server issue.

**Solution (mobile):** Import `react-native-quick-crypto` polyfill as the first import in the app entry file.

### Agent produces duplicate signing requests

**Cause:** Price monitor fired twice before the `triggered` status update committed, OR two simultaneous WS clients sent the same prompt.

**Solution:** The agent calls `getPendingSigningRequests` before calling `queueSigningRequest`. If the system prompt is correctly instructing the agent to check first, duplicates should be rare. The `triggered` flag in `price_alerts` prevents the price monitor from re-firing the same alert.

### Jupiter swap build fails: "No route found"

**Cause:** Amount too small (dust), or no liquidity for the token pair at current price.

**Solution:** Use a minimum of 0.01 SOL for test swaps. Ensure token mints are correct (SOL and USDC mainnet mints are hardcoded in `buildTx.ts`).

### WS clients don't receive `tx_signing_request` after `simulate/push-tx`

**Cause:** No WS client is connected (app not open), or the WS connection dropped.

**Solution:** Check `ws_clients_notified` in the response. If `0`, open the app and ensure the WS connection is established (you'll see "connected" in the chat UI). The push notification should have woken the app.

### Agent isn't reasoning correctly / takes wrong action

**Cause:** System prompt or conversation history may not provide enough context.

**Solution:** Check `GET /agent/history` to see what context the agent sees. For autonomous sessions, check server logs for the injected alert context. Adjust `SYSTEM_PROMPT` in `AgentRunner.ts` if the agent's behavior needs tuning.

---

## Resources

### Official Documentation
- [Anthropic API Docs](https://docs.anthropic.com/)
- [Vercel AI SDK — streamText](https://sdk.vercel.ai/docs/ai-sdk-core/generating-text#streamtext)
- [Jupiter V6 Swap API](https://station.jup.ag/docs/apis/swap-api)
- [Fastify WebSocket Plugin](https://github.com/fastify/fastify-websocket)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/sending-notifications/)

### Developer Tools
- [Solana Explorer (Mainnet)](https://explorer.solana.com/)
- [Jupiter Quote Explorer](https://quote-api.jup.ag/v6/quote)
- [wscat](https://github.com/websockets/wscat) — CLI WebSocket client for testing

### Sample Apps
- [Solana Mobile dApp Scaffold](https://github.com/solana-mobile/solana-mobile-dapp-scaffold)
- [Wallet UI SDK](https://github.com/beeman/web3js-expo-wallet-ui)
