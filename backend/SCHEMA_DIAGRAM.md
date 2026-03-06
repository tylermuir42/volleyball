# Database Schema Diagram

## Entity Relationship Diagram (Text Format)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TOURNAMENTS (1)                                    │
│                                                                             │
│  - id (PK)                    - name                                        │
│  - date                        - status (CREATED → COMPLETE)               │
│  - created_at                  - updated_at                                │
└────────┬──────────────────────────────────────┬──────────────────┬─────────┘
         │ (1:N)                                │ (1:N)            │ (1:N)
         │                                      │                  │
    ┌────▼─────────┐                ┌──────────▼──────┐    ┌──────▼────────┐
    │ LOCATIONS    │                │ TEAMS           │    │ BRACKETS      │
    │              │                │                 │    │               │
    │ - id (PK)    │                │ - id (PK)       │    │ - id (PK)     │
    │ - name       │                │ - name          │    │ - name        │
    │ - max_courts │                │ - coach_name    │    │ - size (4,8,12)
    │              │                │ - coach_email   │    │ - status      │
    └────┬─────────┘                └────────┬────────┘    └──────┬────────┘
         │ (1:N)                             │                    │ (1:N)
         │                                   │                    │
    ┌────▼─────────┐              ┌─────────▼──────┐    ┌────────▼────────┐
    │ COURTS       │              │ POOLS          │    │ BRACKET_SLOTS   │
    │              │              │                │    │                 │
    │ - id (PK)    │              │ - id (PK)      │    │ - id (PK)       │
    │ - label      │              │ - name         │    │ - seed          │
    │              │              │ - status       │    │ - team_id (FK)  │
    └──────────────┘              │ - location_id  │    │ - source_pool_id│
                                  │ - court_id     │    │ - source_rank   │
                                  └────────┬───────┘    └─────────────────┘
                                            │ (N:M)
                                     ┌──────▼──────────┐
                                     │ POOL_TEAMS      │
                                     │                 │
                                     │ - pool_id (FK)  │
                                     │ - team_id (FK)  │
                                     │ - seed_in_pool  │
                                     └─────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          MATCHES (Heart of System)                          │
│                                                                             │
│  - id (PK)                    - status (SCHEDULED → COMPLETE)              │
│  - tournament_id (FK)         - winner_team_id (FK)                        │
│  - pool_id (FK, nullable)     - team1_id (FK)                              │
│  - bracket_id (FK, nullable)  - team2_id (FK)                              │
│  - set1_team1, set1_team2 ... set3_team1, set3_team2 (scores)             │
│  - court_id (FK)              - start_time                                 │
│  - created_at, updated_at                                                  │
└────────┬─────────────────────────────────────────────────────────┬─────────┘
         │ (1:N)                                                   │ (1:N)
         │                                                         │
    ┌────▼──────────┐                                       ┌──────▼────────┐
    │ DUTIES        │                                       │ (References   │
    │               │                                       │  COURTS &     │
    │ - id (PK)     │                                       │  LOCATIONS)   │
    │ - match_id(FK)│                                       └───────────────┘
    │ - team_id(FK) │
    │ - role        │
    │   (REF,       │
    │    LINE_JUDGE)│
    │ - status      │
    └───────────────┘
```

## Table Details

### TOURNAMENTS

Root entity for each tournament event.

- Lifecycle: CREATED → POOL_PLAY_ACTIVE → POOL_PLAY_COMPLETE → BRACKETS_GENERATED → BRACKET_PLAY_ACTIVE → COMPLETE
- One tournament can have multiple pools, teams, matches, and brackets

### LOCATIONS & COURTS

Venues/gyms and courts within them.

- Each location has multiple courts
- Courts assigned to pool play + bracket play matches

### TEAMS

Teams participating in tournament.

- Each team belongs to one tournament
- Coach contact info for notifications

### POOLS

Round-robin pool groupings during pool play phase.

- Assign teams to pools (3-4 per pool typical)
- Generate round-robin matches within each pool
- Calculate standings after matches complete

### POOL_TEAMS

Join table (many-to-many).

- Associates teams with pools and seeding rank within pool
- Tracks which teams finished 1st, 2nd, 3rd in their pool
- Used for seeding into brackets

### MATCHES

Core match records (all matches: pool and bracket).

- Pool matches: have pool_id, no bracket_id
- Bracket matches: have bracket_id, no pool_id (or pool_id for reference)
- Stores match scores (up to 3 sets)
- References court and location
- Tracks winner

### BRACKETS

Bracket structures for elimination play (Gold, Silver, etc.).

- Size: 4, 8, or 12 teams
- Created after pools complete
- Assigned to location

### BRACKET_SLOTS

Seeding positions in brackets.

- Slot 1 = top seed (1st place from pool)
- Slot 2 = 2nd seed (winner of pool #2, etc.)
- Links back to source pool and team rank
- Can remain empty (bye) if bracket size < participating teams

### DUTIES

Referee and line judge assignments.

- Each match can have ref team + line judge teams
- Teams assigned to ref duties before/after their matches
- Status: SCHEDULED → COMPLETED (or MISSED)

### VIEWS

**pool_standings**:

- Real-time standings calculation for each pool
- Ranks teams by: wins → points_for → points_against
- Consumed by frontend and backend for seeding

## Data Flow Through Tournament Lifecycle

```
PHASE 1: SETUP
  Tournament CREATED
  └─ Locations & Courts added
  └─ Teams registered
  └─ Pools auto-assigned with round-robin matches

PHASE 2: POOL PLAY
  Tournament → POOL_PLAY_ACTIVE
  └─ Matches SCHEDULED → IN_PROGRESS → COMPLETE
  └─ Event: MatchCompleted published
  └─ Event: StandingsUpdated published
  └─ Check if all pool matches complete
      └─ Event: PoolCompleted published

PHASE 3: BRACKET GENERATION
  Tournament → POOL_PLAY_COMPLETE
  └─ Trigger: All pools COMPLETE
  └─ Seeding: For each pool, top teams seeded into bracket slots
  └─ Bracket creation: Generate bracket structure and matches
  └─ Event: BracketGenerated published
  └─ Tournament → BRACKETS_GENERATED

PHASE 4: BRACKET PLAY
  Tournament → BRACKET_PLAY_ACTIVE
  └─ Bracket matches SCHEDULED → IN_PROGRESS → COMPLETE
  └─ Match results move teams up/down bracket
  └─ Duties assigned (ref teams for upcoming bracket matches)
  └─ Event: DutyReminderRequested published

PHASE 5: COMPLETE
  Tournament → COMPLETE
```

## Key Constraints & Rules

### Tournament Status Machine

```
CREATED
  ↓ (after teams + pools setup)
POOL_PLAY_ACTIVE
  ↓ (after all pool matches done)
POOL_PLAY_COMPLETE
  ↓ (after brackets generated)
BRACKETS_GENERATED
  ↓ (bracket play starts)
BRACKET_PLAY_ACTIVE
  ↓ (champion determined)
COMPLETE
```

### Match Scoring

- Volleyball scoring: first to 25 points, win by 2
- Sets: minimum 2 to win, up to 3 in best-of-3
- Constraints: set scores ≥ 0, winner_team_id must be team1 or team2

### Seeding Logic

- Primary seed: team_id (unique per pool, per tournament)
- Pool ranking: wins (DESC), points_for (DESC), points_against (ASC)
- Bracket slot assignment: 1st place teams → slots 1-N, 2nd place → slots N+1-2N, etc.

### Duty Assignment

- Typical: winning team refs next match, losing team does line judges
- Role: REF (one per match) or LINE_JUDGE (2-4 per match)
- Status tracks: SCHEDULED → COMPLETED (or MISSED)

## Indexes for Performance

All foreign keys have indexes created automatically by PostgreSQL.

Additional indexes added:

- `tournaments.date` – For listing by date
- `matches.status` – For finding SCHEDULED/IN_PROGRESS matches
- `duties.status` – For finding upcoming duties
- `teams.tournament_id` – For bulk team queries
- `courts.location_id` – For court availability by location

## Views

### pool_standings

Materialized view (recalculated on each query).

- Inputs: pool_id, team_id
- Outputs: wins, losses, points_for, points_against, rank
- Used by: standings endpoints, seeding algorithms, UI displays

```sql
SELECT * FROM pool_standings WHERE pool_id = 1 ORDER BY rank;
```

## Example Queries

### Get full tournament state

```sql
SELECT
    t.id, t.name, t.date, t.status,
    COUNT(DISTINCT tm.id) as num_teams,
    COUNT(DISTINCT p.id) as num_pools,
    COUNT(DISTINCT m.id) as num_matches,
    COUNT(DISTINCT b.id) as num_brackets
FROM tournaments t
LEFT JOIN teams tm ON tm.tournament_id = t.id
LEFT JOIN pools p ON p.tournament_id = t.id
LEFT JOIN matches m ON m.tournament_id = t.id
LEFT JOIN brackets b ON b.tournament_id = t.id
WHERE t.id = ?
GROUP BY t.id, t.name, t.date, t.status;
```

### Get team's bracket path

```sql
SELECT
    b.name as bracket,
    bs.seed,
    m.id as match_id,
    (CASE WHEN m.team1_id = ? THEN (SELECT name FROM teams WHERE id = m.team2_id)
           ELSE (SELECT name FROM teams WHERE id = m.team1_id) END) as opponent,
    m.status,
    c.label, l.name as location
FROM bracket_slots bs
JOIN brackets b ON bs.bracket_id = b.id
JOIN matches m ON (
    (m.bracket_id = b.id AND (m.team1_id = bs.team_id OR m.team2_id = bs.team_id))
    OR (m.set1_team1 IS NOT NULL AND (m.team1_id = ? OR m.team2_id = ?))
)
LEFT JOIN courts c ON m.court_id = c.id
LEFT JOIN locations l ON c.location_id = l.id
WHERE b.tournament_id = ? AND bs.team_id = ?
ORDER BY m.created_at ASC;
```

### Get upcoming duties

```sql
SELECT
    d.id, d.role,
    m.id as match_id,
    (SELECT name FROM teams WHERE id = m.team1_id) as team1,
    (SELECT name FROM teams WHERE id = m.team2_id) as team2,
    c.label, l.name as location,
    m.start_time
FROM duties d
JOIN matches m ON d.match_id = m.id
LEFT JOIN courts c ON m.court_id = c.id
LEFT JOIN locations l ON c.location_id = l.id
WHERE d.team_id = ? AND d.status = 'SCHEDULED'
ORDER BY m.start_time ASC
LIMIT 5;
```

---

For detailed documentation, see [db/README.md](db/README.md)
