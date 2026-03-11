# Backend Scaffolding Complete ✅

Comprehensive Express/TypeScript backend with services, routes, middleware, and configuration has been scaffolded.

## Files Created

### Configuration

- `src/config/env.ts` – Environment variable loading with validation
- `src/config/database.ts` – PostgreSQL connection pool management

### Middleware

- `src/middleware/errorHandler.ts` – Error handling, HTTP error classes, async wrapper
- `src/middleware/logging.ts` – Request logging and structured logging utility

### Types & Domain Models

- `src/types/index.ts` – TypeScript interfaces for all entities

### Services (Business Logic Layer)

- `src/services/TournamentService.ts` – Tournament CRUD and lifecycle
- `src/services/LocationService.ts` – Location and court management
- `src/services/TeamService.ts` – Team registration and bulk import
- `src/services/PoolService.ts` – Pool creation and team auto-assignment
- `src/services/MatchService.ts` – Match queries and score submission with validation
- `src/services/StandingsService.ts` – Real-time standings queries from DB view

### Routes

- `src/routes/health.ts` – Health check endpoints (/health, /health/ready, /health/live)

### Main Application

- `src/server.ts` – Complete Express app with all routes, middleware, startup logic

## Architecture Overview

```
src/
├── config/
│   ├── env.ts              # Environment variables
│   └── database.ts         # PostgreSQL pool
├── middleware/
│   ├── errorHandler.ts     # Error handling
│   └── logging.ts          # Request/event logging
├── types/
│   └── index.ts            # TypeScript types
├── services/
│   ├── TournamentService.ts
│   ├── LocationService.ts
│   ├── TeamService.ts
│   ├── PoolService.ts
│   ├── MatchService.ts
│   └── StandingsService.ts
├── routes/
│   └── health.ts
└── server.ts               # Main app
```

## REST API Endpoints (Phase 2 Ready)

### Tournaments

- `POST /tournaments` – Create tournament
- `GET /tournaments` – List all tournaments
- `GET /tournaments/:id` – Get tournament
- `GET /tournaments/:id/overview` – Get tournament stats

### Locations & Courts

- `POST /tournaments/:id/locations` – Add location
- `GET /tournaments/:id/locations` – List locations
- `POST /locations/:id/courts` – Add court
- `GET /locations/:id/courts` – List courts

### Teams

- `POST /tournaments/:id/teams` – Create team
- `POST /tournaments/:id/teams/bulk` – Bulk import teams
- `GET /tournaments/:id/teams` – List teams

### Pools & Matches

- `POST /tournaments/:id/pools/auto-assign` – Auto-assign teams to pools
- `GET /tournaments/:id/pools` – List pools with standings & matches
- `GET /pools/:id` – Get pool details
- `GET /matches/:id` – Get match
- `POST /matches/:id/score` – Submit score

### Standings

- `GET /tournaments/:id/standings` – Get all standings

### Health

- `GET /health` – System health
- `GET /health/ready` – Readiness probe
- `GET /health/live` – Liveness probe

## Key Features

✅ **Structured Services Layer** – business logic separated from routes  
✅ **Type Safety** – complete TypeScript interfaces for all entities  
✅ **Error Handling** – centralized error middleware with HTTP error classes  
✅ **Database Management** – connection pooling with health checks  
✅ **Configuration** – environment variables with validation  
✅ **Logging** – request logging and structured event logging  
✅ **Async Handlers** – automatic error catching for async routes  
✅ **Volleyball Rules** – score validation (25 points, win by 2)  
✅ **Transaction Support** – pool service uses explicit transactions

## How to Run

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Run Database Migrations

```bash
npm run db:migrate
```

### 4. Start Development Server

```bash
npm run dev
```

### 5. Test Health Endpoint

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-03-06T...",
  "database": {
    "connected": true
  },
  "uptime": 2.5
}
```

## Service Usage Examples

### Create Tournament

```bash
curl -X POST http://localhost:5000/tournaments \
  -H "Content-Type: application/json" \
  -d '{"name": "Spring Tournament", "date": "2026-03-21"}'
```

### Create Team

```bash
curl -X POST http://localhost:5000/tournaments/1/teams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Team A",
    "coach_name": "John Doe",
    "coach_email": "john@example.com"
  }'
```

### Bulk Import Teams

```bash
curl -X POST http://localhost:5000/tournaments/1/teams/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "teams": [
      {"name": "Team 1", "coach_name": "Coach 1"},
      {"name": "Team 2", "coach_name": "Coach 2"},
      {"name": "Team 3", "coach_name": "Coach 3"}
    ]
  }'
```

### Auto-Assign Teams to Pools

```bash
curl -X POST http://localhost:5000/tournaments/1/pools/auto-assign \
  -H "Content-Type: application/json" \
  -d '{
    "num_pools": 3,
    "teams_per_pool": 4,
    "location_id": 1,
    "court_id": 1
  }'
```

### Submit Match Score

```bash
curl -X POST http://localhost:5000/matches/1/score \
  -H "Content-Type: application/json" \
  -d '{
    "set1_team1": 25,
    "set1_team2": 20,
    "set2_team1": 25,
    "set2_team2": 22
  }'
```

## Configuration (.env)

```env
# Server
PORT=5000
NODE_ENV=development
LOG_LEVEL=info

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=tournament_db
DB_POOL_SIZE=10

# OR use connection string
# DATABASE_URL=postgresql://user:pass@host:port/db

# AWS (for EventBridge, Phase 3)
AWS_REGION=us-west-2
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
EVENTBRIDGE_BUS_NAME=volleyball-events
```

## Next Steps

### Phase 2 Progress

- [x] Scaffolding complete
- [x] All service classes implemented
- [x] All routes defined
- [x] Error handling middleware
- [ ] Test all endpoints locally
- [ ] Fix any integration issues
- [ ] Document API with examples

### Phase 3 (EventBridge)

- Add EventPublisher service
- Update score submission endpoint to publish events
- Wire up tournament status updates

### For Frontend Team

APIs are ready! Integrate Next.js frontend with:

- `POST /tournaments`
- `POST /tournaments/:id/teams`
- `POST /tournaments/:id/pools/auto-assign`
- `POST /matches/:id/score`
- `GET /tournaments/:id/pools`
- `GET /tournaments/:id/standings`

## Testing Checklist

- [ ] Health endpoint returns 200 OK
- [ ] Create tournament and verify in database
- [ ] Create location and courts
- [ ] Bulk import teams
- [ ] Auto-assign teams to pools
- [ ] Verify round-robin matches generated
- [ ] Submit match score with valid volleyball rules
- [ ] Check standings updated correctly
- [ ] Try invalid score (should get 422 validation error)
- [ ] Check database connections work

## Known Todos

1. **EventBridge Integration** (Phase 3)
   - Create EventPublisher service.
   - Publish events on score submission, pool completion.
   - Wire to match score endpoint.

2. **Bracket Service** (Phase 4)
   - Implement seeding algorithm.
   - Bracket generation from pools.
   - Bracket match creation.

3. **Duty Service** (Phase 4)
   - Duty assignment.
   - Ref and line judge management.

4. **Testing**
   - Unit tests for services.
   - Integration tests for endpoints.
   - E2E tests for flows.

---

**Status**: Backend scaffolding complete. Ready for Phase 2 (REST API testing and refinement).

