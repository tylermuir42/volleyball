# Backend Quick Start Guide

Get the Express backend running in 5 minutes.

## Step 1: Install Dependencies

```bash
cd backend
npm install
```

## Step 2: Set Up Environment

Create `.env` file in the `backend/` directory:

```bash
# Server
PORT=5000
NODE_ENV=development

# Database (Local PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tournament_db

# OR use individual vars (leave DATABASE_URL empty if using these)
# POSTGRES_HOST=localhost
# POSTGRES_PORT=5432
# POSTGRES_USER=postgres
# POSTGRES_PASSWORD=postgres
# POSTGRES_DB=tournament_db

# AWS/EventBridge (leave empty for Phase 2, needed in Phase 3)
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
EVENTBRIDGE_BUS_NAME=
```

## Step 3: Migrate Database Schema

```bash
npm run db:migrate
```

This:

- Creates all 10 tables (tournaments, pools, matches, etc.)
- Adds views and indexes
- Seeds sample tournament data

**Output should show**:

```
✅ Database schema initialized
✅ Sample tournament seeded
```

## Step 4: Start Development Server

```bash
npm run dev
```

**Output should show**:

```
🚀 Server running on http://localhost:5000
✅ Database connected
```

## Step 5: Test It Works

```bash
curl http://localhost:5000/health
```

**Should return**:

```json
{
  "status": "healthy",
  "database": {
    "connected": true
  },
  "uptime": "0.5s"
}
```

## Done! 🎉

Your backend is running. See `TESTING_GUIDE.md` for endpoint examples.

---

## Common Commands

| Command              | Purpose                          |
| -------------------- | -------------------------------- |
| `npm run dev`        | Start dev server with hot reload |
| `npm run build`      | Compile TypeScript to JavaScript |
| `npm start`          | Start production server          |
| `npm run db:migrate` | Run database migrations          |
| `npm run db:seed`    | Seed sample data                 |
| `npm run db:fresh`   | Drop and recreate database       |

---

## Troubleshooting

### PostgreSQL Not Running

**On macOS** (Homebrew):

```bash
brew services start postgresql@15
```

**On Windows** (PostgreSQL installer):

- Open Services.msc
- Find "postgresql-x64-15"
- Right-click → Start

**On Linux**:

```bash
sudo systemctl start postgresql
```

### Database Connection Failed

Check `.env` file has correct credentials:

```bash
# Test connection
psql -h localhost -U postgres -d tournament_db

# Or check what databases exist
psql -h localhost -U postgres -l
```

### Port 5000 Already in Use

Change PORT in `.env`:

```
PORT=5001
```

Or kill the process using it:

```bash
# macOS/Linux
lsof -i :5000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Windows PowerShell
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Missing Dependencies

```bash
npm install
npm run build
npm run dev
```

---

## Next Steps

1. **Test basic endpoints** → see the testing guide.
2. **Set up frontend** → frontend team creates Next.js app.
3. **Connect frontend to backend** → use API client with base URL `http://localhost:5000`.
4. **Phase 3** → cloud engineers set up EventBridge, add to `.env`.

---

## Architecture Overview

```
HTTP Requests
     ↓
Express Server (src/server.ts)
     ↓
Routes (POST /tournaments, POST /matches/:id/score, etc.)
     ↓
Services (TournamentService, MatchService, etc.)
     ↓
Database Pool (PostgreSQL Connection)
     ↓
Schema (10 tables, views, indexes)
```

All services are in `src/services/` and follow the same pattern. Add new endpoints by:

1. Creating a service method.
2. Adding a route handler in `server.ts`.
3. Testing with curl or Postman.

---

## Database First Time Setup

When you run `npm run db:migrate`, here's what happens:

1. **Creates connection pool** to PostgreSQL.
2. **Reads migration files** from `db/migrations/`.
3. **Executes 001_init_schema.sql** → all 10 tables created.
4. **Executes 002_seed_data.sql** → sample tournament added (1 tournament, 12 teams, 3 pools, 18 matches).
5. **Returns sample data** for testing.

To see the schema in detail, check `SCHEMA_DIAGRAM.md`.

---

## File Structure

```
backend/
├── src/
│   ├── config/         # Environment and database config
│   ├── middleware/     # Error handling, logging
│   ├── routes/         # HTTP endpoint handlers
│   ├── services/       # Business logic (6 services)
│   ├── types/          # TypeScript interfaces
│   └── server.ts       # Express app & startup
├── db/
│   ├── migrations/     # SQL schema files
│   └── README.md       # Database docs
├── .env                # Your local config (GITIGNORED)
├── package.json        # Dependencies and scripts
└── tsconfig.json       # TypeScript config
```

---

## Ready to Code?

- **Backend work** → open `src/`.
- **Type definitions** → edit `src/types/index.ts`.
- **Add new service** → create `src/services/FooService.ts`.
- **Add new endpoint** → add to `server.ts`.
- **Database schema** → edit `db/migrations/*.sql`.

Good luck! 🏐

