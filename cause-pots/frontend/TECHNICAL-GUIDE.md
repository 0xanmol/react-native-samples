# Solana Integration Guide - Cause Pots

> **📖 Deep Dive Documentation**
> This is a comprehensive technical guide explaining all Solana/Anchor integration details.
> For quick start instructions, see [README.md](README.md).

This document explains all the blockchain integration steps implemented in the Cause Pots app, with detailed explanations of **why** each decision was made and **how** to implement similar patterns in your own apps.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup & Prerequisites](#setup--prerequisites)
4. [Mobile Wallet Adapter Integration](#mobile-wallet-adapter-integration)
5. [Anchor Framework & IDL Setup](#anchor-framework--idl-setup)
6. [Program Derived Addresses (PDAs)](#program-derived-addresses-pdas)
7. [Transaction Signing & Authorization](#transaction-signing--authorization)
8. [Multi-Signature Implementation](#multi-signature-implementation)
9. [Time-Lock Mechanisms](#time-lock-mechanisms)
10. [State Management Patterns](#state-management-patterns)
11. [Code Walkthroughs](#code-walkthroughs)
12. [Best Practices & Gotchas](#best-practices--gotchas)
13. [Common Anchor Errors](#common-anchor-errors)
14. [Testing & Development](#testing--development)

---

## Overview

Cause Pots is a decentralized group savings application built on Solana. Users create collaborative savings pots with time-locked funds and multi-signature release mechanisms. This app demonstrates:

- **Time-Locked Smart Contracts**: Funds cannot be released until a specified unlock timestamp
- **Multi-Signature Voting**: M-of-N contributors must approve fund release (e.g., 2 out of 3)
- **Program Derived Addresses (PDAs)**: Deterministic account generation without separate keypairs
- **Anchor Framework**: Type-safe contract interactions with IDL-based code generation
- **Hybrid State**: On-chain (pot accounts, vault accounts) + off-chain (metadata, activity history)
- **Mobile Wallet Adapter**: Secure wallet integration in React Native

**Key Use Case**: A group of friends wants to save for a vacation. They create a pot with a $5000 target, locked until June 2025. All 3 contributors must sign to release funds after the unlock date, preventing premature withdrawals.

---

## Architecture

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Native Frontend                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ UI Components│  │  Zustand     │  │  MWA Wallet      │  │
│  │   (Screens)  │  │  Store       │  │  Adapter         │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         │                  │                    │            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        PotProgram Service (Anchor Integration)       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                              │
         │ API Calls                    │ Blockchain Transactions
         ▼                              ▼
┌──────────────────┐         ┌──────────────────────────┐
│  Express Backend │         │   Solana Blockchain      │
│  ┌────────────┐  │         │  ┌────────────────────┐  │
│  │  SQLite DB │  │         │  │  Anchor Program    │  │
│  │  - Users   │  │         │  │  - create_pot      │  │
│  │  - Pots    │  │         │  │  - contribute      │  │
│  │  - Friends │  │         │  │  - sign_release    │  │
│  │  - Activity│  │         │  │  - release_funds   │  │
│  └────────────┘  │         │  └────────────────────┘  │
└──────────────────┘         │  ┌────────────────────┐  │
                             │  │  PDA Accounts      │  │
                             │  │  - Pot Account     │  │
                             │  │  - Vault Account   │  │
                             │  │  - Contributor     │  │
                             │  └────────────────────┘  │
                             └──────────────────────────┘
```

### Why Hybrid Architecture?

**On-Chain State** (Smart Contract):
- ✅ Pot funds (vault balance)
- ✅ Unlock timestamp (time-lock)
- ✅ Signatures array (who has signed for release)
- ✅ Contributors list (who can contribute/sign)
- ✅ Total contributed amount
- **Why**: Security-critical data that must be tamper-proof

**Off-Chain State** (Backend Database):
- ✅ User profiles and names
- ✅ Friend relationships
- ✅ Activity feed / audit trail
- ✅ Transaction signatures (for Solana Explorer links)
- ✅ Metadata (pot descriptions, categories)
- **Why**: Better UX, faster queries, not security-critical

### Data Flow Example: Creating a Pot

1. **User fills form** in `app/(tabs)/pots/create.tsx`
2. **Frontend validates** inputs (name, target amount, etc.)
3. **Zustand store** saves temporary state
4. **User clicks "Create Pot"**:
   - 4a. **PotProgram.createPot()** → Builds Anchor transaction
   - 4b. **MWA signs** transaction via wallet app
   - 4c. **Transaction submitted** to Solana blockchain
   - 4d. **On success**: Backend API called to save metadata
5. **Backend stores** pot metadata, creates activity record
6. **Frontend refreshes** pots list from backend
7. **Pot appears** in UI with on-chain and off-chain data merged

---

## Setup & Prerequisites

### Required Dependencies

```json
{
  "@coral-xyz/anchor": "^0.32.1",
  "@solana/web3.js": "^1.98.4",
  "@solana/spl-token": "^0.4.13",
  "@solana-mobile/mobile-wallet-adapter-protocol": "^2.2.5",
  "@solana-mobile/mobile-wallet-adapter-protocol-web3js": "^2.2.5"
}
```

### Critical: Crypto Polyfills

**⚠️ IMPORTANT**: React Native lacks `crypto.getRandomValues()` which Solana Web3.js requires for transaction IDs.

**Error without polyfill**:
```
Error: crypto.getRandomValues() not supported
```

**Solution**: Install and import polyfill **FIRST** in root layout:

```bash
npm install react-native-get-random-values buffer
```

`app/_layout.tsx`:
```typescript
// ⚠️ MUST BE FIRST IMPORT - Before any @solana/web3.js imports
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

// Now safe to import Solana modules
import { Stack } from 'expo-router';
// ... rest of imports
```

**Why order matters**:
- Polyfills set up `global.crypto` and `global.Buffer`
- If imported late, other modules already failed their initialization checks
- Web3.js checks for crypto on module load, not runtime

### Native Module Setup

Mobile Wallet Adapter requires native Android code:

```bash
# Generate native Android project
npx expo prebuild --clean

# Build and run
npx expo run:android
```

**Why not Expo Go**:
- Expo Go is a sandbox with pre-built native modules
- MWA requires custom native Android bridge code
- Must use development build or EAS Build for production

### Environment Configuration

`.env` file:
```bash
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api
EXPO_PUBLIC_SOLANA_CLUSTER=devnet
EXPO_PUBLIC_PROGRAM_ID=CTtGEyhWsub71K9bDKJZbaBDNbqNk54fUuh4pLB8M5sR
```

**10.0.2.2 Explained**:
- Android emulator's special IP for host machine's localhost
- Real device? Use your computer's local IP (e.g., `192.168.1.100:3000`)

---

## Mobile Wallet Adapter Integration

### What is Mobile Wallet Adapter (MWA)?

MWA is Solana's standard protocol for mobile wallet integration. It enables:
- ✅ Wallet connection without compromising security
- ✅ Transaction signing without private key exposure
- ✅ Authorization token caching for seamless UX
- ✅ Multi-app support (Phantom, Solflare, etc.)

### Architecture

```typescript
// Provider hierarchy
<ConnectionProvider>
  <AuthorizationProvider>
    <App />
  </AuthorizationProvider>
</ConnectionProvider>
```

### Authorization Provider

`components/auth/auth-provider.tsx`:

```typescript
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

export function AuthProvider({ children }) {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const connect = async () => {
    const result = await transact(async (wallet) => {
      // Request authorization
      const authResult = await wallet.authorize({
        cluster: 'devnet',
        identity: {
          name: 'Cause Pots',
          uri: 'https://causepots.app',
          icon: 'icon.png',
        },
      });

      return {
        authToken: authResult.auth_token,
        accounts: authResult.accounts,
        publicKey: authResult.accounts[0].address,
      };
    });

    setAuthToken(result.authToken);
    setSelectedAccount(result.accounts[0]);

    // Cache token for reauthorization
    await AsyncStorage.setItem('authToken', result.authToken);
  };

  const disconnect = async () => {
    if (authToken) {
      await transact(async (wallet) => {
        await wallet.deauthorize({ auth_token: authToken });
      });
    }
    setAuthToken(null);
    setSelectedAccount(null);
    await AsyncStorage.removeItem('authToken');
  };

  return (
    <AuthContext.Provider value={{ authToken, selectedAccount, connect, disconnect }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Why Authorization Tokens?

**Problem**: Wallet apps don't want to prompt users for every transaction
**Solution**: Issue revocable authorization tokens

**Flow**:
1. First connection: User approves in wallet app → receives auth token
2. Token cached in AsyncStorage
3. Subsequent transactions: Reuse token (no prompt needed)
4. Token expires or revoked: Re-request authorization

**Security**:
- ✅ Token is revocable (not private key)
- ✅ Limited lifetime (wallet app decides)
- ✅ Scoped to specific app (can't use in other apps)
- ✅ User can revoke anytime in wallet settings

### Transaction Signing Hook

`hooks/use-transaction.ts`:

```typescript
export function useTransaction() {
  const { authToken } = useAuth();

  const signAndSendTransaction = async (transaction: Transaction) => {
    if (!authToken) {
      throw new Error('Not authorized');
    }

    return await transact(async (wallet) => {
      // Reauthorize with cached token
      const reauth = await wallet.reauthorize({
        auth_token: authToken,
        identity: { name: 'Cause Pots', uri: 'https://causepots.app' },
      });

      // Sign transaction
      const signedTransactions = await wallet.signTransactions({
        transactions: [transaction],
      });

      // Send to blockchain
      const signature = await connection.sendRawTransaction(
        signedTransactions[0].serialize()
      );

      // Wait for confirmation
      await connection.confirmTransaction(signature);

      return signature;
    });
  };

  return { signAndSendTransaction };
}
```

**Why reauthorize()**:
- Refreshes auth token if expired
- Falls back to authorize() if token invalid
- Maintains seamless UX with automatic retry

---

## Anchor Framework & IDL Setup

### What is Anchor?

Anchor is a framework for Solana smart contracts that provides:
- ✅ Type-safe client-side code generation from IDL
- ✅ Automatic account validation and serialization
- ✅ Built-in error handling with custom error codes
- ✅ Cross-program invocation (CPI) helpers

### IDL (Interface Definition Language)

The IDL is a JSON file describing the smart contract's interface:

```json
{
  "version": "0.1.0",
  "name": "contract",
  "instructions": [
    {
      "name": "createPot",
      "accounts": [
        { "name": "pot", "isMut": true, "isSigner": false },
        { "name": "vault", "isMut": true, "isSigner": false },
        { "name": "authority", "isMut": true, "isSigner": true }
      ],
      "args": [
        { "name": "name", "type": "string" },
        { "name": "targetAmount", "type": "u64" },
        { "name": "unlockTimestamp", "type": "i64" },
        { "name": "signersRequired", "type": "u8" }
      ]
    }
  ],
  "accounts": [
    {
      "name": "PotAccount",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "name", "type": "string" },
          { "name": "description", "type": "string" },
          { "name": "authority", "type": "publicKey" },
          { "name": "targetAmount", "type": "u64" },
          { "name": "totalContributed", "type": "u64" },
          { "name": "unlockTimestamp", "type": "i64" },
          { "name": "signersRequired", "type": "u8" },
          { "name": "signatures", "type": { "vec": "publicKey" } },
          { "name": "contributors", "type": { "vec": "publicKey" } }
        ]
      }
    }
  ]
}
```

### Generating IDL from Contract

```bash
cd contract
anchor build
cp target/idl/contract.json ../frontend/src/contracts/idl.json
```

**When to regenerate**:
- ✅ After modifying contract instructions
- ✅ After changing account structures
- ✅ After updating Anchor version
- ✅ If frontend throws "Unknown instruction" errors

### Anchor 0.32 Breaking Changes

**Problem**: Anchor 0.32 changed IDL format and initialization
**Solution**: Use new `AnchorProvider` and import patterns

`services/pot-program.ts`:
```typescript
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import idl from '../contracts/idl.json';

export class PotProgram {
  private program: Program;

  constructor(connection: Connection, wallet: any) {
    const provider = new AnchorProvider(
      connection,
      wallet,
      { commitment: 'confirmed' }
    );

    this.program = new Program(
      idl as any,
      new PublicKey(process.env.EXPO_PUBLIC_PROGRAM_ID!),
      provider
    );
  }
}
```

**Key Changes**:
- ✅ `AnchorProvider` instead of `Provider`
- ✅ IDL imported as JSON, cast to `any` for typing
- ✅ Program ID from environment variable
- ✅ Commitment level explicit (`confirmed` for mobile)

### Type Generation

Anchor generates TypeScript types from IDL:

```typescript
// Auto-generated from IDL
export type CreatePotParams = {
  name: string;
  description: string;
  targetAmount: BN;  // BigNumber for u64
  unlockTimestamp: BN;  // i64
  signersRequired: number;  // u8
};

export type PotAccount = {
  name: string;
  description: string;
  authority: PublicKey;
  targetAmount: BN;
  totalContributed: BN;
  unlockTimestamp: BN;
  signersRequired: number;
  signatures: PublicKey[];
  contributors: PublicKey[];
};
```

**Why use BN (BigNumber)**:
- JavaScript `number` is 53-bit precision
- Solana u64/i64 are 64-bit integers
- BN prevents overflow/precision loss
- Import: `import { BN } from '@coral-xyz/anchor';`

---

## Program Derived Addresses (PDAs)

### What are PDAs?

PDAs are deterministic addresses derived from seeds, eliminating the need for separate keypairs.

**Traditional Approach** (❌ Don't use):
```typescript
const potKeypair = Keypair.generate();  // Random
// Problem: Must store keypair, manage private keys
```

**PDA Approach** (✅ Recommended):
```typescript
const [potPda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from('pot'), creatorPublicKey.toBuffer(), Buffer.from(potName)],
  programId
);
// Always same address for same seeds!
```

### Benefits of PDAs

1. **Deterministic**: Same seeds → same address every time
2. **No Private Key**: PDAs have no corresponding private key (programs control them)
3. **Collision-Free**: Bump seed ensures uniqueness
4. **Discoverable**: Can recreate address from seeds without storage

### PDA Generation in Cause Pots

`services/pot-program.ts`:

```typescript
export class PotProgram {
  // Derive pot account PDA
  getPotPda(creatorPublicKey: PublicKey, potName: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('pot'),
        creatorPublicKey.toBuffer(),
        Buffer.from(potName),
      ],
      this.program.programId
    );
  }

  // Derive vault account PDA (holds actual SOL)
  getVaultPda(potPda: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), potPda.toBuffer()],
      this.program.programId
    );
  }

  // Derive contributor account PDA
  getContributorPda(potPda: PublicKey, contributorPublicKey: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('contributor'),
        potPda.toBuffer(),
        contributorPublicKey.toBuffer(),
      ],
      this.program.programId
    );
  }
}
```

### PDA Seeds Explained

**Pot Account Seeds**:
- `'pot'` (static string): Namespace to distinguish from other account types
- `creatorPublicKey`: Ensures each creator has unique pots
- `potName`: Ensures creator can have multiple pots with different names

**Vault Account Seeds**:
- `'vault'`: Namespace
- `potPda`: One vault per pot, derived from pot's address

**Contributor Account Seeds**:
- `'contributor'`: Namespace
- `potPda`: Which pot this tracks
- `contributorPublicKey`: Which contributor this tracks

### Bump Seeds

```typescript
const [potPda, bump] = PublicKey.findProgramAddressSync(...);
//          ^^^ address       ^^^ bump (0-255)
```

**What is bump**:
- A single byte (0-255) added to seeds
- `findProgramAddressSync` tries bump=255, 254, 253, ... until valid PDA found
- "Valid PDA" = address that's NOT on the Ed25519 curve (has no private key)

**Why bump needed**:
- Not all seed combinations produce valid PDAs
- Bump guarantees we find a valid one
- First valid bump (highest value) is canonical

**Usage in contract**:
```rust
#[account(
    init,
    payer = authority,
    space = 8 + PotAccount::INIT_SPACE,
    seeds = [b"pot", authority.key().as_ref(), name.as_bytes()],
    bump  // Anchor automatically validates bump
)]
pub pot: Account<'info, PotAccount>,
```

---

## Transaction Signing & Authorization

### Transaction Lifecycle

```
1. Build Transaction
   │
   ▼
2. Get Recent Blockhash
   │
   ▼
3. Sign Transaction (via MWA)
   │
   ▼
4. Send to Blockchain
   │
   ▼
5. Confirm Transaction
   │
   ▼
6. Record Signature (Backend)
```

### Building Transactions with Anchor

`services/pot-program.ts`:

```typescript
export class PotProgram {
  async createPot(params: CreatePotParams): Promise<string> {
    const creatorPublicKey = this.wallet.publicKey;
    const [potPda, potBump] = this.getPotPda(creatorPublicKey, params.name);
    const [vaultPda, vaultBump] = this.getVaultPda(potPda);

    // Build Anchor transaction
    const tx = await this.program.methods
      .createPot(
        params.name,
        params.description,
        new BN(params.targetAmount * LAMPORTS_PER_SOL),
        new BN(params.unlockTimestamp),
        params.signersRequired
      )
      .accounts({
        pot: potPda,
        vault: vaultPda,
        authority: creatorPublicKey,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    // Get fresh blockhash (required for all transactions)
    tx.recentBlockhash = (
      await this.connection.getLatestBlockhash()
    ).blockhash;
    tx.feePayer = creatorPublicKey;

    // Sign and send via MWA
    const signature = await this.signAndSend(tx);

    return signature;
  }
}
```

### Why Recent Blockhash?

**Purpose**: Transactions include recent blockhash to prevent replays

**How it works**:
1. Transaction includes blockhash from last ~150 blocks
2. Validators reject transactions with old blockhashes
3. Prevents someone from replaying your transaction later

**Mobile Best Practice**:
```typescript
// ❌ Don't reuse blockhash
const blockhash = await connection.getLatestBlockhash();
// ... later (>2 minutes)
tx.recentBlockhash = blockhash;  // Might be expired!

// ✅ Get fresh blockhash right before signing
tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
const signature = await signAndSend(tx);
```

**Blockhash Expiration**:
- Valid for ~150 blocks (~60-75 seconds)
- Mobile connections can be slow
- Always fetch fresh before signing

### Handling Transaction Failures

```typescript
async signAndSend(tx: Transaction): Promise<string> {
  try {
    const signature = await transact(async (wallet) => {
      const signed = await wallet.signTransactions({ transactions: [tx] });
      return await this.connection.sendRawTransaction(signed[0].serialize());
    });

    // Wait for confirmation
    const confirmation = await this.connection.confirmTransaction(
      signature,
      'confirmed'  // Not 'finalized' (too slow for mobile)
    );

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    return signature;
  } catch (error) {
    if (error.message.includes('blockhash not found')) {
      // Retry with fresh blockhash
      tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      return this.signAndSend(tx);
    }
    throw error;
  }
}
```

### Commitment Levels

```typescript
'processed'  // Fastest, least secure (not recommended)
'confirmed'  // Good balance for mobile (⭐ recommended)
'finalized'  // Most secure, slowest (~30 seconds)
```

**Mobile Recommendation**: Use `confirmed`
- Fast enough for UX (<2 seconds)
- Secure enough for most use cases
- `finalized` too slow for mobile apps

---

## Multi-Signature Implementation

### How Multi-Sig Works

**Setup**:
1. Creator sets `signersRequired` when creating pot (e.g., 2 out of 3)
2. Contract stores `signatures: Vec<Pubkey>` array in pot account
3. Contributors can vote by calling `sign_release` instruction

**Release Flow**:
```
Time Lock Expires
   │
   ▼
Contributor A signs   →  signatures: [A]
   │
   ▼
Contributor B signs   →  signatures: [A, B]   (2/3 threshold met!)
   │
   ▼
Anyone calls release  →  Funds transferred to recipient
```

### Smart Contract (Rust)

`contract/programs/contract/src/lib.rs`:

```rust
#[derive(Accounts)]
pub struct SignRelease<'info> {
    #[account(
        mut,
        seeds = [b"pot", pot.authority.key().as_ref(), pot.name.as_bytes()],
        bump,
    )]
    pub pot: Account<'info, PotAccount>,

    pub signer: Signer<'info>,
}

pub fn sign_release(ctx: Context<SignRelease>) -> Result<()> {
    let pot = &mut ctx.accounts.pot;
    let signer = ctx.accounts.signer.key();

    // Validate signer is a contributor
    require!(
        pot.contributors.contains(&signer),
        ErrorCode::NotAContributor
    );

    // Prevent double-signing
    require!(
        !pot.signatures.contains(&signer),
        ErrorCode::AlreadySigned
    );

    // Add signature
    pot.signatures.push(signer);

    msg!("Signature added. Total: {}/{}", pot.signatures.len(), pot.signers_required);
    Ok(())
}

pub fn release_funds(ctx: Context<ReleaseFunds>, recipient: Pubkey) -> Result<()> {
    let pot = &ctx.accounts.pot;

    // Check time-lock
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= pot.unlock_timestamp,
        ErrorCode::TimeLockNotExpired
    );

    // Check signatures threshold
    require!(
        pot.signatures.len() >= pot.signers_required as usize,
        ErrorCode::InsufficientSignatures
    );

    // Transfer funds from vault to recipient
    // ... CPI to System Program ...

    Ok(())
}
```

### Frontend Integration

`hooks/use-pot-program.ts`:

```typescript
export function usePotProgram() {
  const program = usePotProgramService();

  const signForRelease = async (potId: string) => {
    const pot = await getPotById(potId);

    // 1. Call blockchain: Add signature on-chain
    const txSignature = await program.signRelease(pot.potPubkey);

    // 2. Call backend: Record signature off-chain
    await api.pots.sign(potId, {
      signerAddress: program.wallet.publicKey.toBase58(),
      transactionSignature: txSignature,
    });

    // 3. Refresh UI
    await refreshPots();
  };

  const releaseFunds = async (potId: string, recipientAddress: string) => {
    const pot = await getPotById(potId);

    // Validate before submitting transaction
    if (pot.signatures.length < pot.signersRequired) {
      throw new Error(`Only ${pot.signatures.length}/${pot.signersRequired} signatures`);
    }

    // Call blockchain to release
    const txSignature = await program.releaseFunds(
      pot.potPubkey,
      new PublicKey(recipientAddress)
    );

    // Update backend
    await api.pots.release(potId, {
      releasedBy: program.wallet.publicKey.toBase58(),
      recipientAddress,
      transactionSignature: txSignature,
    });

    await refreshPots();
  };

  return { signForRelease, releaseFunds };
}
```

### Backend Signature Tracking

`backend/src/routes/pots.ts`:

```typescript
// POST /api/pots/:id/sign - Record signature
router.post('/:id/sign', async (req, res) => {
  const { id } = req.params;
  const { signerAddress, transactionSignature } = req.body;

  const pot = await db.get('SELECT * FROM pots WHERE id = ?', [id]);

  // Parse signatures array
  const signatures = JSON.parse(pot.signatures || '[]');

  // Add new signature
  if (!signatures.includes(signerAddress)) {
    signatures.push(signerAddress);

    await db.run(
      'UPDATE pots SET signatures = ? WHERE id = ?',
      [JSON.stringify(signatures), id]
    );

    // Create activity record
    await db.run(
      'INSERT INTO activities (id, type, pot_id, user_id, transaction_signature, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [uuid(), 'sign_release', id, userId, transactionSignature, new Date().toISOString()]
    );
  }

  res.json({ success: true, signatures });
});
```

### Why Track Both On-Chain and Off-Chain?

**On-Chain** (Smart Contract):
- ✅ Source of truth for fund release
- ✅ Enforces threshold before allowing release
- ✅ Tamper-proof signatures

**Off-Chain** (Backend Database):
- ✅ Fast queries for UI display
- ✅ Transaction signature storage (for Solana Explorer links)
- ✅ Activity feed integration
- ✅ No RPC calls needed to show signature count

---

## Time-Lock Mechanisms

### How Time-Locks Work

**Concept**: Funds cannot be released until a specific Unix timestamp

**Implementation**:

1. **Pot Creation**: Set unlock timestamp
```typescript
const unlockDate = new Date('2025-06-01');
const unlockTimestamp = Math.floor(unlockDate.getTime() / 1000);
//                                                    ^^^ Convert ms to seconds

await program.createPot({
  name: 'Vacation Fund',
  unlockTimestamp: new BN(unlockTimestamp),
  // ...
});
```

2. **Smart Contract Validation**:
```rust
pub fn release_funds(ctx: Context<ReleaseFunds>) -> Result<()> {
    let pot = &ctx.accounts.pot;

    // Get current blockchain time
    let clock = Clock::get()?;

    // Enforce time-lock
    require!(
        clock.unix_timestamp >= pot.unlock_timestamp,
        ErrorCode::TimeLockNotExpired
    );

    // ... rest of release logic
}
```

3. **Frontend UI**:
```typescript
const isPotUnlocked = (pot: Pot): boolean => {
  const now = Math.floor(Date.now() / 1000);
  return now >= pot.unlockTimestamp;
};

// In component:
const canRelease = isPotUnlocked(pot) &&
                   pot.signatures.length >= pot.signersRequired;

<Button
  disabled={!canRelease}
  onPress={() => releaseFunds(pot.id)}
>
  {isPotUnlocked(pot) ? 'Release Funds' : `Locked until ${formatDate(pot.targetDate)}`}
</Button>
```

### Blockchain Time vs. Client Time

**Important**: Always use blockchain time (`Clock::get()`) in smart contracts, not client-provided timestamps.

**Why**:
- ✅ Client clocks can be wrong or manipulated
- ✅ Blockchain time is consensus-based (validators agree)
- ✅ Prevents users from bypassing time-locks

**Solana Clock**:
```rust
let clock = Clock::get()?;
// clock.unix_timestamp = current Unix timestamp (seconds since 1970)
// clock.slot = current slot number
```

**Timestamp Precision**:
- Solana timestamps are in seconds (not milliseconds)
- JavaScript `Date.now()` is in milliseconds
- Always convert: `Math.floor(Date.now() / 1000)`

### Time-Lock + Multi-Sig Combination

**Validation Order**:
1. ✅ Check time-lock expired (`Clock >= unlockTimestamp`)
2. ✅ Check enough signatures (`signatures.len() >= signersRequired`)
3. ✅ Then allow fund release

**Why this order**:
- Time-lock is immutable (blockchain time always progresses)
- Signatures can accumulate while waiting for time-lock
- Prevents early release even with all signatures

---

## State Management Patterns

### Zustand Store Architecture

`store/app-store.ts`:

```typescript
interface AppState {
  // User state
  user: User | null;
  setUser: (user: User | null) => void;

  // Pots state
  pots: Pot[];
  setPots: (pots: Pot[]) => void;
  addPot: (pot: Pot) => void;
  updatePot: (potId: string, updates: Partial<Pot>) => void;

  // Friends state
  friends: Friend[];
  setFriends: (friends: Friend[]) => void;
  addFriend: (friend: Friend) => void;

  // Activities state
  activities: Activity[];
  setActivities: (activities: Activity[]) => void;

  // Loading states
  isLoadingPots: boolean;
  setLoadingPots: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  pots: [],
  setPots: (pots) => set({ pots }),
  addPot: (pot) => set((state) => ({ pots: [pot, ...state.pots] })),
  updatePot: (potId, updates) => set((state) => ({
    pots: state.pots.map((p) => (p.id === potId ? { ...p, ...updates } : p)),
  })),

  friends: [],
  setFriends: (friends) => set({ friends }),
  addFriend: (friend) => set((state) => ({ friends: [friend, ...state.friends] })),

  activities: [],
  setActivities: (activities) => set({ activities }),

  isLoadingPots: false,
  setLoadingPots: (loading) => set({ isLoadingPots: loading }),
}));
```

### Data Synchronization Strategy

**Initial Load** (On App Start):
```typescript
// hooks/useInitializeData.ts
export function useInitializeData() {
  const { user } = useAppStore();
  const { setLoadingPots, setPots, setFriends, setActivities } = useAppStore();

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setLoadingPots(true);

      try {
        // Load from backend API
        const [pots, friends, activities] = await Promise.all([
          api.pots.getAll(user.address),
          api.friends.getAll(),
          api.activities.getAll(user.address),
        ]);

        setPots(pots);
        setFriends(friends);
        setActivities(activities);
      } finally {
        setLoadingPots(false);
      }
    };

    loadData();
  }, [user]);
}
```

**After Blockchain Transaction**:
```typescript
// Optimistic update pattern
const createPot = async (params: CreatePotParams) => {
  // 1. Show loading state
  setLoadingPots(true);

  try {
    // 2. Execute blockchain transaction
    const txSignature = await program.createPot(params);

    // 3. Save metadata to backend
    const pot = await api.pots.create({
      ...params,
      creatorAddress: wallet.publicKey.toBase58(),
      potPubkey: potPda.toBase58(),
      vaultPubkey: vaultPda.toBase58(),
      transactionSignature: txSignature,
    });

    // 4. Optimistically add to store
    addPot(pot);

    // 5. Optionally: Fetch from backend to ensure consistency
    // const updatedPots = await api.pots.getAll(user.address);
    // setPots(updatedPots);

  } finally {
    setLoadingPots(false);
  }
};
```

### Merging On-Chain and Off-Chain Data

**Pattern**: Fetch blockchain accounts and merge with backend metadata

```typescript
async function getPotWithBlockchainData(potId: string): Promise<Pot> {
  // 1. Fetch from backend (fast, includes metadata)
  const potFromBackend = await api.pots.getById(potId);

  // 2. Fetch from blockchain (slow, source of truth for funds/signatures)
  const potAccount = await program.account.potAccount.fetch(
    new PublicKey(potFromBackend.potPubkey)
  );

  // 3. Merge: Backend metadata + Blockchain state
  return {
    ...potFromBackend,  // Name, description, category, createdAt
    totalContributed: potAccount.totalContributed.toNumber() / LAMPORTS_PER_SOL,
    signatures: potAccount.signatures.map((pk) => pk.toBase58()),
    contributors: potAccount.contributors.map((pk) => pk.toBase58()),
    isReleased: potAccount.isReleased,
  };
}
```

**When to fetch blockchain data**:
- ✅ Pot details page (need accurate balance/signatures)
- ✅ Before release transaction (verify threshold met)
- ❌ Pots list page (too slow, use cached backend data)

### Caching Strategy

**Backend stores**:
- Latest known blockchain state (synced after each transaction)
- Updated via backend API after successful transactions

**Frontend caches**:
- Backend data in Zustand store
- Refreshes periodically or on user action (pull-to-refresh)

**Blockchain is source of truth**:
- For critical operations (fund release), always verify on-chain
- Backend data is for UI display only

---

## Code Walkthroughs

### Complete Flow: Creating a Pot

**1. User fills form** (`app/(tabs)/pots/create.tsx`):

```typescript
const CreatePotScreen = () => {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState(new Date());
  const [signersRequired, setSignersRequired] = useState(2);

  const { createPot } = usePotProgram();

  const handleCreate = async () => {
    await createPot({
      name,
      description: '',
      targetAmount: parseFloat(targetAmount),
      unlockTimestamp: Math.floor(targetDate.getTime() / 1000),
      signersRequired,
      currency: 'SOL',
      category: 'Goal',
    });

    router.push('/(tabs)/pots');
  };

  return (
    <View>
      <TextInput value={name} onChangeText={setName} placeholder="Pot Name" />
      <TextInput value={targetAmount} onChangeText={setTargetAmount} placeholder="Target Amount (SOL)" />
      <DatePicker value={targetDate} onChange={setTargetDate} />
      <Picker selectedValue={signersRequired} onValueChange={setSignersRequired}>
        <Picker.Item label="1 of 1" value={1} />
        <Picker.Item label="2 of 2" value={2} />
        <Picker.Item label="2 of 3" value={3} />
      </Picker>
      <Button title="Create Pot" onPress={handleCreate} />
    </View>
  );
};
```

**2. Hook calls service** (`hooks/use-pot-program.ts`):

```typescript
export function usePotProgram() {
  const program = usePotProgramService();
  const { addPot } = useAppStore();

  const createPot = async (params: CreatePotParams) => {
    // Derive PDAs
    const creatorPublicKey = program.wallet.publicKey;
    const [potPda] = program.getPotPda(creatorPublicKey, params.name);
    const [vaultPda] = program.getVaultPda(potPda);

    // Execute blockchain transaction
    const txSignature = await program.createPot(params);

    // Save to backend
    const pot = await api.pots.create({
      ...params,
      creatorAddress: creatorPublicKey.toBase58(),
      potPubkey: potPda.toBase58(),
      vaultPubkey: vaultPda.toBase58(),
    });

    // Update store
    addPot(pot);

    // Save transaction signature to backend
    await api.activities.create({
      type: 'pot_created',
      potId: pot.id,
      userId: pot.creatorAddress,
      transactionSignature: txSignature,
    });

    return pot;
  };

  return { createPot };
}
```

**3. Service builds transaction** (`services/pot-program.ts`):

```typescript
export class PotProgram {
  async createPot(params: CreatePotParams): Promise<string> {
    const creatorPublicKey = this.wallet.publicKey;
    const [potPda] = this.getPotPda(creatorPublicKey, params.name);
    const [vaultPda] = this.getVaultPda(potPda);

    // Build Anchor instruction
    const tx = await this.program.methods
      .createPot(
        params.name,
        params.description,
        new BN(params.targetAmount * LAMPORTS_PER_SOL),
        new BN(params.unlockTimestamp),
        params.signersRequired
      )
      .accounts({
        pot: potPda,
        vault: vaultPda,
        authority: creatorPublicKey,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    // Set blockhash and fee payer
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = creatorPublicKey;

    // Sign via Mobile Wallet Adapter
    const signature = await this.signAndSendTransaction(tx);

    return signature;
  }

  private async signAndSendTransaction(tx: Transaction): Promise<string> {
    return await transact(async (wallet) => {
      // Reauthorize with cached token
      await wallet.reauthorize({
        auth_token: this.authToken,
        identity: APP_IDENTITY,
      });

      // Sign transaction
      const signedTxs = await wallet.signTransactions({
        transactions: [tx],
      });

      // Send to blockchain
      const signature = await this.connection.sendRawTransaction(
        signedTxs[0].serialize(),
        { skipPreflight: false }
      );

      // Confirm
      await this.connection.confirmTransaction(signature, 'confirmed');

      return signature;
    });
  }
}
```

**4. Smart contract creates accounts** (contract/programs/contract/src/lib.rs):

```rust
pub fn create_pot(
    ctx: Context<CreatePot>,
    name: String,
    description: String,
    target_amount: u64,
    unlock_timestamp: i64,
    signers_required: u8,
) -> Result<()> {
    let pot = &mut ctx.accounts.pot;

    // Initialize pot account
    pot.name = name;
    pot.description = description;
    pot.authority = ctx.accounts.authority.key();
    pot.target_amount = target_amount;
    pot.total_contributed = 0;
    pot.unlock_timestamp = unlock_timestamp;
    pot.signers_required = signers_required;
    pot.signatures = Vec::new();
    pot.contributors = vec![ctx.accounts.authority.key()];  // Creator is first contributor
    pot.is_released = false;

    msg!("Pot created: {}", pot.name);
    Ok(())
}
```

---

## Best Practices & Gotchas

### 1. Always Get Fresh Blockhash

**❌ Wrong**:
```typescript
const { blockhash } = await connection.getLatestBlockhash();
// ... user interaction takes 2 minutes ...
tx.recentBlockhash = blockhash;  // Might be expired!
```

**✅ Correct**:
```typescript
// Get blockhash right before signing
tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
const signature = await signAndSend(tx);
```

### 2. Use BN for Large Numbers

**❌ Wrong**:
```typescript
const amount = 1000000000;  // 1 SOL in lamports
program.methods.contribute(amount);  // May lose precision
```

**✅ Correct**:
```typescript
import { BN } from '@coral-xyz/anchor';
const amount = new BN(1000000000);
program.methods.contribute(amount);
```

### 3. Validate PDAs Match

**❌ Wrong**:
```typescript
const [potPda] = program.getPotPda(creator, 'Vacation');
// ... later, typo in name ...
const pot = await program.account.potAccount.fetch(
  program.getPotPda(creator, 'Vacaton')[0]  // Typo! Different PDA!
);
```

**✅ Correct**:
```typescript
// Store PDA, reuse it
const [potPda] = program.getPotPda(creator, potName);

// Create pot
await program.createPot(potPda, ...);

// Fetch pot (use same PDA)
const pot = await program.account.potAccount.fetch(potPda);
```

### 4. Handle MWA Errors Gracefully

**❌ Wrong**:
```typescript
try {
  await signAndSend(tx);
} catch (error) {
  alert('Transaction failed');  // Unhelpful
}
```

**✅ Correct**:
```typescript
try {
  await signAndSend(tx);
} catch (error) {
  if (error.message.includes('User declined')) {
    // User rejected in wallet app
    showToast('Transaction cancelled');
  } else if (error.message.includes('insufficient funds')) {
    showToast('Insufficient SOL balance');
  } else if (error.message.includes('blockhash not found')) {
    // Retry with fresh blockhash
    return retryWithFreshBlockhash(tx);
  } else {
    // Unknown error
    console.error('Transaction error:', error);
    showToast('Transaction failed. Please try again.');
  }
}
```

### 5. Don't Trust Client Time

**❌ Wrong** (in smart contract):
```rust
// Never accept client-provided timestamp
pub fn release_funds(ctx: Context<ReleaseFunds>, timestamp: i64) -> Result<()> {
    require!(timestamp >= pot.unlock_timestamp, ...);  // Client can lie!
}
```

**✅ Correct**:
```rust
pub fn release_funds(ctx: Context<ReleaseFunds>) -> Result<()> {
    let clock = Clock::get()?;  // Use blockchain time
    require!(clock.unix_timestamp >= pot.unlock_timestamp, ...);
}
```

### 6. Commitment Levels Matter

**Slow for Mobile**:
```typescript
await connection.confirmTransaction(signature, 'finalized');  // 30+ seconds
```

**Better for Mobile**:
```typescript
await connection.confirmTransaction(signature, 'confirmed');  // <2 seconds
```

### 7. AsyncStorage is Asynchronous

**❌ Wrong**:
```typescript
const token = AsyncStorage.getItem('authToken');  // Returns Promise!
if (token) { ... }  // Always truthy (Promise object)
```

**✅ Correct**:
```typescript
const token = await AsyncStorage.getItem('authToken');
if (token) { ... }
```

---

## Common Anchor Errors

### Error: "Account does not exist"

**Cause**: PDA not initialized or wrong seeds

**Solution**:
1. Verify PDA seeds match contract
2. Check account was created (view in Solana Explorer)
3. Ensure `init` constraint in contract

### Error: "Cross-program invocation with unauthorized signer"

**Cause**: Missing `invoke_signed` for PDA signer

**Solution** (in contract):
```rust
// Use invoke_signed with PDA seeds
let seeds = &[b"vault", pot.key().as_ref(), &[vault_bump]];
invoke_signed(
    &transfer_ix,
    &[vault.to_account_info(), recipient.to_account_info()],
    &[seeds],
)?;
```

### Error: "Already in use"

**Cause**: PDA already initialized

**Solution**:
- Can't create pot with same name twice
- Use different name or creator
- Or use `init_if_needed` (⚠️ security risk)

### Error: "Invalid instruction data"

**Cause**: Parameter types don't match IDL

**Solution**:
```typescript
// ❌ Wrong types
program.methods.createPot(100, 1234567890, 2)  // Numbers

// ✅ Correct types
program.methods.createPot(
  "Vacation Fund",           // string
  new BN(100 * LAMPORTS_PER_SOL),  // BN for u64
  new BN(1234567890),        // BN for i64
  2                          // number for u8
)
```

---

## Testing & Development

### Testing on Devnet

**Faucet**: Request devnet SOL via app's Account screen

```typescript
const requestAirdrop = async () => {
  const signature = await connection.requestAirdrop(
    wallet.publicKey,
    LAMPORTS_PER_SOL  // 1 SOL
  );
  await connection.confirmTransaction(signature);
};
```

**Rate Limits**:
- Max 1 SOL per request
- Cooldown period between requests
- Use carefully (shared resource)

### Viewing Transactions

**Solana Explorer**:
```
https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet
```

**In App**: Activity feed links to explorer

`components/activity-item.tsx`:
```typescript
<TouchableOpacity
  onPress={() => {
    const url = `https://explorer.solana.com/tx/${activity.transactionSignature}?cluster=devnet`;
    Linking.openURL(url);
  }}
>
  <Text>View on Explorer</Text>
</TouchableOpacity>
```

### Debugging Transactions

**Enable verbose logging**:
```typescript
const signature = await connection.sendRawTransaction(
  tx.serialize(),
  {
    skipPreflight: false,  // Run simulation first
    preflightCommitment: 'confirmed',
  }
);

// Get transaction details
const txDetails = await connection.getTransaction(signature, {
  commitment: 'confirmed',
  maxSupportedTransactionVersion: 0,
});

console.log('Transaction logs:', txDetails?.meta?.logMessages);
```

**Common Log Messages**:
- "Program log: Instruction: CreatePot" - Which instruction executed
- "Program log: Pot created: Vacation Fund" - Custom msg!() from contract
- "Program failed: custom program error: 0x1770" - Error code (check ErrorCode enum)

### Resetting Test Data

**Backend**:
```bash
cd backend
rm -rf data/
npm run init-db
npm run seed  # Optional: Add dummy data
```

**Frontend**:
```bash
# Clear app data
adb shell pm clear com.yourapp.package

# Or via app settings → Clear Data
```

---

## Summary

This guide covered:

- ✅ **Mobile Wallet Adapter**: Secure wallet integration with auth token caching
- ✅ **Anchor Framework**: Type-safe contract interactions with IDL
- ✅ **PDAs**: Deterministic address generation for pots, vaults, and contributors
- ✅ **Multi-Signature**: M-of-N approval voting with on-chain enforcement
- ✅ **Time-Locks**: Blockchain time-based fund locking
- ✅ **State Management**: Hybrid on-chain + off-chain data synchronization
- ✅ **Transaction Signing**: Building, signing, and confirming transactions
- ✅ **Best Practices**: Blockhash freshness, commitment levels, error handling

**Next Steps**:
1. Read the smart contract code: `../contract/programs/contract/src/lib.rs`
2. Explore the PotProgram service: `services/pot-program.ts`
3. Review the backend API: `../backend/src/routes/pots.ts`
4. Try creating a pot and inspecting the transaction on Solana Explorer

For questions or issues, check:
- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Mobile Docs](https://docs.solanamobile.com/)
- [Solana Cookbook](https://solanacookbook.com/)
