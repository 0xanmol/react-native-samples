# Web3 Integration Guide - Settle App

> **📖 Deep Dive Documentation**
> This is a comprehensive technical guide explaining all Web3/Solana integration details.
> For quick start instructions, see [README.md](README.md).

This document explains all the Web3/Solana integration steps implemented in the Settle app, with detailed explanations of **why** each decision was made.

## Table of Contents
1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Setup & Prerequisites](#setup--prerequisites)
4. [Wallet Connection](#wallet-connection)
5. [Address Encoding](#address-encoding)
6. [Transaction Signing](#transaction-signing)
7. [Session Persistence](#session-persistence)
8. [Error Handling](#error-handling)
9. [Testing & Development](#testing--development)

---

## Overview
An expense splitting application, similar to Splitwise. Login with wallet, add friends via their phone number or public key, create groups, split expenses, pay using SOL transfer transactions, and view transaction details on the activity page.

---

## Project Structure

The frontend follows a clean, organized structure optimized for React Native development with Expo Router:

```
settle/frontend/
├── app/                      # Expo Router app directory
│   ├── (tabs)/              # Tab-based navigation screens
│   │   ├── _layout.tsx      # Tab layout configuration
│   │   ├── account.tsx      # Account/profile screen
│   │   ├── activity.tsx     # Activity feed screen
│   │   ├── friends.tsx      # Friends list screen
│   │   └── groups.tsx       # Groups list screen
│   ├── activity-detail/     # Dynamic routes
│   │   └── [id].tsx         # Activity detail screen
│   ├── group-detail/
│   │   └── [id].tsx         # Group detail screen
│   ├── _layout.tsx          # Root layout (crypto polyfill here!)
│   ├── login.tsx            # Wallet login screen
│   ├── signup.tsx           # User registration screen
│   ├── add-expense.tsx      # Add expense screen
│   ├── create-group.tsx     # Create group screen
│   ├── settle-up.tsx        # Settle up/payment screen
│   └── ...                  # Other screens
├── utils/                   # Utility functions
│   ├── mwa/                 # MWA utility library (⭐ KEY DIRECTORY)
│   │   ├── useMWA.ts        # Primary hook (unified MWA interface)
│   │   ├── auth.ts          # Auth token caching
│   │   ├── address.ts       # Address conversion utilities
│   │   ├── errors.ts        # Error handling utilities
│   │   ├── transact.ts      # Smart transact wrappers
│   │   ├── types.ts         # TypeScript types
│   │   └── README.md        # API documentation
│   ├── api-client.ts        # HTTP client configuration
│   ├── formatters.ts        # Data formatting utilities
│   └── validators.ts        # Input validation
├── solana/                  # Solana/Web3 integration
│   ├── wallet.ts            # Wallet connection & authorization
│   └── transaction.ts       # SOL transfers & transactions
├── apis/                    # API client functions
│   ├── auth.ts              # Auth & wallet storage APIs
│   ├── expenses.ts          # Expense management APIs
│   ├── groups.ts            # Group management APIs
│   ├── friends.ts           # Friends management APIs
│   ├── activity.ts          # Activity feed APIs
│   └── index.ts             # API exports
├── components/              # Reusable UI components
│   ├── common/              # Generic components (Button, Input, etc.)
│   ├── providers/           # React context providers
│   │   ├── AuthorizationProvider.tsx
│   │   ├── ConnectionProvider.tsx
│   │   └── ThemeProvider.tsx
│   ├── hooks/               # Custom React hooks
│   └── ui/                  # UI-specific components
├── constants/               # App-wide constants
│   ├── wallet.ts            # Wallet/Solana constants
│   ├── colors.ts            # Color palette
│   ├── theme.ts             # Theme configuration
│   └── typography.ts        # Typography settings
├── styles/                  # Screen-specific styles
├── types/                   # TypeScript type definitions
│   └── index.ts             # Shared types
└── assets/                  # Static assets (images, fonts)
```

### Key Directories for Web3 Integration

- **[utils/mwa/](utils/mwa/)**: MWA utility library - Unified API for wallet operations ⭐
  - [useMWA.ts](utils/mwa/useMWA.ts): Primary hook providing all MWA functionality
  - [auth.ts](utils/mwa/auth.ts): Auth token caching and AsyncStorage operations
  - [address.ts](utils/mwa/address.ts): Address format conversion (base64 → base58)
  - [errors.ts](utils/mwa/errors.ts): Error detection and friendly error messages
  - [transact.ts](utils/mwa/transact.ts): Smart transaction wrappers with auto-retry
  - [README.md](utils/mwa/README.md): Complete API documentation

- **[solana/](solana/)**: Solana/Web3 integration
  - [wallet.ts](solana/wallet.ts): Wallet authorization, reauthorization, disconnection
  - [transaction.ts](solana/transaction.ts): SOL transfers, balance checking, USD/SOL conversion

- **[apis/auth.ts](apis/auth.ts)**: Wallet session persistence (delegates to MWA utilities)

- **[app/_layout.tsx](app/_layout.tsx)**: Crypto polyfill setup (MUST be first import!)

- **[constants/wallet.ts](constants/wallet.ts)**: App identity, cluster configuration

---

## Setup & Prerequisites

### Required Dependencies

```bash
npm install @solana/web3.js@1.98.4
npm install @solana-mobile/mobile-wallet-adapter-protocol
npm install @solana-mobile/mobile-wallet-adapter-protocol-web3js
npm install react-native-get-random-values
```

### Critical: Crypto Polyfill Setup

**⚠️ IMPORTANT**: React Native doesn't have `crypto.getRandomValues()` by default, which Solana Web3.js requires.

#### Implementation: `app/_layout.tsx`

```typescript
// MUST be imported FIRST, before any @solana/web3.js imports
import 'react-native-get-random-values';

// Then other imports...
import { Stack } from 'expo-router';
// ...
```

### Why This Is Critical

#### 1. **Order Matters**
**What**: Must be the first import in your root layout
**Why**:
- Polyfills global `crypto` object
- Other modules check for crypto on import
- If imported late, modules already failed their checks
- Can cause random "crypto.getRandomValues() not supported" errors

#### 2. **What Does It Polyfill?**
**What**: Provides `crypto.getRandomValues()` API
**Why Needed**:
- Solana Web3.js uses it for transaction IDs
- UUID generation for request tracking
- Secure random number generation
- Native crypto APIs not available in React Native

#### 3. **Error If Missing**
```
Error: crypto.getRandomValues() not supported.
See https://github.com/uuidjs/uuid#getrandomvalues-not-supported
```

**Symptoms**:
- ✅ Wallet connection works (doesn't need crypto)
- ❌ Transactions fail (needs crypto for blockhash/IDs)
- ❌ getLatestBlockhash() throws error
- ❌ Random crashes when signing

### Native Module Setup

For Solana Mobile Wallet Adapter to work, you need a development build:

```bash
# Generate native projects
npx expo prebuild --clean

# Build for Android
npx expo run:android
```

**Why Not Expo Go**:
- Expo Go doesn't include custom native modules
- Mobile Wallet Adapter requires native Android code
- Must use development build or EAS Build

### Verify Setup

Add this test to confirm polyfill is working:

```typescript
// In any component
console.log('Crypto available:', typeof crypto !== 'undefined');
console.log('getRandomValues available:', typeof crypto?.getRandomValues === 'function');
```

**Expected Output**:
```
Crypto available: true
getRandomValues available: true
```

---

## MWA Utility Library

### Overview

The app includes a custom MWA utility library ([utils/mwa/](utils/mwa/)) that provides a simplified, unified API for Mobile Wallet Adapter operations. This reduces boilerplate code and centralizes common patterns.

### Core Components

#### 1. **useMWA Hook** - [utils/mwa/useMWA.ts](utils/mwa/useMWA.ts)
Primary interface combining all MWA functionality:
- Connection state (`publicKey`, `address`, `connected`)
- Auth methods (`connect()`, `disconnect()`)
- Transaction methods (`signTransaction()`, `signAndSendTransaction()`)
- Utilities (`connection`, `authorization`)

#### 2. **AuthCache** - [utils/mwa/auth.ts](utils/mwa/auth.ts)
Centralized AsyncStorage operations for auth tokens:
- `getToken()` / `setToken()` - Auth token caching
- `getAddress()` / `setAddress()` - Wallet address caching
- `storeWalletAuth()` / `getStoredWalletAuth()` - Combined operations
- `clear()` - Clear all auth data

#### 3. **Address Utilities** - [utils/mwa/address.ts](utils/mwa/address.ts)
Address format conversion and validation:
- `toBase58()` - Convert base64/Uint8Array to base58
- `isValidAddress()` - Validate Solana addresses
- `toPublicKey()` - Convert to PublicKey object
- `shortenAddress()` - Format for display

#### 4. **Error Utilities** - [utils/mwa/errors.ts](utils/mwa/errors.ts)
Centralized error detection and friendly messages:
- `isAuthError()` - Detect auth/token errors
- `isUserRejection()` - Detect user cancellations
- `getFriendlyErrorMessage()` - User-friendly error text
- `MWAError` class - Typed error handling

#### 5. **Transact Wrappers** - [utils/mwa/transact.ts](utils/mwa/transact.ts)
Smart transaction wrappers with auto-retry:
- `transactWithAuth()` - Auth-aware transact wrapper
- `signWithWallet()` - Simplified signing with retry

For complete API documentation, see [utils/mwa/README.md](utils/mwa/README.md).

---

## Wallet Connection

### Implementation: [solana/wallet.ts](solana/wallet.ts)

```typescript
import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey } from '@solana/web3.js';

export const authorizeWallet = async (): Promise<WalletAuthResult> => {
  const authorizationResult = await transact(async (wallet: Web3MobileWallet) => {
    return await wallet.authorize({
      cluster: SOLANA_CLUSTER,
      identity: APP_IDENTITY,
    });
  });

  const pubkey = toBase58(authorizationResult.accounts[0].address);
  return { pubkey, authToken: authorizationResult.auth_token, ... };
};
```

### Why This Approach?

#### 1. **Using `transact()` API**
**What**: Wraps wallet interactions in a session management layer
**Why**:
- Automatically handles wallet app lifecycle (open/close)
- Manages connection state
- Provides error handling for common scenarios (user cancels, no wallet, etc.)

#### 2. **Storing `auth_token`**
**What**: Cache the authorization token from the wallet
**Why**:
- Enables silent reauthorization on app restart
- Avoids prompting user to approve every time
- Creates web2-like UX while maintaining web3 security

#### 3. **Using `cluster` Parameter**
**What**: Specify which Solana network (devnet, testnet, mainnet-beta)
**Why**:
- `devnet`: Free test SOL for development
- `mainnet-beta`: Real SOL for production
- Prevents accidental mainnet transactions during development

```typescript
// constants/wallet.ts
export const SOLANA_CLUSTER = (process.env.EXPO_PUBLIC_SOLANA_CLUSTER || 'devnet') as 'devnet' | 'testnet' | 'mainnet-beta';
```

Configured via `.env`:
```bash
EXPO_PUBLIC_SOLANA_CLUSTER=devnet
```

#### 4. **APP_IDENTITY Configuration**
**What**: Metadata about your app shown in wallet approval dialog
**Why**:
- Users see who's requesting access
- Builds trust and brand recognition
- Required by wallet apps for security

```typescript
export const APP_IDENTITY = {
  name: 'Settle',
  uri: 'https://settle.app',
  icon: 'favicon.ico',
};
```

---

## Address Encoding

### The Problem: Base64 vs Base58

**Discovered Issue**: Wallet adapter was returning addresses in base64 format:
```
W2PUJtIPF4G1j+EsMPd5EHBRVZIa8NhQ9YRDiaolsL8=
```

**Required Format**: Solana uses base58 encoding:
```
7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

### Why Base58 (Not Base64)?

1. **No Ambiguous Characters**: Base58 excludes `0`, `O`, `I`, `l` which look similar
2. **URL-Safe**: No special characters like `+`, `/`, `=`
3. **Human-Readable**: Easier to verify addresses visually
4. **Bitcoin Standard**: Adopted by most blockchain ecosystems

### Solution: Address Conversion

The app uses the `toBase58()` utility from [utils/mwa/address.ts](utils/mwa/address.ts):

```typescript
import { toBase58 } from '@/utils/mwa';

// Convert any address format to base58
const base58Address = toBase58(authorizationResult.accounts[0].address);
```

**Implementation** ([utils/mwa/address.ts](utils/mwa/address.ts)):
```typescript
export function toBase58(address: any): string {
  // If it's a Uint8Array or array-like, convert directly
  if (address instanceof Uint8Array || Array.isArray(address)) {
    const pubkey = new PublicKey(address);
    return pubkey.toBase58();
  }

  // If it's a string with base64 characters (+, /, =)
  if (typeof address === 'string' &&
      (address.includes('+') || address.includes('/') || address.includes('='))) {
    // Decode base64 to bytes
    const binaryString = atob(address);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const pubkey = new PublicKey(bytes);
    return pubkey.toBase58();
  }

  // If already base58, validate and return
  const pubkey = new PublicKey(address);
  return pubkey.toBase58();
}
```

### Why This Implementation?

#### 1. **Using `atob()` Instead of `Buffer`**
**What**: Native JavaScript base64 decoder
**Why**:
- `Buffer` requires polyfills in React Native
- `atob()` is built-in and works everywhere
- Smaller bundle size
- More performant

#### 2. **Manual Byte Array Construction**
**What**: Loop through decoded string to create Uint8Array
**Why**:
- React Native doesn't have direct base64→Uint8Array conversion
- Uint8Array is the standard format for cryptographic operations
- Compatible with `@solana/web3.js` PublicKey constructor

#### 3. **Validation on Every Conversion**
**What**: Always create PublicKey object to validate
**Why**:
- PublicKey constructor validates the address format
- Throws early if address is invalid
- Prevents storing corrupted data in database

---

## Transaction Signing

### Implementation: [solana/transaction.ts](solana/transaction.ts)

```typescript
export const sendSol = async (
  toAddress: string,
  amountInUsd: number
): Promise<SendSolResult> => {
  // 1. Validate addresses
  if (!isValidAddress(toAddress)) {
    throw new Error('Invalid recipient wallet address...');
  }

  // 2. Convert USD to SOL using live price
  const solPriceInUsd = await getSolToUsdRate();
  const amountInSol = convertUsdToSol(amountInUsd, solPriceInUsd);

  // 3. Create connection
  const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');

  // 4. Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  // 5. Create transfer instruction
  const transferInstruction = SystemProgram.transfer({
    fromPubkey,
    toPubkey,
    lamports: Math.floor(amountInSol * LAMPORTS_PER_SOL),
  });

  // 6. Build transaction
  const transaction = new Transaction({
    feePayer: fromPubkey,
    blockhash,
    lastValidBlockHeight,
  }).add(transferInstruction);

  // 7. Sign and send via MWA utility (handles auth and retry automatically)
  const signature = await signWithWallet(
    async (wallet) => {
      const signedTransactions = await wallet.signAndSendTransactions({
        transactions: [transaction],
      });
      return signedTransactions[0];
    },
    {
      cluster: SOLANA_CLUSTER,
      identity: APP_IDENTITY,
      authToken: cachedAuth.authToken,
    }
  );

  // 8. Wait for confirmation
  const confirmation = await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  return { success: true, signature };
};
```

### Why This Flow?

#### 1. **Pre-Flight Address Validation**
**What**: Validate addresses before creating transaction using `isValidAddress()` from utils/mwa
**Why**:
- Prevent wasted RPC calls
- Better error messages for users
- Catch typos early
- Save on transaction fees (no failed txs)

```typescript
import { isValidAddress } from '@/utils/mwa';

// Validates Solana address format (base58, 32-44 characters)
if (!isValidAddress(toAddress)) {
  throw new Error('Invalid recipient wallet address');
}
```

**Implementation** ([utils/mwa/address.ts](utils/mwa/address.ts)):
- Checks address length (32-44 characters for base58)
- Validates format using PublicKey constructor
- Returns boolean (true if valid, false otherwise)

#### 2. **USD to SOL Conversion**
**What**: Fetch live SOL/USD price and convert payment amounts
**Why**:
- Users think in USD, blockchain operates in SOL
- CoinGecko API provides real-time pricing
- Fallback rate (50 USD) if API fails
- Ensures accurate payment amounts

```typescript
// solana/transaction.ts
export const getSolToUsdRate = async (): Promise<number> => {
  const response = await axios.get(COINGECKO_PRICE_API);
  return response.data.solana.usd || 50; // Fallback
};

export const convertUsdToSol = (amountInUsd: number, solToUsdRate: number): number => {
  return amountInUsd / solToUsdRate;
};
```

#### 3. **Using `getLatestBlockhash()`**
**What**: Get recent blockhash for transaction expiry
**Why**:
- Transactions expire after ~150 blocks (~1-2 minutes)
- Prevents replay attacks
- Ensures transaction is recent and valid
- Required for transaction confirmation

#### 4. **Converting SOL to Lamports**
**What**: `lamports = amountInSol * LAMPORTS_PER_SOL`
**Why**:
- Prevents floating-point precision issues
- Native unit for Solana runtime

```typescript
// Good: Using lamports
const lamports = Math.floor(0.001 * LAMPORTS_PER_SOL); // 1,000,000 lamports

// Bad: Using fractional SOL can lose precision
const sol = 0.001; // Might become 0.0009999999
```

#### 5. **SystemProgram.transfer()**
**What**: Built-in Solana instruction for SOL transfers
**Why**:
- Optimized native instruction
- Lower compute units = lower fees
- Simpler than custom programs
- Battle-tested and secure

#### 6. **Setting `feePayer`**
**What**: Specify who pays transaction fees
**Why**:
- Usually the sender pays fees
- Can be different for sponsored transactions
- Required field in transaction structure
- Fees deducted from feePayer's balance

#### 7. **Reusing `auth_token` for Signing**
**What**: Pass cached auth token to wallet
**Why**:
- Silent authorization (no popup for repeated txs)
- Better UX for frequent transactions
- User already approved in initial connection
- Token proves previous authorization

**Auto-Reauthorization Flow**: The app uses the MWA utility library's `signWithWallet()` which automatically handles expired tokens:
```typescript
// solana/transaction.ts - Inside sendSol()
const signature = await signWithWallet(
  async (wallet) => {
    const signedTransactions = await wallet.signAndSendTransactions({
      transactions: [transaction],
    });
    return signedTransactions[0];
  },
  {
    cluster: SOLANA_CLUSTER,
    identity: APP_IDENTITY,
    authToken: cachedAuth.authToken,
  }
);
```

The `signWithWallet()` utility from `utils/mwa/transact.ts`:
- Automatically detects auth errors using `isAuthError()`
- Retries with fresh authorization if token expired
- Eliminates boilerplate retry logic
- Centralizes error handling patterns

**Why Auto-Reauthorization?**:
- Gracefully handles token expiry mid-session
- User doesn't need to manually reconnect wallet
- Seamless experience even after long idle periods
- Reduces friction for returning users

#### 8. **Waiting for Confirmation**
**What**: `confirmTransaction()` before returning success
**Why**:
- Transaction might fail after submission
- Network issues could prevent finalization
- User needs to know actual result
- Prevents showing success for failed transactions

**Commitment Levels**:
```typescript
// 'processed': Fastest, but can be rolled back
// 'confirmed': Most common, good balance
// 'finalized': Slowest but guaranteed (after 32 blocks)
const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
```

---

## Session Persistence

### Implementation

Session persistence is handled by the MWA utility library's `AuthCache` ([utils/mwa/auth.ts](utils/mwa/auth.ts)):

```typescript
import { AuthCache } from '@/utils/mwa';

// Store auth token and address
await AuthCache.storeWalletAuth(authToken, address);

// Retrieve cached session
const cached = await AuthCache.getStoredWalletAuth();
if (cached) {
  console.log('Found session:', cached.address);
}

// Clear on logout
await AuthCache.clear();
```

The `apis/auth.ts` file now delegates to `AuthCache`:

```typescript
// apis/auth.ts
import { AuthCache } from '@/utils/mwa';

export const storeWalletAuth = async (authToken: string, address: string) => {
  return AuthCache.storeWalletAuth(authToken, address);
};

export const getStoredWalletAuth = async () => {
  return AuthCache.getStoredWalletAuth();
};
```

### Why Persist Sessions?

#### 1. **Using AsyncStorage (Not Secure Storage)**
**What**: React Native's key-value storage
**Why**:
- Auth token is NOT a private key (safe to store)
- Private keys stay in wallet app (never exposed)
- Auth token only proves previous authorization
- Can be revoked by wallet at any time
- No sensitive data compromise if stolen

**What We DON'T Store**:
- ❌ Private keys
- ❌ Seed phrases
- ❌ Signing keys

**What We DO Store**:
- ✅ Auth token (revocable session ID)
- ✅ Public address (not sensitive)
- ✅ User preferences

#### 2. **Reauthorization Flow**
**What**: Attempt to reuse cached token on app restart

```typescript
// app/login.tsx
const checkCachedSession = async () => {
  const cachedAuth = await getStoredWalletAuth();
  if (cachedAuth) {
    try {
      const walletAuth = await reauthorizeWallet(cachedAuth.authToken);
      const response = await connectWallet(walletAuth.pubkey);

      if (response.success && !response.data.requiresProfileCompletion) {
        router.replace('/(tabs)/groups'); // Skip login
        return;
      }
    } catch (error) {
      await clearWalletAuth(); // Token expired/invalid
    }
  }
};
```

**Why**:
- Avoids wallet popup on every app open
- Creates web2-like UX
- Wallet can reject if token expired
- Gracefully falls back to full login

#### 3. **Clear on Logout**
**What**: Remove cached credentials when user logs out
**Why**:
- Security best practice
- User expects full disconnect
- Prevents unauthorized access if device shared
- Allows fresh start on next login

---

## Common Issues & Solutions

### Issue: "crypto.getRandomValues() not supported" Error
**Cause**: Missing crypto polyfill for React Native
**Solution**:
1. Install: `npm install react-native-get-random-values`
2. Import as FIRST line in `app/_layout.tsx`: `import 'react-native-get-random-values';`
3. Reload app (may need full rebuild)

**Why It Happens**:
- Wallet connection works (doesn't use crypto)
- Transactions fail (needs crypto for blockhash generation)
- Appears when calling `connection.getLatestBlockhash()`

### Issue: "Non-base58 character" Error
**Cause**: Address is in base64 format
**Solution**: Use the `toBase58()` utility from [utils/mwa/address.ts](utils/mwa/address.ts):
```typescript
import { toBase58 } from '@/utils/mwa';
const base58Address = toBase58(address);
```

### Issue: "Transaction expired" Error
**Cause**: Blockhash too old (>150 blocks)
**Solution**: Get fresh blockhash before each transaction

### Issue: Wallet popup doesn't appear
**Cause**: Native module not linked
**Solution**: Run `npx expo prebuild --clean` and rebuild

### Issue: "Insufficient funds" Error
**Cause**: Not enough SOL for transaction + fees
**Solution**: Check balance first, add buffer for fees (~0.000005 SOL)

---

### Important Constants

Solana configuration is managed through environment variables and [constants/wallet.ts](constants/wallet.ts):

**Environment Variables** (`.env`):
```bash
EXPO_PUBLIC_SOLANA_CLUSTER=devnet
EXPO_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
```

**Constants** ([constants/wallet.ts](constants/wallet.ts)):
```typescript
export const APP_IDENTITY = {
  name: 'Settle',
  uri: 'https://settle.app',
  icon: 'favicon.ico',
};

export const SOLANA_CLUSTER = (process.env.EXPO_PUBLIC_SOLANA_CLUSTER || 'devnet') as 'devnet' | 'testnet' | 'mainnet-beta';
export const SOLANA_RPC_ENDPOINT = process.env.EXPO_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
```
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
