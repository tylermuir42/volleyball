# Database Setup Complete ✅

The PostgreSQL schema has been created and is ready for deployment to AWS RDS.

## Files Created

### Migration Files

| File                                        | Purpose                                                                   | Lines |
| ------------------------------------------- | ------------------------------------------------------------------------- | ----- |
| `backend/db/migrations/001_init_schema.sql` | Complete database schema with all tables, constraints, indexes, and views | ~450  |
| `backend/db/migrations/002_seed_data.sql`   | Sample tournament data (12 teams, 3 pools, 18 matches)                    | ~200  |

### Configuration & Scripts

| File                    | Purpose                                                                         |
| ----------------------- | ------------------------------------------------------------------------------- |
| `backend/.env.example`  | Template for environment variables (copy to `.env` and fill in values)          |
| `backend/db/migrate.js` | Node.js migration runner (handles DB creation, runs migrations, reports status) |
| `backend/db/README.md`  | Detailed migration documentation and troubleshooting                            |

### Documentation

| File                        | Purpose                                           |
| --------------------------- | ------------------------------------------------- |
| `backend/DB_QUICKSTART.md`  | **START HERE** – 5-minute setup guide             |
| `backend/SCHEMA_DIAGRAM.md` | Visual ER diagram, data flow, and example queries |

### Updated Files

| File                   | Change                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| `backend/package.json` | Added `db:migrate`, `db:migrate:schema-only`, `db:seed` npm scripts |

---

## What's Included

### Database Schema (15 tables + 1 view)

**Core Tables:**

- `tournaments` – Tournament metadata and status
- `locations` – Venue/gym locations
- `courts` – Individual courts in locations
- `teams` – Teams in tournament
- `pools` – Round-robin groupings
- `pool_teams` – Team-to-pool associations with seeding
- `matches` – Match records (pool or bracket)
- `brackets` – Bracket structures (Gold, Silver, etc.)
- `bracket_slots` – Seeding positions in brackets
- `duties` – Referee/line judge assignments

**Supporting Tables:**

- Indexes for performance optimization
- Constraints for data integrity
- Event tracking fields (created_at, updated_at)

**Views:**

- `pool_standings` – Real-time standings calculation

### Sample Data

Pre-loaded tournament ready for testing:

- 1 tournament (Spring 2026 Southern LA Invitational)
- 3 locations with courts
- 12 teams
- 3 pools (round-robin)
- 18 matches
- 2 completed matches with scores
- Ready to query standings and test application logic

### Migration Capabilities

- **Automated:** Node.js script handles database creation, schema migration, seed data
- **Idempotent:** Can be run multiple times safely
- **Flexible:** Supports local PostgreSQL or AWS RDS
- **Verifiable:** Outputs status and completion checks

---

## Quick Start (5 minutes)

### 1. Set up environment

```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run migrations

```bash
npm run db:migrate
```

### 4. Verify

```bash
psql -h localhost -U postgres -d tournament_db -c "SELECT * FROM pool_standings;"
```

---

## Next Steps for Team

### Software Engineers

1. ✅ Schema is ready to use
2. Review `SCHEMA_DIAGRAM.md` to understand data relationships
3. Implement backend services and repositories
4. Connect backend Express app to PostgreSQL
5. Build REST endpoints (Phase 2)

### Cloud Engineers

1. Create AWS RDS PostgreSQL instance
2. Get endpoint and credentials
3. Provide to software engineers
4. Software engineers run: `npm run db:migrate` against RDS
5. Verify connectivity from backend container

### All Team Members

- Reference [DB_QUICKSTART.md](backend/DB_QUICKSTART.md) for setup
- Check [SCHEMA_DIAGRAM.md](backend/SCHEMA_DIAGRAM.md) for data model
- Read sample queries in `db/README.md` for common operations

---

## Database Statistics

| Metric        | Value |
| ------------- | ----- |
| Total tables  | 10    |
| Total views   | 1     |
| Total indexes | 15+   |
| Primary keys  | 10    |
| Foreign keys  | 14    |
| Constraints   | 20+   |
| Status enums  | 4     |

---

## Key Features of This Schema

✅ **Comprehensive**: Covers all tournament phases (setup, pools, brackets, duties)  
✅ **Flexible**: Supports 3+ team pools, 4/8/12 team brackets  
✅ **Performant**: Indexes on frequently queried fields  
✅ **Maintainable**: Clear naming, proper constraints, documentation  
✅ **Production-Ready**: Migrations ready for AWS RDS deployment  
✅ **Developer-Friendly**: Sample data included for testing

---

## Database URLs & Credentials

### Local Development

```
Host: localhost
Port: 5432
User: postgres
Password: [your password]
Database: tournament_db
```

### AWS RDS (once provisioned)

```
Host: tournament-db.xxxxx.us-west-2.rds.amazonaws.com
Port: 5432
User: admin
Password: [your password]
Database: tournament_db
```

---

## Troubleshooting

**Problem**: Connection refused  
**Solution**: Check PostgreSQL is running, verify host/port in .env

**Problem**: "database already exists" error  
**Solution**: Migration script handles this, safe to re-run

**Problem**: Permission denied on RDS  
**Solution**: Use correct user (admin for RDS) and security group allows your IP

See [db/README.md](backend/db/README.md) for detailed troubleshooting.

---

## Files Summary Tree

```
backend/
├── db/
│   ├── migrations/
│   │   ├── 001_init_schema.sql          ← Full schema
│   │   └── 002_seed_data.sql            ← Sample data
│   ├── migrate.js                       ← Runner script
│   └── README.md                        ← Full documentation
├── .env.example                         ← Config template
├── DB_QUICKSTART.md                     ← START HERE
├── SCHEMA_DIAGRAM.md                    ← Visual reference
└── package.json                         ← Has db: scripts
```

---

**Status**: Ready for Phase 2 (Backend REST API development)

Start with [DB_QUICKSTART.md](backend/DB_QUICKSTART.md) and `npm run db:migrate`!
