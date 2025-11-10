# Settle

A Web3-enabled expense splitting application, similar to Splitwise. Users can login with their Solana wallet, add friends, create groups, split expenses, and settle up using SOL transfer transactions on the Solana blockchain.

## What is this?

Settle is a **demo application** showcasing how to integrate Solana Mobile Wallet Adapter into a React Native app for real-world use cases like peer-to-peer payments. It combines traditional expense splitting features with blockchain-based settlement.

**Key Features:**
- Wallet-based authentication (Solana Mobile Wallet Adapter)
- Add friends via phone number or public key
- Create expense groups and track shared costs
- Split expenses with flexible allocation
- Pay friends directly with SOL transfers
- View transaction history on Solana blockchain

## Project Structure

```
settle/
├── frontend/     # React Native mobile app
└── backend/      # Express REST API
```

## Frontend

**Tech Stack:**
- React Native + Expo (SDK 52)
- TypeScript
- Expo Router (file-based navigation)
- Solana Mobile Wallet Adapter
- @solana/web3.js v1.98.4

**Setup:**
```bash
cd frontend
npm install

# Configure API URL in .env (defaults to Android Emulator)
# For iOS: Change to EXPO_PUBLIC_API_URL=http://localhost:3000/api

npx expo prebuild --clean  # Required for native modules
npx expo run:android
```

**Important:** Requires a development build (not Expo Go) due to native Solana Mobile Wallet Adapter dependencies.

**Documentation:**
- [README.md](frontend/README.md) - Comprehensive guide to the Solana integration

## Backend

**Tech Stack:**
- Node.js + Express
- SQLite3 (local database)
- JWT authentication (wallet-based)

**Setup:**
```bash
cd backend
npm install
npm run init-db  # Initialize database
npm run seed     # (Optional) Add demo data after user has logged in once
npm start        # Run server on port 3000
```

**API Endpoints:**
- Authentication: `/api/auth/*`
- Users: `/api/users/*`
- Friends: `/api/friends/*`
- Groups: `/api/groups/*`
- Expenses: `/api/expenses/*`
- Activity: `/api/activity/*`
