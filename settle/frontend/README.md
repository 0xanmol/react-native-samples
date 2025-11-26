# Settle - Web3 Expense Splitting App

> An expense splitting application with Solana wallet integration. Login with wallet, add friends, create groups, split expenses, and pay using SOL transfers.

**Tech Stack:** React Native, Expo Router, Solana Mobile Wallet Adapter, Web3.js

📖 **[View Technical Deep Dive →](TECHNICAL-GUIDE.md)**

## Features

- Connect Solana wallet via Mobile Wallet Adapter
- **Display .skr domains** - Shows user-friendly AllDomains (.skr) instead of public keys
- Add friends via phone number or public key
- Create groups and split expenses
- Send SOL payments with automatic USD conversion
- View transaction history

---

## Quick Start

### Prerequisites

- Android device or emulator
- Node.js 18+
- [Mock MWA Wallet](https://github.com/solana-mobile/mobile-wallet-adapter/tree/main/examples/example-clientlib-ktx) installed

### Installation

```bash
# Install dependencies
npm install
```

### Running the App

```bash
# Generate native projects
npx expo prebuild --clean

# Run on Android
npx expo run:android
```

---

## Configuration

### Environment Variables

Create a `.env` file in the frontend directory:

```bash
# API Configuration
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api

# Solana Configuration
EXPO_PUBLIC_SOLANA_CLUSTER=devnet
EXPO_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
```

### Critical Setup: Crypto Polyfill

React Native requires a crypto polyfill for Solana Web3.js. **Import it first** in [app/_layout.tsx](app/_layout.tsx):

```typescript
// MUST be imported FIRST, before any @solana/web3.js imports
import 'react-native-get-random-values';
```

**Why?** Solana Web3.js uses `crypto.getRandomValues()` for transaction IDs. Without this, you'll get:
```
Error: crypto.getRandomValues() not supported
```

---

## Project Structure

```
settle/frontend/
├── app/                      # Expo Router screens
│   ├── (tabs)/              # Tab navigation (groups, friends, activity, account)
│   ├── _layout.tsx          # Root layout (crypto polyfill here!)
│   ├── login.tsx            # Wallet login screen
│   ├── add-expense.tsx      # Add expense screen
│   └── settle-up.tsx        # Payment screen
├── utils/                   # Utility functions
│   └── mwa/                 # MWA utility library ⭐
│       ├── useMWA.ts        # Primary hook (unified MWA interface)
│       ├── auth.ts          # Auth token caching
│       ├── address.ts       # Address conversion utilities
│       ├── errors.ts        # Error handling utilities
│       ├── transact.ts      # Smart transact wrappers
│       ├── types.ts         # TypeScript types
│       └── index.ts         # Main exports
├── solana/                  # Web3 integration
│   ├── wallet.ts            # Wallet connection & authorization
│   └── transaction.ts       # SOL transfers & transactions
├── apis/                    # API client functions
│   └── auth.ts              # Wallet session persistence
├── components/              # Reusable components
│   ├── providers/           # React context providers
│   └── hooks/               # Custom hooks
└── constants/               # App constants
    └── wallet.ts            # Solana configuration
```

---

## Key Concepts

### MWA Utility Library
A unified hook (`useMWA()`) that provides all Mobile Wallet Adapter functionality in one import, replacing 3+ provider hooks and centralizing auth token caching, address conversion, and error handling.

**Files:** [utils/mwa/](utils/mwa/) - See [utils/mwa/README.md](utils/mwa/README.md) for API documentation

### Wallet Connection
Uses Mobile Wallet Adapter's `transact()` API with cached auth tokens for silent reauthorization, creating a web2-like UX while maintaining web3 security.

**Files:** [utils/mwa/useMWA.ts](utils/mwa/useMWA.ts), [utils/mwa/auth.ts](utils/mwa/auth.ts)

### Address Encoding
Wallet adapter returns addresses in base64 format, which are automatically converted to Solana's base58 standard (no ambiguous characters, URL-safe, human-readable).

**Files:** [utils/mwa/address.ts](utils/mwa/address.ts)

### Transaction Signing
SOL payments with automatic USD-to-SOL conversion using live CoinGecko prices. Includes auto-reauthorization and retry logic for expired auth tokens.

**Files:** [solana/transaction.ts](solana/transaction.ts), [utils/mwa/useMWA.ts](utils/mwa/useMWA.ts)

### Session Persistence
Auth tokens are cached in AsyncStorage for seamless reauthorization across app restarts. Private keys never leave the wallet app—only revocable auth tokens and public addresses are stored.

**Files:** [utils/mwa/auth.ts](utils/mwa/auth.ts)

---

## Common Issues

### Error: "crypto.getRandomValues() not supported"

**Solution:**
1. Install: `npm install react-native-get-random-values`
2. Import as **first line** in [app/_layout.tsx](app/_layout.tsx)
3. Rebuild: `npx expo prebuild --clean && npx expo run:android`

### Error: "Non-base58 character"

**Solution:** Address is in base64 format. Use the `toBase58()` utility:
```typescript
import { toBase58 } from '@/utils/mwa';
const base58Address = toBase58(address);
```

**Files:** [utils/mwa/address.ts](utils/mwa/address.ts)

### Error: "Transaction expired"

**Solution:** Blockhash is too old (>150 blocks). Get fresh blockhash before each transaction (already implemented).

### Wallet popup doesn't appear

**Solution:** Native module not linked. Run `npx expo prebuild --clean` and rebuild.

---

## Documentation

- **[utils/mwa/README.md](utils/mwa/README.md)** - MWA Utility Library API reference
- **[TECHNICAL-GUIDE.md](TECHNICAL-GUIDE.md)** - Comprehensive guide explaining all implementation details
- **[Backend README](../backend/README.md)** - API server documentation

---

## Resources

### Official Documentation
- [Solana Mobile Docs](https://docs.solanamobile.com/react-native/overview)
- [Mobile Wallet Adapter Spec](https://github.com/solana-mobile/mobile-wallet-adapter)
- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)

### Developer Tools
- [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet)
- [Solana Faucet](https://faucet.solana.com/)
- [Solana Cookbook](https://solanacookbook.com/)

### Sample Apps
- [Solana Mobile dApp Scaffold](https://github.com/solana-mobile/solana-mobile-dapp-scaffold)
- [Mobile Wallet Adapter Example](https://github.com/solana-mobile/mobile-wallet-adapter/tree/main/examples)

---
