# Cause Pots Backend API

Express.js REST API server with SQLite3 database for the Cause Pots demo application.

**Features:**
- RESTful API for managing pots, friends, and activities
- Multi-signature release approval tracking
- Transaction signature storage for blockchain audit trail
- SQLite3 database for persistent storage
- TypeScript for type safety

## Setup

```bash
npm install
npm run init-db  # Initialize database schema
npm start        # Run server on port 3000
```

**Optional:** Seed with dummy data for testing
```bash
npm run seed
```

**Environment Variables** (create `.env` file):
```env
PORT=3000
DB_PATH=./data/cause-pots.db
```

## API Endpoints

### Health Check

- `GET /health` - Check server and database health
- `GET /` - API information

### Pots

- `POST /api/pots` - Create a new pot
- `GET /api/pots` - Get all pots
- `GET /api/pots?userAddress=...` - Get pots for a specific user
- `GET /api/pots/:id` - Get pot by ID
- `PATCH /api/pots/:id` - Update pot details
- `DELETE /api/pots/:id` - Delete a pot
- `POST /api/pots/:id/contributors` - Add contributor to pot
- `DELETE /api/pots/:id/contributors/:address` - Remove contributor from pot
- `POST /api/pots/:id/contributions` - Add contribution to pot
- `DELETE /api/pots/:id/contributions/:contributionId` - Remove contribution
- `POST /api/pots/:id/sign` - Sign for pot release (multi-signature approval)
- `POST /api/pots/:id/release` - Release pot funds

### Friends

- `POST /api/friends` - Add a friend
- `GET /api/friends` - Get all friends
- `GET /api/friends/:id` - Get friend by ID
- `GET /api/friends?address=...` - Get friend by address
- `PATCH /api/friends/:id` - Update friend (e.g., display name)
- `DELETE /api/friends/:id` - Remove a friend

### Activities

- `GET /api/activities` - Get all activities
- `GET /api/activities?userAddress=...` - Get activities for a user
- `GET /api/activities?potId=...` - Get activities for a pot
- `POST /api/activities/:id/read` - Mark activity as read

**Note**: Activities include `transaction_signature` field containing Solana blockchain transaction signatures for audit trail and Solana Explorer integration.

## Project Structure

```
backend/
├── src/
│   ├── db/
│   │   ├── database.ts       # Database connection and methods
│   │   ├── init.ts           # Database initialization script
│   │   └── schema.sql        # Database schema
│   ├── routes/
│   │   ├── pots.ts           # Pot endpoints
│   │   ├── friends.ts        # Friend endpoints
│   │   └── activities.ts     # Activity endpoints
│   ├── types/
│   │   └── index.ts          # TypeScript type definitions
│   └── index.ts              # Main server file
├── data/                     # Database files (auto-created)
├── .env.example              # Example environment variables
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## Database Schema

**Tables:**
- `pots` - Pot information with multi-sig tracking
- `pot_contributors` - Junction table for contributors
- `contributions` - Individual contributions
- `friends` - User friends list
- `activities` - Activity feed with transaction signatures

## Scripts

- `npm run dev` - Development server with auto-reload
- `npm run build` - Compile TypeScript
- `npm start` - Production server
- `npm run init-db` - Initialize/reset database
- `npm run seed` - Add dummy data

## Notes

- SQLite3 database stored at `./data/cause-pots.db`
- Transaction signatures link to Solana blockchain for audit trail
- Multi-signature approvals tracked both on-chain and off-chain
