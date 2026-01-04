# Cause Pots

A decentralized group savings application built on Solana. Create collaborative savings pots with time-locks and multi-signature release mechanisms to save together with friends and family.

## What is this?

Cause Pots is a **demo application** showcasing how to build a mobile dApp on Solana with Anchor smart contracts. It demonstrates custom program derived addresses (PDAs), transaction construction, .skr domain resolution, and Mobile Wallet Adapter integration through a group savings use case.

## Screenshots & Demo

<!--
TODO: Add screenshots here
To add screenshots, replace the placeholder text below with actual images:
1. Upload screenshots to GitHub (create an issue, drag images, copy URLs)
2. Replace placeholder text with: <img src="URL" alt="Description" height="360" />
-->

**Login and Wallet Connection**

| Welcome Screen | Connect Wallet | Create Profile |
|---|---|---|
| *[Screenshot placeholder]* | *[Screenshot placeholder]* | *[Screenshot placeholder]* |

**Pot Creation and Management**

| Pots List | Create Pot | Pot Details |
|---|---|---|
| *[Screenshot placeholder]* | *[Screenshot placeholder]* | *[Screenshot placeholder]* |

| Add Contribution | Progress View |
|---|---|
| *[Screenshot placeholder]* | *[Screenshot placeholder]* |

**Multi-Signature Release Flow**

| Time-Lock Active | Sign for Release | Release Funds |
|---|---|---|
| *[Screenshot placeholder]* | *[Screenshot placeholder]* | *[Screenshot placeholder]* |

**Friend Management**

| Friends List | Add Friend | Friend Details |
|---|---|---|
| *[Screenshot placeholder]* | *[Screenshot placeholder]* | *[Screenshot placeholder]* |

**Activity Tracking**

| Activity Feed | Activity Details | Blockchain Explorer |
|---|---|---|
| *[Screenshot placeholder]* | *[Screenshot placeholder]* | *[Screenshot placeholder]* |

**Key Features:**
- Time-locked collaborative savings pots
- Multi-signature release approval (M-of-N voting)
- SOL and USDC support
- Friend management with .skr domain resolution
- Complete blockchain transaction history
- Mobile Wallet Adapter integration

## Project Structure

```
cause-pots/
├── frontend/     # React Native mobile app (Expo)
├── backend/      # Express REST API server
└── contract/     # Solana smart contract (Anchor)
```

## Frontend

**Tech Stack:**
- React Native + Expo (SDK 54)
- TypeScript
- Expo Router (file-based navigation)
- Solana Mobile Wallet Adapter
- Anchor Framework (0.32)
- @solana/web3.js v1.98.4

**Setup:**
```bash
cd frontend
npm install

# Configure environment (create .env file)
# EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api
# EXPO_PUBLIC_SOLANA_CLUSTER=devnet
# EXPO_PUBLIC_PROGRAM_ID=CTtGEyhWsub71K9bDKJZbaBDNbqNk54fUuh4pLB8M5sR

npx expo prebuild --clean  # Required for native modules
npx expo run:android
```

**Important:** Requires a development build (not Expo Go) due to native Solana Mobile Wallet Adapter dependencies.

**Documentation:**
- [README.md](frontend/README.md) - Setup and configuration guide
- [TECHNICAL-GUIDE.md](frontend/TECHNICAL-GUIDE.md) - Comprehensive Solana/Anchor integration deep dive

## Backend

**Tech Stack:**
- Node.js + Express
- SQLite3 (local database)

**Setup:**
```bash
cd backend
npm install
npm run init-db  # Initialize database
npm start        # Run server on port 3000
```

**API Endpoints:**
- Users: `/api/users/*`
- Pots: `/api/pots/*`
- Friends: `/api/friends/*`
- Activities: `/api/activities/*`

**Documentation:**
- [README.md](backend/README.md) - Complete API documentation

## Contract

**Tech Stack:**
- Anchor Framework 0.32
- Rust

**Deployed Program:**
- Devnet: `CTtGEyhWsub71K9bDKJZbaBDNbqNk54fUuh4pLB8M5sR`

**Setup:**
```bash
cd contract
anchor build
anchor test
anchor deploy --provider.cluster devnet  # Optional: deploy your own instance
```

**Documentation:**
- [README.md](contract/README.md) - Smart contract specification and testing
