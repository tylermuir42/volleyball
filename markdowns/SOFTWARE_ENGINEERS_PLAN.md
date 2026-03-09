## Southern LA Volleyball Tournament System – Software Engineers' Implementation Plan

**Team**: 2 Software Engineers  
**Duration**: 2 weeks (10 working days)  
**Tech Stack**: Node.js/TypeScript (Express/Fastify), Next.js/TypeScript, PostgreSQL, AWS SDK v3

---

## Overview & Core Responsibilities

As software engineers, your focus is on:

- **Backend**: REST API, database schema & migrations, tournament logic, event publishing
- **Frontend**: Next.js UI for admin/site director/coach views, WebSocket integration
- **Integration**: Connect backend to RDS (local dev first, then AWS)
- **Business Logic**: Standings calculation, seeding algorithms, bracket generation

**Coordinate with cloud engineers on**:

- RDS endpoint and credentials (Week 1)
- EventBridge bus and SNS topics (Week 2+)
- WebSocket API Gateway and Lambda event streaming (Week 2+)

---

## Phase 1: Foundations & Scaffolding (Days 1–2)

### Goals

- Align on architecture, database schema, and project structure
- Set up development environment and scaffolded codebases
- Establish baseline connectivity between backend and local PostgreSQL

### Tasks

#### Database Schema Design

- [ ] Create PostgreSQL schema definition with the following tables:
  - `tournaments` (id, name, date, status)
  - `locations` (id, tournament_id, name, max_courts)
  - `courts` (id, location_id, label)
  - `teams` (id, tournament_id, name, coach_name, coach_email)
  - `pools` (id, tournament_id, location_id, court_id, name)
  - `pool_teams` (id, pool_id, team_id, seed_in_pool)
  - `matches` (id, tournament_id, pool_id, bracket_id, team1_id, team2_id, sets, status, winner_team_id, court_id, start_time)
  - `brackets` (id, tournament_id, name, size, location_id)
  - `bracket_slots` (id, bracket_id, seed, team_id, source_pool_id, source_pool_rank)
  - `duties` (id, match_id, team_id, role, status)
- [ ] Create migration files (use TypeORM, Knex, or raw SQL scripts)
- [ ] Document schema decisions and relationships

#### Backend Scaffolding

- [ ] Initialize Node.js project with TypeScript, ESLint, Prettier
- [ ] Set up Express/Fastify with:
  - Basic project structure: `src/`, `config/`, `migrations/`, `models/`, `routes/`
  - Environment variable handling (.env for local dev, AWS for prod)
  - `/health` endpoint for monitoring
  - Error handling and logging middleware
- [ ] Install key dependencies:
  - `pg` for PostgreSQL driver
  - `@aws-sdk/client-eventbridge` (prepare for Week 2)
  - Testing: Jest or Vitest
- [ ] Set up local PostgreSQL connection and test connectivity

#### Frontend Scaffolding

- [ ] Initialize Next.js project with TypeScript
- [ ] Create basic page structure:
  - `/pages/index.tsx` – Landing/tournament list
  - `/pages/tournaments/[id]/dashboard.tsx` – Tournament admin dashboard
  - `/pages/public/tournaments/[id].tsx` – Public view
- [ ] Set up API client utilities for calling backend
- [ ] Install dependencies: Axios (or Fetch), WebSocket client (ws or socket.io)

#### Coordination

- [ ] Agree on tournament status enum values and state machine
- [ ] Decide on EventBridge event payload structure (standardize with cloud engineers)
- [ ] Define WebSocket message types (SUBSCRIBE_TOURNAMENT, SUBSCRIBE_TEAM, etc.)

### Deliverables by End of Day 2

- PostgreSQL schema in a migration file
- Backend scaffolding with `/health` endpoint returning 200 OK
- Frontend scaffolding with landing page listing mock tournaments
- Both services runnable locally with local PostgreSQL

---

## Phase 2: Core Domain & REST API (Days 3–6)

### Goals

- Implement full CRUD operations for tournaments, pools, teams, and matches
- Calculate standings and enable score submission
- Hook frontend to backend APIs
- **All done WITHOUT EventBridge/WebSockets** (kept simple for now)

### Tasks

#### Database Models & Queries (Backend)

- [ ] Create model/service classes for each entity:
  - `TournamentService`: CRUD, status transitions
  - `LocationService`: CRUD locations and courts
  - `TeamService`: CRUD teams with bulk import
  - `PoolService`: Create pools, auto-assign teams, generate pool matches
  - `MatchService`: CRUD matches, fetch by pool or bracket
  - `StandingsService`: Calculate wins, points differential, rankings
- [ ] Implement database queries using your ORM/query builder

#### REST API Endpoints

- [ ] **Tournament Management**
  - `POST /tournaments` – Create tournament (name, date, initial status = CREATED)
  - `GET /tournaments` – List all tournaments
  - `GET /tournaments/:id` – Get single tournament

- [ ] **Location & Court Management**
  - `POST /tournaments/:id/locations` – Add location to tournament
  - `GET /tournaments/:id/locations` – List locations
  - `POST /tournaments/:id/locations/:locationId/courts` – Add court to location

- [ ] **Team Management**
  - `POST /tournaments/:id/teams` – Create single team
  - `POST /tournaments/:id/teams/bulk` – Bulk import teams (JSON array)
  - `GET /tournaments/:id/teams` – List teams in tournament

- [ ] **Pool Management**
  - `POST /tournaments/:id/pools/auto-assign` – Auto-assign teams to pools and generate matches
    - Input: # of pools, # teams per pool
    - Logic: Randomly distribute teams into pools; generate round-robin matches within each pool
  - `GET /tournaments/:id/pools` – List pools with embedded match schedules

- [ ] **Match & Score Submission**
  - `POST /matches/:id/score` – Submit match score
    - Input: set1_team1, set1_team2, set2_team1, set2_team2, (optional) set3_team1, set3_team2
    - Logic:
      - Validate score (sets must be ≥ 25 points, win by 2)
      - Determine winner
      - Update match status to COMPLETE
      - Recalculate standings for the pool
      - **Stub for EventBridge**: Log event to console (implement in Phase 3)
  - `GET /tournaments/:id/pools/:poolId` – Get pool with standings

#### Standings Calculation Logic

- [ ] Implement `calculateStandings(poolId)` function:
  - For each team in pool: calculate wins, losses, points_for, points_against
  - Sort by: wins (DESC) → points_for (DESC) → points_against (ASC)
  - Assign rank (1, 2, 3, ...) to each team in pool
  - Handle ties gracefully (same rank or describe tie-breaker)
- [ ] Cache standings in DB or calculate on-demand (document your choice)

#### Frontend: Tournament Admin Dashboard

- [ ] Create page `/tournaments/:id/admin` (protected or simple) with:
  - **Tab 1: Setup**
    - Form to create tournament (name, date)
    - Form to add locations
    - Form to add courts to locations
    - Bulk team upload (file or paste JSON)
  - **Tab 2: Pool Play**
    - Pool creation: auto-assign teams to pools
    - List pools with round-robin matches
    - Editable score entry UI for each match
      - Score input fields for sets
      - "Save Score" button calls `POST /matches/:id/score`
      - Confirm score logic (25 points, win by 2)
    - Real-time standings table (polling for now, WebSocket in Phase 3)

#### Frontend: Public Coach View

- [ ] Create page `/public/tournaments/:id` to show:
  - All pools with standings (read-only)
  - Team's next match (pool play)
  - Tournament status

### Deliverables by End of Day 6

- All REST endpoints implemented and tested
- Database fully populated with sample tournament data
- Frontend admin dashboard functional for setup and score submission
- Standings calculation working correctly
- No errors on pool with 3 teams, standard 2-of-3 or best-of-3 sets

---

## Phase 3: Event-Driven Core & Real-Time Updates (Days 7–10)

### Goals

- Integrate AWS SDK v3 EventBridge for event publishing
- Implement WebSocket client in frontend for real-time updates
- Coordinate with cloud engineers on EventBridge bus and WebSocket settings
- Keep the same REST API surface; add event publishing under the hood

### Tasks

#### Backend: EventBridge Integration

- [ ] Install `@aws-sdk/client-eventbridge`
- [ ] Create `EventPublisher` service:
  - Initialize EventBridgeClient with AWS credentials
  - Implement helper to publish events to custom EventBridge bus
- [ ] Update `POST /matches/:id/score` endpoint to publish events:
  - After validating and saving match score:
    - Publish `MatchCompleted` event (detail = {tournamentId, matchId, team1Id, team2Id, winner, sets})
    - Recalculate standings
    - Publish `StandingsUpdated` event (detail = {tournamentId, poolId, standings})
    - Check if all pool matches are complete; if yes, publish `PoolCompleted` event
  - Use AWS SDK EventBridgeClient.putEvents()
- [ ] Document event schema for coordination with cloud engineers

#### Frontend: WebSocket Integration

- [ ] Install WebSocket client library (ws, socket.io, or use native WebSocket)
- [ ] Create WebSocket utility:
  - `useWebSocket` hook or utility function
  - Establish connection to API Gateway WebSocket endpoint (from cloud engineers)
  - Send SUBSCRIBE_TOURNAMENT message on tournament view load
- [ ] Update standings UI to:
  - Listen for `StandingsUpdated` events from WebSocket
  - Update standings table in real-time without manual refresh
- [ ] Update match results UI to:
  - Listen for `MatchCompleted` events from WebSocket
  - Highlight newly completed matches

#### Testing

- [ ] Unit tests for EventPublisher (mock AWS SDK)
- [ ] Unit tests for standings calculation
- [ ] Manual end-to-end test:
  - Create tournament → add teams → auto-assign pools → submit score from one browser → verify live update in another browser (or same page if polling during Phase 3)

### Deliverables by End of Day 10

- Events published to EventBridge on score submission
- Frontend WebSocket client connects and subscribes
- Real-time standings updates working in UI
- Cloud engineers report events received and broadcast to connected clients

---

## Phase 4: Brackets, Multi-Location, and Duties (Days 11–14)

### Goals

- Implement seeding and bracket generation
- Add location/court assignments to brackets
- Implement basic duty assignment (ref/line judge)
- Extend events for bracket generation

### Tasks

#### Team Seeding Algorithm (Backend)

- [ ] Create `SeedingService`:
  - Input: pool, number of teams to seed
  - Output: ordered list of teams (1st, 2nd, 3rd, etc.)
  - Logic:
    1. Sort teams by pool rank (1st place, 2nd, etc.)
    2. Handle 3-team pools: seed 1st and 2nd place; 3rd place goes to lower bracket (if applicable)
    3. Distribute seeds from multiple pools into bracket slots using serpentine seeding (if needed)
  - Test with edge cases: 3-team pools, ties in standings

#### Bracket Generation (Backend)

- [ ] Create `BracketService`:
  - `generateBracket(tournamentId, bracketName, size, location)`:
    - Create bracket record with `size` slots
    - Create BracketSlot records for each seed position
    - Generate bracket match records based on size (4-team, 8-team, 12-team bracket templates)
  - `populateBracketSeeds(bracketId, seeds)`:
    - Assign seeded teams to bracket slots
  - Templates for bracket match generation:
    - 8-team: seed 1 vs 8, 4 vs 5, 2 vs 7, 3 vs 6 (quarterfinals); then semis, finals
- [ ] Add REST endpoint:
  - `POST /tournaments/:id/brackets/generate` – Manual trigger
    - Query all completed pools
    - Run seeding for each bracket (Gold bracket first)
    - Publish `BracketGenerated` event
  - `GET /tournaments/:id/brackets` – List brackets
  - `GET /tournaments/:id/brackets/:bracketId` – Get bracket structure and matches

#### Location & Court Assignment (Backend)

- [ ] Update Match model to support bracket matches
- [ ] Extend `BracketService` to assign:
  - Each bracket to a specific location (populated at bracket creation)
  - Courts within that location to bracket matches (round-robin or fixed)
- [ ] Include location/court info in match records and queries

#### Duty Assignment (Backend)

- [ ] Create `DutyService`:
  - `assignRefDuty(matchId, teamId)`:
    - Create Duty record with role=REF, status=SCHEDULED
  - `assignLineJudgeDuties(matchId, team1, team2)`:
    - Create Duty records for line judges from losing teams or assigned teams
- [ ] Add endpoints:
  - `POST /matches/:id/duties` – Assign duties to a match
  - `GET /matches/:id/duties` – Get duties for a match
  - `GET /tournaments/:id/teams/:teamId/duties` – Get all duties for a team

#### Frontend: Bracket Visualization

- [ ] Create component to display bracket tree:
  - Show slots with team names and seeds
  - Show match results as they complete
  - Highlight user's team's path through bracket
- [ ] Add page `/tournaments/:id/brackets` to list and show brackets
- [ ] Add location/court info to match display:
  - "Court A, Gym 1, 2:30 PM"

#### Frontend: Duties Display

- [ ] Add "My Duties" section to coach view
  - Show upcoming ref/line judge assignments
  - Format: "You ref Team X vs Team Y, Court B, Gym 2, 3:00 PM"

#### Events

- [ ] On bracket generation:
  - Publish `BracketGenerated` event (detail = {tournamentId, brackets[], seededTeams})
- [ ] On duty assignment (optional):
  - Publish `DutyAssigned` event

### Deliverables by End of Day 14

- Seeding algorithm implemented and tested (3-team and standard pools)
- Bracket generation working for 8-team bracket (Gold bracket)
- Fixtures display in UI with location and court info
- Duty assignments show in coach view
- End-to-end flow: Setup → Pool Play (scores) → Bracket Gen → Bracket Play

---

## Development Best Practices

### Code Organization

```
backend/
  src/
    models/          # Database models / entity definitions
    services/        # Business logic (Tournament, Pool, Match, Seeding, Bracket, Duty)
    routes/          # Express route handlers
    middleware/      # Auth, logging, error handling
    utils/           # Helpers (EventPublisher, Db query builders)
    config/          # Environment, constants
    migrations/      # Database migrations

frontend/
  pages/             # Next.js pages
  components/        # Reusable React components
  lib/               # Utilities (API client, WebSocket, hooks)
  styles/            # CSS/Tailwind configs
```

### Testing Strategy

- **Unit Tests**: Services (standings, seeding, bracket generation)
  - Test edge cases: 3 teams, ties, incomplete data
- **Integration Tests**: REST endpoints with real DB (in-memory SQLite or test PostgreSQL)
- **Component Tests**: React components (especially standings table, bracket visualization)
- **Manual E2E**: Full flow on AWS once cloud infrastructure is ready

### Logging

- Structured logging (use a logger like `winston` or `pino`)
- Log all EventBridge publish attempts and API calls
- Log errors with stack traces

### Error Handling

- Return meaningful HTTP status codes (400 for bad input, 404 for not found, 500 for server errors)
- Include error message in response body
- Log all errors with context

### Database Migrations

- Use a migration tool (TypeORM, Knex, or raw SQL with version tracking)
- Never hard-code schema; always version migrations
- Test migrations locally before deploying to AWS

---

## Coordination Checkpoints with Cloud Engineers

- **Day 1 (End of Phase 1)**: Finalize EventBridge event schema and message types
- **Day 6 (Mid Phase 2)**: RDS endpoint and PostgreSQL credentials ready; backend connects to AWS RDS
- **Day 10 (End of Phase 3)**: EventBridge bus created; events being published and received; WebSocket endpoint provided
- **Day 14 (End of Phase 4)**: Lambda broadcast working; real-time updates flowing to all connected clients

---

## Key Decisions & Assumptions

- **Database Driver**: Use `pg` (postgres npm package) for standard PostgreSQL connections from backend
- **EventBridge Approach**: Publish events from REST endpoint; don't wait for external event listeners (keep logic in API)
- **Standings Cache**: Calculate on-demand (not cached) for simplicity; can optimize later if needed
- **Bracket Templates**: Hard-code 8-team bracket first; 4 and 12-team as stretch
- **WebSocket Library**: Recommend `ws` for simplicity; `socket.io` if real-time reliability is critical
- **Frontend Polling Fallback**: If WebSocket is delayed, implement polling (GET standings every 2s) as temporary backup

---

## Stretch Goals (if time permits)

- [ ] Implement 4-team and 12-team bracket templates
- [ ] Add tie-breaker logic (points differential, head-to-head)
- [ ] Add team no-show handling (mark teams as absent, auto-assign wins)
- [ ] Implement bracket rules: Silver, Bronze, Consolation brackets
- [ ] Add email notifications for bracket generation (SNS integration on backend)
- [ ] Implement match rescheduling and court swaps
- [ ] Add performance metrics to demo (response times, live update latency)

---

## Getting Started Immediately

1. **Coordinate with cloud engineers**: Lock in EventBridge schema and RDS endpoint
2. **Set up local dev**:
   ```bash
   npm install
   npm run dev:backend
   npm run dev:frontend
   ```
3. **Start with Phase 1**: Database schema and project scaffolding
4. **Daily standup**: 15-min sync on blockers, RDS/EventBridge readiness, frontend/backend integration points
5. **Use shared GitHub issues** to track tasks and dependencies

---

## Resources & Recommendations

- **Database Design**: Review [12factor.net](https://12factor.net/) for config patterns
- **Node.js Best Practices**: [nodejs.org/en/docs/guides/](https://nodejs.org/en/docs/guides/)
- **AWS SDK v3**: [aws.amazon.com/sdk-for-javascript/](https://aws.amazon.com/sdk-for-javascript/)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)
- **PostgreSQL Admin**: Use pgAdmin or DBeaver for local dev database inspection
