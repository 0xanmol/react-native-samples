# agentX

> A demo app showing real-time communication between an Android Solana wallet and an autonomous LLM trading agent performing swaps on mainnet.

**Note:** This sample app is for **Android only**.

## What is this?

agentX is a **demo application** showcasing how to build a persistent communication channel between a Solana mobile wallet and an LLM-powered autonomous agent. The user describes a trading strategy in plain English; Claude AI reasons over live market data, builds real Jupiter swap transactions, and pushes them to the phone for approval via Mobile Wallet Adapter.

## Screenshots & Demo

**Login and wallet connection**

| Login | Connect Wallet |
|---|---|
| <img src="https://github.com/user-attachments/assets/LOGIN_URL" alt="Login" height="360" /> | <img src="https://github.com/user-attachments/assets/CONNECT_WALLET_URL" alt="Connect Wallet" height="360" /> |

**Chat with the agent and set a price alert**

| Chat & Price Alert |
|---|
| <img src="https://github.com/user-attachments/assets/CHAT_URL" alt="Chat and Price Alert" height="360" /> |

**Agent fires alert — push notification and transaction signing**

| Push Notification | Sign Transaction | MWA Approval |
|---|---|---|
| <img src="https://github.com/user-attachments/assets/NOTIFICATION_URL" alt="Push Notification" height="360" /> | <img src="https://github.com/user-attachments/assets/SIGN_TX_URL" alt="Sign Transaction" height="360" /> | <img src="https://github.com/user-attachments/assets/MWA_POPUP_URL" alt="MWA Approval" height="360" /> |

**Key Features:**
- Chat-based AI agent — describe trading strategies in plain English ("buy SOL when it drops below $150")
- Real-time agent reasoning streamed token-by-token over WebSocket
- Live tool-call indicators ("Fetching price...", "Building swap...")
- Autonomous price alerts — server monitors SOL every 60s and fires when your target is hit
- Real mainnet swaps built via Jupiter v6 API (serialized VersionedTransactions)
- In-app transaction signing via Mobile Wallet Adapter (MWA)
- Background push notifications via Expo/FCM when the app is closed or killed

## Project Structure

```
agentX/
├── server/     # Node.js AI agent server — Fastify + Claude + PostgreSQL
└── mobile/     # React Native mobile client — Expo + MWA
```

## Server

**Tech Stack:**
- Node.js 22 + Fastify 4
- Claude Sonnet 4.6 (Anthropic SDK + Vercel AI SDK streaming)
- PostgreSQL (sessions, price alerts, pending transactions)
- Jupiter API (mainnet swap quote + transaction building)
- Expo Push / FCM (background wake notifications)

**Setup:**
```bash
# Start Postgres
docker run -d --name agentx-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
psql postgres://postgres:postgres@localhost:5432/postgres -c "CREATE DATABASE agentx;"

# Configure env — set your ANTHROPIC_API_KEY in server/.env
cp server/.env.example server/.env

# Install + run (from repo root)
npm install
npm run dev  # → http://localhost:8080
```

**API Endpoints:**
- Agent: `POST /agent/prompt`, `GET /agent/history`
- Alerts: `POST /orders/alert`, `GET /orders/alerts`, `DELETE /orders/alerts/:id`
- Device: `POST /device/register`
- WebSocket: `ws://<host>:8080/ws`
- Simulate (dev only): `POST /simulate/price-trigger`, `POST /simulate/push-tx`, `POST /simulate/reset`

**Documentation:**
- [server/README.md](server/README.md) — setup, API reference, deployment guide
- [server/TECHNICAL-GUIDE.md](server/TECHNICAL-GUIDE.md) — architecture and communication protocol deep dive

## Mobile

**Tech Stack:**
- React Native + Expo SDK 54
- TypeScript + Expo Router
- Mobile Wallet Adapter (`@wallet-ui/react-native-web3js`)
- Expo Notifications (push token + FCM handling)

**Setup:**
```bash
cd mobile
npm install

# Edit constants/agent-config.ts — set server IP and API key
# Use 10.0.2.2 for Android emulator connecting to host machine

npx expo prebuild --clean
npx expo run:android
```

**Important:** Requires a development build — Expo Go does not include the MWA native module. Android only.

**Documentation:**
- [mobile/README.md](mobile/README.md) — setup, push notifications, signing flow

## Quick Start (All-in-One)

```bash
# Terminal 1 — Server
docker run -d --name agentx-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
psql postgres://postgres:postgres@localhost:5432/postgres -c "CREATE DATABASE agentx;"
cp server/.env.example server/.env
# Edit server/.env — set ANTHROPIC_API_KEY, then:
npm install && npm run dev

# Terminal 2 — Mobile
cd mobile && npm install
# Edit mobile/constants/agent-config.ts — set YOUR_SERVER_IP (use 10.0.2.2 for emulator), then:
npx expo prebuild --clean && npx expo run:android
```

See [server/README.md](server/README.md) and [mobile/README.md](mobile/README.md) for detailed setup.
