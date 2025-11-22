# Domain Expansion

> A modern Solana Name Service lookup app for resolving .skr domain names to wallet addresses and vice versa.

## What is this?

Domain Expansion is a **demo application** showcasing **Solana Name Service (SNS) integration** with React Native mobile apps. It demonstrates bidirectional domain lookup using the Solana blockchain, allowing users to:
- Resolve .skr domain names to Solana wallet addresses
- Reverse lookup wallet addresses to find their associated domain names

## Screenshots & Demo

**Sign In**

| Sign In Screen |
|---|
| ![Sign In](./screenshots/sign-in.png) |

**Main Features**

| Domain Lookup | Address Lookup | Results |
|---|---|---|
| ![Domain Lookup](./screenshots/domain.png) | ![Address Lookup](./screenshots/address.png) | ![Results](./screenshots/results.png) |

**Key Features:**
- 🔐 **Secure Wallet Authentication** - Uses Solana Mobile Wallet Adapter protocol
- 🔍 **Domain → Address Lookup** - Resolve .skr domains to wallet addresses
- 💳 **Address → Domain Lookup** - Find domain names associated with wallet addresses
- 🎨 **Modern UI Design** - Clean, purple-themed interface with hero card layout
- ⚡ **Real-time Search** - Instant results with loading states and error handling
- 📱 **Native Mobile Experience** - Built with Expo for smooth Android/iOS performance

## Project Structure

```
domain-expansion/
└── frontend/     # React Native mobile app
```

## Frontend

**Tech Stack:**
- React Native + Expo (SDK 54)
- TypeScript (Strict mode)
- Expo Router (File-based navigation)
- TanStack React Query (Data fetching)
- Solana Web3.js + Mobile Wallet Adapter
- @onsol/tldparser (Domain resolution)
- Linear Gradients (Modern UI)

**Setup:**
```bash
cd frontend
npm install

# Configure environment (if needed)
# Edit constants/app-config.ts for custom configuration

npx expo prebuild --clean  # Required for native modules
npx expo run:android       # For Android
npx expo run:ios           # For iOS (requires Mac)
```

**Important:** Requires development build due to native dependencies (Solana Mobile Wallet Adapter).

**Documentation:**
- [README.md](frontend/README.md) - Comprehensive setup and usage guide _(Coming soon)_

---

## Quick Start

**1. Clone and Install:**
```bash
cd domain-expansion/frontend
npm install
```

**2. Build and Run:**
```bash
# First time setup
npx expo prebuild --clean

# Run on Android
npx expo run:android

# Run on iOS (Mac only)
npx expo run:ios
```

**3. Test the App:**
- Connect your Solana wallet (e.g., Phantom, Solflare) when prompted
- Try searching for a .skr domain name
- Try reverse lookup with a Solana wallet address

---

## Architecture Highlights

### UI Design Pattern
The app uses a **Hero Card** design pattern:
- **Top 25%**: Purple gradient header with app branding and navigation
- **Bottom 75%**: White content card with rounded top corners containing all interactive elements

### Authentication Flow
- Uses **Solana Mobile Wallet Adapter** for secure wallet connections
- Supports account selection and session persistence with AsyncStorage
- Auto-redirects based on authentication state

### Domain Resolution
- **Forward Lookup**: Domain → Address using TldParser
- **Reverse Lookup**: Address → Domain with .skr TLD support
- 10-second timeout protection for all queries

### State Management
- React Context for global state (Auth, Cluster, Solana connection)
- TanStack React Query for data fetching and caching
- AsyncStorage for persistent auth state

---

## Color Scheme

The app features a modern **purple-themed** design:
- **Primary**: Purple gradient (#9333ea → #a855f7)
- **Secondary**: Light purple accents (#e9d5ff)
- **Background**: Soft gray (#f8fafc)
- **Success**: Green (#10b981)
- **Error**: Red (#ef4444)

---

## Requirements

- Node.js 18+
- npm or yarn
- Android Studio (for Android) or Xcode (for iOS)
- A Solana wallet app installed on your device for testing

---

## License

MIT License - See [LICENSE](../LICENSE) for details
