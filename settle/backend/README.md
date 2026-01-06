# Settle Backend API

Express.js backend with SQLite3 database for the Settle app (Splitwise clone for Solana Mobile).

## Tech Stack

- **Express.js** - Web framework
- **SQLite3** - Database
- **JWT** - Wallet-based authentication

## Features

- Wallet-based authentication (Solana public key)
- **AllDomains (.skr) domain resolution** - Automatically resolves and displays user-friendly .skr domains
- Groups & expense management
- Friend system
- Balance calculation & settlements
- Activity feed
- Settings management
- Group invitations
- Search functionality

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
- Edit `.env` file if needed (default PORT=3000)
- Change `JWT_SECRET` for production

3. Initialize database:
```bash
npm run init-db
```

4. (Optional) Seed demo data:
```bash
npm run seed  # Only after logging in once
```

5. Start server:
```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```

---

## Project Structure

```
settle/backend/
├── routes/                   # API route definitions
│   ├── auth.js              # Authentication endpoints
│   ├── users.js             # User management endpoints
│   ├── groups.js            # Group management endpoints
│   ├── expenses.js          # Expense management endpoints
│   ├── friends.js           # Friend management endpoints
│   ├── balances.js          # Balance calculation endpoints
│   ├── activity.js          # Activity feed endpoints
│   ├── settings.js          # Settings endpoints
│   ├── invites.js           # Group invitation endpoints
│   └── search.js            # Search endpoints
├── middleware/              # Express middleware
│   └── auth.js              # JWT authentication middleware
├── database/                # Database setup
│   ├── init.js              # Database initialization script
│   └── seed.js              # Demo data seeding script
├── utils/                   # Utility functions
│   └── jwt.js               # JWT token utilities
├── server.js                # Express app entry point
├── settle.db                # SQLite database file (generated)
└── package.json             # Dependencies and scripts
```

---

## API Endpoints

### Authentication
- `POST /api/auth/connect` - Connect wallet (check if user exists)
- `POST /api/auth/complete-profile` - Complete profile for new users
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `POST /api/user/profile-image` - Upload profile image
- `DELETE /api/user/account` - Delete account

### Groups
- `GET /api/groups` - Get all groups
- `GET /api/groups/:id` - Get single group
- `POST /api/groups` - Create group
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group
- `POST /api/groups/:id/leave` - Leave group
- `GET /api/groups/:id/members` - Get group members
- `POST /api/groups/:id/members` - Add member to group

### Expenses
- `GET /api/expenses` - Get all expenses
- `GET /api/expenses/:id` - Get single expense
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense
- `PUT /api/expenses/:id/split` - Adjust split

### Friends
- `GET /api/friends` - Get all friends
- `POST /api/friends` - Add friend
- `DELETE /api/friends/:id` - Remove friend
- `GET /api/friends/search` - Search users

### Balances
- `GET /api/balances` - Get balances
- `POST /api/balances/settle` - Create settlement

### Activity
- `GET /api/activity` - Get activity feed

### Settings
- `GET /api/settings/email` - Get email settings
- `PUT /api/settings/email` - Update email settings

### Invites
- `GET /api/invites/:groupId` - Get invite code
- `POST /api/invites/join` - Join via invite code

### Search
- `GET /api/search/users` - Search users
- `GET /api/search` - Unified search

---

## Key Concepts

### Wallet-Based Authentication

The backend uses Solana public keys as unique user identifiers instead of traditional username/password. When a user connects their wallet, the public key is used to look up or create an account, and a JWT token is issued for subsequent API requests.

**Files:** [routes/auth.js](routes/auth.js), [middleware/auth.js](middleware/auth.js)

### Balance Calculation

Expenses are split among group members with flexible allocation. The backend calculates net balances between users, simplifying complex multi-party debts into direct pairwise settlements. For example, if Alice owes Bob $10 and Bob owes Alice $3, it's simplified to Alice owes Bob $7.

**Files:** [routes/balances.js](routes/balances.js), [routes/expenses.js](routes/expenses.js)

### Settlement Flow

When users pay each other via SOL transfers, the frontend sends the transaction signature to the backend, which records the settlement and updates balances. The backend doesn't verify on-chain transactions but trusts the client to provide valid signatures for activity tracking.

**Files:** [routes/balances.js](routes/balances.js)

### AllDomains (.skr) Domain Resolution

The backend integrates with AllDomains SDK (`@onsol/tldparser`) to automatically resolve user-friendly `.skr` domains for Solana wallet addresses. When a user connects their wallet, the backend:

1. Queries the Solana blockchain for any `.skr` domains associated with the wallet address
2. Stores the resolved domain in the database (`skr_domain` column in users table)
3. Updates the domain on each login if it has changed
4. Returns domain data in all user-related API responses

The frontend then displays the `.skr` domain instead of the raw public key wherever wallet addresses are shown, providing a better user experience similar to ENS domains on Ethereum.

**Tech Stack:**
- `@onsol/tldparser` - AllDomains SDK for .skr domain resolution
- `@solana/web3.js` - Solana blockchain connection

**Files:** [routes/auth.js](routes/auth.js) (domain resolution logic), [db/schema.sql](db/schema.sql) (database schema)

**Configuration:** Set `SOLANA_RPC_ENDPOINT` in `.env` file (defaults to Solana mainnet)

---

## Authentication Flow

1. User connects wallet (provides public key)
2. Backend checks if pubkey exists:
   - **Exists**: Return token + user data
   - **New**: Create user, return token + requiresProfileCompletion flag
3. If new user, frontend shows profile completion screen
4. User submits name (and optional phone)
5. Frontend calls `/api/auth/complete-profile`
6. User is now fully registered

## Database Schema

- **users** - User accounts (pubkey-based auth)
- **groups** - Expense groups
- **group_members** - Group membership
- **friends** - Friend relationships
- **expenses** - Expense records
- **expense_participants** - Split details
- **settlements** - Payment records
- **activities** - Activity feed
- **email_settings** - Notification preferences

## Frontend Integration

Configure the API URL in `frontend/.env`:

```bash
# For Android Emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api

# For Physical Device (replace with your computer's IP)
EXPO_PUBLIC_API_URL=http://192.168.1.x:3000/api
```

**Note:** Expo requires the `EXPO_PUBLIC_` prefix for environment variables to be accessible in the app.

## Development

- Database file: `settle.db`
- Logs: Check console output
- Reset database: `rm settle.db && npm run init-db`

---

## Common Issues

### Error: "Port 3000 already in use"

**Solution:**
1. Change the port in `.env` file: `PORT=3001`
2. Update frontend `.env` to match: `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001/api`
3. Or kill the process using port 3000:
```bash
# Find process
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Error: "SQLITE_BUSY: database is locked"

**Cause:** Multiple connections trying to write to SQLite simultaneously

**Solution:**
1. Close all other database connections
2. Restart the server
3. If persists, delete `settle.db` and reinitialize: `rm settle.db && npm run init-db`

### CORS Errors from Frontend

**Cause:** API URL misconfiguration or CORS headers not set

**Solution:**
1. Verify `EXPO_PUBLIC_API_URL` in `frontend/.env` matches your backend address
2. For Android Emulator: `http://10.0.2.2:3000/api`
3. For Physical Device: `http://<YOUR_COMPUTER_IP>:3000/api`
4. Ensure backend has CORS enabled in `server.js`

### JWT Token Expired

**Solution:** Frontend will automatically refresh by reconnecting wallet. Users just need to authorize again in their wallet app.

---

## Documentation

- **[Root README](../README.md)** - App overview and screenshots
- **[Frontend README](../frontend/README.md)** - React Native app documentation
- **[Frontend TECHNICAL-GUIDE](../frontend/TECHNICAL-GUIDE.md)** - Web3 integration deep dive

---

## Resources

### Official Documentation
- [Express.js Docs](https://expressjs.com/)
- [SQLite3 Docs](https://www.sqlite.org/docs.html)
- [JWT.io](https://jwt.io/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

### Developer Tools
- [Postman](https://www.postman.com/) - API testing
- [DB Browser for SQLite](https://sqlitebrowser.org/) - Database viewer
- [Nodemon](https://nodemon.io/) - Auto-restart on file changes

---

