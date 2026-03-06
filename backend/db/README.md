# PostgreSQL Migrations Guide

This directory contains all database migrations for the Southern LA Volleyball Tournament System.

## Files

- `001_init_schema.sql` – Initial schema with all tables, constraints, indexes, and views
- `002_seed_data.sql` – Sample data for local development and testing
- `schema.ts` (optional) – TypeORM migration if using TypeORM

## Quick Start

### Option 1: Direct SQL Execution (Fastest for Local Dev)

**Prerequisites:**

- PostgreSQL installed locally or RDS with network access
- `psql` command-line tool

**Steps:**

```bash
# Connect to your PostgreSQL database
psql -h localhost -U postgres -d tournament_db

# Run migrations in order
\i migrations/001_init_schema.sql
\i migrations/002_seed_data.sql

# Verify
SELECT * FROM tournaments;
SELECT * FROM pool_standings;
```

Or in one command:

```bash
psql -h localhost -U postgres -d tournament_db -f migrations/001_init_schema.sql
psql -h localhost -U postgres -d tournament_db -f migrations/002_seed_data.sql
```

### Option 2: Node.js Migration Runner

If using this approach, create a simple Node.js runner:

```bash
npm install pg
```

Then use [node-migrate](https://db-migrate.readthedocs.io/) or a custom script.

### Option 3: TypeORM Migrations

If using TypeORM, generate migration files from the SQL:

```bash
npm install typeorm
npm install @types/node

# Generate migration from schema
typeorm migration:create ./migrations/InitSchema
```

## Database Setup for AWS RDS

### Step 1: Create RDS Instance via AWS Console

1. Go to **RDS > Create database**
2. Select **PostgreSQL** engine
3. Choose suitable instance type (e.g., `db.t3.micro` for dev/test)
4. Set instance identifier: `tournament-db`
5. Set master username/password (save these!)
6. Create DB in Learner Lab VPC with appropriate security groups

### Step 2: Get RDS Endpoint

After creation, copy the endpoint:

```
tournament-db.xxxxx.us-west-2.rds.amazonaws.com:5432
```

### Step 3: Connect & Run Migrations

```bash
export PGHOST=tournament-db.xxxxx.us-west-2.rds.amazonaws.com
export PGPORT=5432
export PGUSER=admin
export PGPASSWORD=your_password
export PGDATABASE=tournament_db

# Create database if it doesn't exist
psql -c "CREATE DATABASE tournament_db OWNER admin;"

# Run migrations
psql -f migrations/001_init_schema.sql
psql -f migrations/002_seed_data.sql
```

Or use a script (see below).

## Migration Runner Script (Node.js)

Create `db/migrate.js` in your backend directory:

```javascript
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function runMigrations() {
  const client = new Client({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "tournament_db",
  });

  try {
    await client.connect();
    console.log("✓ Connected to PostgreSQL");

    // Read and execute migrations in order
    const migrations = [
      "migrations/001_init_schema.sql",
      "migrations/002_seed_data.sql",
    ];

    for (const migration of migrations) {
      const migrationPath = path.join(__dirname, migration);
      const sql = fs.readFileSync(migrationPath, "utf8");

      console.log(`\n Running migration: ${migration}`);
      await client.query(sql);
      console.log(`✓ Completed: ${migration}`);
    }

    console.log("\n✓ All migrations completed successfully!");
  } catch (error) {
    console.error("✗ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
```

Run it:

```bash
export DB_HOST=localhost
export DB_USER=postgres
export DB_PASSWORD=yourpassword
export DB_NAME=tournament_db

node db/migrate.js
```

Or with AWS RDS:

```bash
export DB_HOST=tournament-db.xxxxx.us-west-2.rds.amazonaws.com
export DB_USER=admin
export DB_PASSWORD=yourpassword
export DB_NAME=tournament_db

node db/migrate.js
```

## Schema Overview

### Core Tables

| Table           | Purpose                                  |
| --------------- | ---------------------------------------- |
| `tournaments`   | Tournament metadata (name, date, status) |
| `locations`     | Gym/venue locations                      |
| `courts`        | Individual courts within locations       |
| `teams`         | Teams participating in tournament        |
| `pools`         | Pool groupings for round-robin play      |
| `pool_teams`    | Join table: teams in pools with seeding  |
| `matches`       | Individual matches (pool or bracket)     |
| `brackets`      | Bracket structures (Gold, Silver, etc.)  |
| `bracket_slots` | Seeded positions in brackets             |
| `duties`        | Ref/line-judge assignments               |

### Views

| View             | Purpose                                       |
| ---------------- | --------------------------------------------- |
| `pool_standings` | Real-time standings calculation for each pool |

## Data Relationships

```
Tournament
├── Locations
│   └── Courts
├── Teams
├── Pools (assign courts)
│   └── PoolTeams (team + seed rank)
│       └── Matches (within pool)
└── Brackets
    ├── BracketSlots (ranked positions, seeded teams)
    └── Matches (bracket play)
        └── Duties (ref assignments)
```

## Running Queries

### Get Tournament Overview

```sql
SELECT
    t.id,
    t.name,
    t.date,
    t.status,
    COUNT(DISTINCT p.id) as num_pools,
    COUNT(DISTINCT tm.id) as num_teams,
    COUNT(DISTINCT m.id) as num_matches
FROM tournaments t
LEFT JOIN pools p ON p.tournament_id = t.id
LEFT JOIN teams tm ON tm.tournament_id = t.id
LEFT JOIN matches m ON m.tournament_id = t.id
WHERE t.id = 1
GROUP BY t.id, t.name, t.date, t.status;
```

### Get Pool Standings

```sql
SELECT * FROM pool_standings WHERE pool_id = 1 ORDER BY rank;
```

### Get Team's Matches

```sql
SELECT m.id,
    (CASE WHEN m.team1_id = ? THEN t2.name ELSE t1.name END) as opponent,
    m.status,
    m.set1_team1, m.set1_team2,
    m.set2_team1, m.set2_team2,
    m.set3_team1, m.set3_team2
FROM matches m
JOIN teams t1 ON m.team1_id = t1.id
JOIN teams t2 ON m.team2_id = t2.id
WHERE m.tournament_id = ? AND (m.team1_id = ? OR m.team2_id = ?)
ORDER BY m.created_at DESC;
```

### Get Team's Upcoming Duties

```sql
SELECT d.id, d.role, d.status,
    (SELECT name FROM teams WHERE id = d.team_id) as assigned_team,
    m.id as match_id,
    (SELECT name FROM teams WHERE id = m.team1_id) as team1,
    (SELECT name FROM teams WHERE id = m.team2_id) as team2,
    c.label, l.name as location,
    m.start_time
FROM duties d
JOIN matches m ON d.match_id = m.id
JOIN courts c ON m.court_id = c.id
JOIN locations l ON c.location_id = l.id
WHERE d.team_id = ? AND d.status = 'SCHEDULED'
ORDER BY m.start_time ASC;
```

## Troubleshooting

### Connection Refused

- Check PostgreSQL is running: `psql -U postgres -c "SELECT version();"`
- For RDS: verify security group allows inbound traffic on port 5432

### Migration Already Exists

- The migrations are idempotent for schema creation (uses `CREATE TABLE IF NOT EXISTS`)
- To reset: `DROP TABLE IF EXISTS duties CASCADE;` then re-run migrations

### Check Existing Schema

```sql
-- List all tables
\dt

-- List table columns
\d tournaments

-- List indexes
\di

-- List views
\dv
```

## Next Steps

1. **Verify schema locally** – Run migrations on local PostgreSQL
2. **Test with sample data** – Run seed script and query `pool_standings`
3. **Configure backend** – Update `.env` with DB credentials
4. **Deploy to RDS** – Use AWS RDS endpoint when infra is ready
5. **Implement services** – Build Node.js models and API endpoints

## Environment Variables

Set these in `.env` for your backend:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=tournament_db
DB_POOL_SIZE=10
```

Or for AWS RDS:

```env
DB_HOST=tournament-db.xxxxx.us-west-2.rds.amazonaws.com
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=yourpassword
DB_NAME=tournament_db
```
