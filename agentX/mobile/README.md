# Mobile — agentX

> React Native mobile client for agentX. Connects to the agentX server via WebSocket and REST, authenticates with a Solana wallet via Mobile Wallet Adapter, and handles real-time transaction signing requests from the AI agent.

**Tech Stack:** React Native, Expo SDK 54, TypeScript, Mobile Wallet Adapter, Expo Router

**Note:** Android only.

📖 **[View Communication & Architecture Deep Dive →](../server/TECHNICAL-GUIDE.md)**

## Features

- Connect Solana wallet via Mobile Wallet Adapter (MWA)
- Chat UI with real-time streaming — watch the agent think and respond token by token
- Live tool-call indicators ("Fetching price...", "Building swap...")
- Transaction signing modal — approve or decline agent-initiated swaps in-app
- Background push notifications via Expo/FCM (wakes app when agent queues a trade)
- Persistent chat history via session IDs stored in AsyncStorage

---

## Quick Start

### Prerequisites

- Android device or emulator with Google Play Services
- [Android Studio](https://developer.android.com/studio) with an emulator or physical Android device
- Node.js 22+
- agentX server running (see [server/README.md](../server/README.md))

### Installation

```bash
cd mobile
npm install
```

### Configuration

Edit `constants/agent-config.ts`:

```typescript
export const AgentConfig = {
  apiUrl: 'http://<server-ip>:8080',    // Use 10.0.2.2 for Android emulator → host machine
  wsUrl:  'ws://<server-ip>:8080/ws',
  apiKey: '<value of server API_KEY>',
}
```

| Field | Description |
|---|---|
| `apiUrl` | REST base URL for the agentX server |
| `wsUrl` | WebSocket URL (same host, `/ws` path) |
| `apiKey` | Must match `API_KEY` in `server/.env` |

### Running the App

```bash
# Generate native Android project and build (required on first run or after app.json changes)
npx expo prebuild --clean

# Run on Android device or emulator
npx expo run:android
```

**Why not Expo Go?** MWA uses native Android modules that aren't bundled in Expo Go. A development build is required.

---

## Push Notifications Setup

Push notifications use Expo's push service (relayed via Firebase Cloud Messaging) to wake the app when the agent queues a transaction while the app is in the background or killed.

### 1. Add `google-services.json`

`google-services.json` is gitignored — you must provide your own from the Firebase project:

1. Go to [Firebase Console](https://console.firebase.google.com) → your project → **Project Settings → General**
2. Under **Your apps**, select (or add) the Android app with package name `com.agentx` (or whichever is set in `app.json`)
3. Download `google-services.json` and place it at **`mobile/google-services.json`**

This file is required for FCM push notifications to work. Without it, `npx expo prebuild` will fail or notifications will not be delivered.

### 2. One-time EAS setup

```bash
# Log in to Expo
npx eas-cli login

# Link project (writes projectId into app.json)
npx eas-cli init

# Upload FCM V1 credentials
npx eas-cli credentials
# → Android → Google Service Account → upload the service account JSON
#   (Firebase Console → Project Settings → Service Accounts → Generate new private key)
```

The app registers its Expo push token at `POST /device/register` on every launch. No further configuration needed after EAS credentials are set up.

---

## Project Structure

```
mobile/
├── app/                              # Expo Router screens
│   ├── (tabs)/
│   │   └── chat/
│   │       └── index.tsx             # Main chat screen ⭐
│   ├── _layout.tsx                   # Root layout — AgentTxModal overlay
│   ├── index.tsx                     # Entry / splash
│   └── sign-in.tsx                   # Wallet connection screen
├── components/
│   ├── agent/                        # Agent UI components ⭐
│   │   ├── agent-provider.tsx        # WS connection, message state, signing flow
│   │   ├── agent-tx-modal.tsx        # Transaction signing confirmation modal
│   │   ├── agent-input-bar.tsx       # Chat input bar
│   │   ├── agent-message-bubble.tsx  # Chat message rendering
│   │   └── agent-tool-indicator.tsx  # "Thinking..." / tool call spinner
│   ├── auth/
│   │   └── auth-provider.tsx         # Wallet connect / disconnect state
│   ├── notifications/
│   │   └── notification-provider.tsx # Push token registration
│   ├── cluster/                      # Solana cluster selection
│   └── app-providers.tsx             # Root provider composition
├── constants/
│   ├── agent-config.ts               # Server URL, WS URL, API key ⭐
│   └── colors.ts
└── utils/
    ├── lamports-to-sol.ts
    └── ellipsify.ts
```

---

## Key Concepts

### Agent Provider

`components/agent/agent-provider.tsx` manages the entire agent interaction: WebSocket connection lifecycle, incoming message routing, streaming response assembly, and pending transaction state. It maintains a single `pendingTx` slot — only one signing request is shown at a time, preventing modal stacking.

**Files:** [components/agent/agent-provider.tsx](components/agent/agent-provider.tsx)

### Transaction Signing Flow

When the server pushes a `tx_signing_request` WS message, `AgentTxModal` appears with the trade details (token pair, amount, agent's reason). On approval, `signAndSendTransaction` from MWA opens the user's Solana wallet for signing. The returned base58 signature is sent back to the server via a `tx_signed` WS message. On dismissal, a `tx_rejected` message is sent.

**Files:** [components/agent/agent-tx-modal.tsx](components/agent/agent-tx-modal.tsx)

### Session Persistence

A UUID `session_id` is generated on first launch and stored in `AsyncStorage`. It's included in every prompt so the agent maintains full conversation context across app restarts. On reconnect, the app fetches `GET /agent/history` to restore the chat log before opening the WS connection.

**Files:** [components/agent/agent-provider.tsx](components/agent/agent-provider.tsx)

For the full WebSocket protocol and message format, see [server/TECHNICAL-GUIDE.md](../server/TECHNICAL-GUIDE.md).

---

## Common Issues

### Error: Native module not found / wallet doesn't open

**Solution:** Run a full prebuild — native modules must be compiled into the app:

```bash
npx expo prebuild --clean
npx expo run:android
```

Expo Go does not include MWA. A development build is always required.

### App can't reach the server

**Cause:** Using `localhost` instead of the correct host address.

**Solution:**
- Android emulator → host machine: use `10.0.2.2`
- Physical device on same WiFi: use your machine's LAN IP (e.g., `192.168.x.x`)

### Error: `google-services.json` missing or prebuild fails with Firebase error

**Cause:** `google-services.json` is gitignored and must be supplied manually.

**Solution:**
1. Download `google-services.json` from Firebase Console → Project Settings → General → Your apps
2. Place it at `mobile/google-services.json`
3. Re-run `npx expo prebuild --clean && npx expo run:android`

### Push notifications not arriving

**Cause:** EAS credentials not configured or FCM service account not uploaded.

**Solution:**
1. Run `npx eas-cli credentials`
2. Follow prompts to upload the Firebase service account JSON
3. Rebuild the app: `npx expo run:android`

### Transaction signing request not showing after reconnect

**Cause:** The `expires_at` timestamp on the pending tx may have passed (Jupiter quotes expire ~90s after creation).

**Solution:** Use `POST /simulate/resend-tx` on the server to rebuild with a fresh Jupiter quote and re-push the signing request.

---

## Documentation

- **[server/TECHNICAL-GUIDE.md](../server/TECHNICAL-GUIDE.md)** — Full WebSocket protocol, agent architecture, communication flow
- **[Root README](../README.md)** — App overview and quick start
- **[server/README.md](../server/README.md)** — Server API reference and deployment guide

---

## Resources

### Official Documentation
- [Solana Mobile Docs](https://docs.solanamobile.com/react-native/overview)
- [Expo Router Docs](https://docs.expo.dev/router/introduction/)
- [Expo Notifications](https://docs.expo.dev/push-notifications/overview/)

### Developer Tools
- [Solana Explorer (Mainnet)](https://explorer.solana.com/)
- [Jupiter DEX](https://jup.ag/)

### Sample Apps
- [Wallet UI SDK](https://github.com/beeman/web3js-expo-wallet-ui)
- [Solana Mobile dApp Scaffold](https://github.com/solana-mobile/solana-mobile-dapp-scaffold)

---

## License

MIT License — See [LICENSE](../../LICENSE) for details
