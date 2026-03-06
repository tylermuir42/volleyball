# Database Quick Start Guide

Get the PostgreSQL schema and sample data loaded in minutes.

## Prerequisites

- **Option A (Local)**: PostgreSQL installed (`brew install postgresql` on Mac, or [download](https://www.postgresql.org/download/))
- **Option B (Remote)**: AWS RDS instance created and network accessible

## Step 1: Set Up Environment Variables

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your database credentials:

### For Local PostgreSQL:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=tournament_db
```

### For AWS RDS:

```env
DB_HOST=tournament-db.xxxxx.us-west-2.rds.amazonaws.com
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=your_rds_password
DB_NAME=tournament_db
```

## Step 2: Install Dependencies

```bash
# In backend directory
npm install

# Install pg (PostgreSQL driver) if not already there
npm install pg dotenv
```

## Step 3: Run Database Migrations

### Option A: Using Node.js Script (Recommended)

```bash
npm run db:migrate
```

This will:

1. Connect to PostgreSQL
2. Create the database if it doesn't exist (if using postgres user)
3. Execute all schema migrations
4. Load sample data

**Output:**

```
✅ Connected to PostgreSQL
📦 Creating database: tournament_db
✅ Database created: tournament_db

📝 Running Database Migrations...

⏳ Running: migrations/001_init_schema.sql
✅ Completed: migrations/001_init_schema.sql

⏳ Running: migrations/002_seed_data.sql
✅ Completed: migrations/002_seed_data.sql

✨ All migrations completed successfully!
```

### Option B: Using psql Command Line

```bash
# Create database (if not using node script)
psql -U postgres -c "CREATE DATABASE tournament_db;"

# Run migrations
psql -h localhost -U postgres -d tournament_db -f db/migrations/001_init_schema.sql
psql -h localhost -U postgres -d tournament_db -f db/migrations/002_seed_data.sql
```

### Option C: Schema Only (No Sample Data)

```bash
npm run db:migrate:schema-only
```

Then later add sample data manually.

## Step 4: Verify the Setup

Check that tables were created:

```bash
psql -h localhost -U postgres -d tournament_db -c "\dt"
```

Expected output:

```
             List of relations
 Schema |        Name        | Type  |  Owner
--------+--------------------+-------+---------
 public | bracket_slots      | table | postgres
 public | brackets           | table | postgres
 public | courts             | table | postgres
 public | duties             | table | postgres
 public | locations          | table | postgres
 public | matches            | table | postgres
 public | pool_standings     | view  | postgres
 public | pool_teams         | table | postgres
 public | pools              | table | postgres
 public | teams              | table | postgres
 public | tournaments        | table | postgres
```

Check sample data (if seeded):

```bash
psql -h localhost -U postgres -d tournament_db -c "SELECT * FROM tournaments;"
```

Expected output:

```
 id |                     name                     |    date    |  status
----+----------------------------------------------+------------+---------
  1 | Spring 2026 Southern LA Invitational         | 2026-03-21 | CREATED
```

Check standings view:

```bash
psql -h localhost -U postgres -d tournament_db -c "SELECT * FROM pool_standings ORDER BY pool_id, rank;"
```

## Step 5: Start Your Backend

```bash
npm run dev
```

The backend should connect to PostgreSQL successfully and print connection info.

## Troubleshooting

### Connection Refused

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution**:

- Verify PostgreSQL is running: `psql -U postgres -c "SELECT version();"`
- Check host/port in `.env`
- On Mac: `brew services start postgresql`
- On Windows: PostgreSQL service in Services app

### Authentication Failed

**Error**: `error: password authentication failed for user "postgres"`

**Solution**:

- Verify password is correct in `.env`
- Reset PostgreSQL password (Mac/Linux):
  ```bash
  sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'new_password';"
  ```

### Database Already Exists

**Error**: `ERROR: database "tournament_db" already exists`

**Solution**:

- The migration script handles this (it checks before creating)
- Or delete and recreate: `psql -U postgres -c "DROP DATABASE IF EXISTS tournament_db;"`

### No Permission to Create Database

**Error**: `ERROR: permission denied to create database`

**Solution**:

- Use a superuser account (postgres) in `.env`
- Or use `--schema-only` flag: `npm run db:migrate:schema-only`

### AWS RDS Connection Issues

**Error**: `Error: getaddrinfo ENOTFOUND tournament-db.xxxxx.us-west-2.rds.amazonaws.com`

**Solution**:

1. Verify RDS endpoint in `.env` (copy from AWS console)
2. Check security group allows inbound on port 5432:
   - RDS > Databases > Select instance > Security groups > Check inbound rules
3. Ensure VPC and network configuration allows your machine to reach RDS
4. Test with: `telnet tournament-db.xxxxx.us-west-2.rds.amazonaws.com 5432`

## Next Steps

1. ✅ Verify tables and sample data exist
2. 📝 Start implementing backend services (models, repositories)
3. 🔄 Build REST API endpoints
4. 🧪 Write unit tests for database logic
5. 🚀 Connect to EventBridge (Phase 3)

## Useful Commands

```bash
# Connect to database
psql -h localhost -U postgres -d tournament_db

# List all tables
\dt

# Describe a table
\d tournaments

# View standings
SELECT * FROM pool_standings;

# Count records
SELECT COUNT(*) FROM tournaments;

# Reset everything (careful!)
psql -U postgres -c "DROP DATABASE tournament_db;"
npm run db:migrate
```

## Environment Variable Reference

| Variable       | Default       | Usage                |
| -------------- | ------------- | -------------------- |
| `DB_HOST`      | localhost     | Postgres hostname    |
| `DB_PORT`      | 5432          | Postgres port        |
| `DB_USER`      | postgres      | Postgres user        |
| `DB_PASSWORD`  | (required)    | Postgres password    |
| `DB_NAME`      | tournament_db | Database name        |
| `DB_POOL_SIZE` | 10            | Connection pool size |

## File Organization

```
backend/
├── db/
│   ├── migrations/
│   │   ├── 001_init_schema.sql      ← Core tables, indexes, views
│   │   └── 002_seed_data.sql        ← Sample tournament data
│   ├── README.md                     ← Detailed documentation
│   └── migrate.js                    ← Migration runner script
├── .env.example                      ← Template for environment variables
├── .env                              ← Your local config (DO NOT COMMIT)
├── package.json                      ← Scripts: db:migrate, db:migrate:schema-only
└── src/
    └── server.ts                     ← Your backend will connect here
```

## For AWS RDS Deployment

When your cloud engineers have set up RDS:

1. Get the endpoint from AWS console
2. Update `.env` with RDS credentials
3. Ensure security group allows your machine's IP
4. Run: `npm run db:migrate`
5. Commit schema files to git (migrations are version-controlled)
6. Use CI/CD pipeline to auto-run migrations on each deployment

---

**Stuck?** Check [db/README.md](README.md) for detailed documentation, or review the migration files directly.
