# Cause Pots Backend API

Express.js backend server for the Cause Pots application with SQLite3 database.

## Features

- RESTful API for managing pots, friends, and activities
- SQLite3 database for persistent storage
- TypeScript for type safety
- CORS enabled for cross-origin requests
- Automatic database initialization

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and configure as needed:

```bash
cp .env.example .env
```

Edit `.env` to customize your configuration:

```env
PORT=3000
NODE_ENV=development
DB_PATH=./data/cause-pots.db
CORS_ORIGIN=*
```

### 3. Initialize Database

Initialize the database schema:

```bash
npm run init-db
```

This will create all necessary tables and indexes.

### 4. (Optional) Seed Database with Dummy Data

To populate the database with sample data for testing:

```bash
npm run seed
```

This will create:
- 5 friends (Alice, Bob, Charlie, Diana, Eve)
- 8 pots with various categories (Goal, Emergency, Bills, Events, Others)
- Multiple contributions for each pot
- Activity history for all actions

### 5. Start the Server

For development with auto-reload:

```bash
npm run dev
```

For production:

```bash
npm run build
npm start
```

The server will start on `http://localhost:3000` (or the port specified in `.env`)

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

## Data Models

### Pot
```typescript
{
  id: string
  name: string
  description?: string
  creatorAddress: string
  targetAmount: number
  targetDate: string
  currency: 'SOL' | 'USDC'
  category: 'Goal' | 'Emergency' | 'Bills' | 'Events' | 'Others'
  contributors: string[]
  contributions: Contribution[]
  createdAt: string
  isReleased: boolean
  releasedAt?: string
  releasedBy?: string
}
```

### Friend
```typescript
{
  id: string
  publicKey: string
  address: string
  displayName?: string
  addedAt: string
}
```

### Activity
```typescript
{
  id: string
  type: 'pot_created' | 'contribution' | 'release' | 'friend_added'
  timestamp: string
  userId: string
  userName?: string
  potId?: string
  potName?: string
  friendId?: string
  friendAddress?: string
  amount?: number
  currency?: 'SOL' | 'USDC'
}
```

## Development

### Building

```bash
npm run build
```

Compiled JavaScript will be output to the `dist/` directory.

### Database

The SQLite database file will be created at the path specified in `DB_PATH` (default: `./data/cause-pots.db`). The database schema includes:

- `pots` - Stores pot information
- `pot_contributors` - Junction table for pot contributors
- `contributions` - Individual contributions to pots
- `friends` - User friends list
- `activities` - Activity feed

### Scripts

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm run init-db` - Initialize/reset database schema
- `npm run seed` - Populate database with dummy data

## Testing the API

You can test the API using curl, Postman, or any HTTP client:

```bash
# Health check
curl http://localhost:3000/health

# Create a pot
curl -X POST http://localhost:3000/api/pots \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Vacation Fund",
    "description": "Save for summer vacation",
    "creatorAddress": "0x123...",
    "targetAmount": 1000,
    "targetDate": "2025-06-01T00:00:00Z",
    "currency": "SOL",
    "category": "Goal",
    "contributors": []
  }'

# Get all pots
curl http://localhost:3000/api/pots
```

## Notes

- The database uses SQLite3, which stores data in a single file
- All timestamps are stored in ISO 8601 format
- The server automatically initializes the database on startup
- CORS is enabled for all origins by default (configure in `.env` for production)

## Troubleshooting

### Database Errors

If you encounter database errors, try reinitializing:

```bash
rm -rf data/
npm run db:init
```

### Port Already in Use

If port 3000 is already in use, change the `PORT` in `.env` to another value.

## License

MIT
