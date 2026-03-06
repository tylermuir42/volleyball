# Backend Testing Guide

Quick reference for testing Express backend endpoints locally.

## Prerequisites

1. Database running with migrations applied:

   ```bash
   npm run db:migrate
   ```

2. Backend server running:

   ```bash
   npm run dev
   ```

3. A REST client:
   - **Curl** (command line)
   - **Postman** (GUI)
   - **Thunder Client** (VS Code extension)
   - **REST Client** (VS Code extension)

## Base URL

```
http://localhost:5000
```

## Test Sequence (Flow)

### 1. Health Check

**Endpoint**: `GET /health`

```bash
curl http://localhost:5000/health
```

**Expected**: 200 OK with database connection status

---

### 2. Create Tournament

**Endpoint**: `POST /tournaments`

```bash
curl -X POST http://localhost:5000/tournaments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Spring Invitational 2026",
    "date": "2026-03-21"
  }'
```

**Expected**: 201 Created

```json
{
  "id": 1,
  "name": "Spring Invitational 2026",
  "date": "2026-03-21",
  "status": "CREATED",
  "created_at": "2026-03-06T...",
  "updated_at": "2026-03-06T..."
}
```

**Save the tournament ID** (1) for next steps.

---

### 3. Create Locations

**Endpoint**: `POST /tournaments/:id/locations`

```bash
curl -X POST http://localhost:5000/tournaments/1/locations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lincoln High School",
    "max_courts": 6
  }'

curl -X POST http://localhost:5000/tournaments/1/locations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Roosevelt High School",
    "max_courts": 4
  }'
```

**Expected**: 201 Created (twice)

**Save location IDs** (1, 2) for court creation.

---

### 4. Add Courts to Locations

**Endpoint**: `POST /locations/:id/courts`

```bash
# Add courts to Lincoln (location 1)
curl -X POST http://localhost:5000/locations/1/courts \
  -H "Content-Type: application/json" \
  -d '{"label": "Court 1"}'

curl -X POST http://localhost:5000/locations/1/courts \
  -H "Content-Type: application/json" \
  -d '{"label": "Court 2"}'

curl -X POST http://localhost:5000/locations/1/courts \
  -H "Content-Type: application/json" \
  -d '{"label": "Court 3"}'

# Add courts to Roosevelt (location 2)
curl -X POST http://localhost:5000/locations/2/courts \
  -H "Content-Type: application/json" \
  -d '{"label": "Court A"}'
```

**Expected**: 201 Created (multiple times)

---

### 5. Create Teams (Multiple Methods)

#### Option A: Create Individual Teams

**Endpoint**: `POST /tournaments/:id/teams`

```bash
curl -X POST http://localhost:5000/tournaments/1/teams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lakewood Eagles",
    "coach_name": "Maria Garcia",
    "coach_email": "maria@example.com"
  }'

curl -X POST http://localhost:5000/tournaments/1/teams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Santa Monica Waves",
    "coach_name": "John Smith",
    "coach_email": "john@example.com"
  }'

curl -X POST http://localhost:5000/tournaments/1/teams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Venice Beach Dolphins",
    "coach_name": "Carlos Rodriguez",
    "coach_email": "carlos@example.com"
  }'

curl -X POST http://localhost:5000/tournaments/1/teams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Manhattan Beach Stingrays",
    "coach_name": "Jennifer Lee",
    "coach_email": "jennifer@example.com"
  }'
```

#### Option B: Bulk Import Teams

**Endpoint**: `POST /tournaments/:id/teams/bulk`

```bash
curl -X POST http://localhost:5000/tournaments/1/teams/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "teams": [
      {"name": "Long Beach Tigers", "coach_name": "Michael Chen"},
      {"name": "Torrance Falcons", "coach_name": "Amanda Martinez"},
      {"name": "Redondo Beach Sharks", "coach_name": "David Thompson"},
      {"name": "Inglewood Phoenix", "coach_name": "Lisa Anderson"},
      {"name": "Compton Warriors", "coach_name": "Robert Davis"},
      {"name": "Downey Patriots", "coach_name": "Emily Wilson"},
      {"name": "Palmdale Wildcats", "coach_name": "James Brown"},
      {"name": "Culver City Vipers", "coach_name": "Sarah Johnson"}
    ]
  }'
```

**Expected**: 201 Created with array of teams

---

### 6. List Teams

**Endpoint**: `GET /tournaments/:id/teams`

```bash
curl http://localhost:5000/tournaments/1/teams
```

**Expected**: 200 OK with array of 12+ teams

---

### 7. Auto-Assign Teams to Pools

**Endpoint**: `POST /tournaments/:id/pools/auto-assign`

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

**Expected**: 201 Created with:

```json
{
  "pools": [...],  // 3 pools created
  "matches": [...]  // 18 matches created (6 per pool for round-robin)
}
```

---

### 8. View Pools with Standings

**Endpoint**: `GET /tournaments/:id/pools`

```bash
curl http://localhost:5000/tournaments/1/pools
```

**Expected**: 200 OK with pools and matches (standings empty until scores)

---

### 9. Get Pool Details

**Endpoint**: `GET /pools/:id`

```bash
curl http://localhost:5000/pools/1
```

**Expected**: 200 OK with pool, standings, matches, team assignments

---

### 10. Submit Match Score

**Endpoint**: `POST /matches/:id/score`

Find a match ID from the pool (e.g., ID 1) and submit a score:

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

**Expected**: 200 OK with match marked as COMPLETE

---

### 11. Check Standings Updated

**Endpoint**: `GET /tournaments/:id/standings`

```bash
curl http://localhost:5000/tournaments/1/standings
```

**Expected**: 200 OK with updated standings showing the team who won the match with 1 win

---

### 12. Another Match Score (Complete a Pool)

Submit more scores to test standings updates:

```bash
# Match 2
curl -X POST http://localhost:5000/matches/2/score \
  -H "Content-Type: application/json" \
  -d '{
    "set1_team1": 25,
    "set1_team2": 18,
    "set2_team1": 25,
    "set2_team2": 23
  }'

# Match 3
curl -X POST http://localhost:5000/matches/3/score \
  -H "Content-Type: application/json" \
  -d '{
    "set1_team1": 25,
    "set1_team2": 22,
    "set2_team1": 25,
    "set2_team2": 20
  }'
```

---

## Error Testing

### Test Validation Error (Invalid Volleyball Score)

```bash
# Win by less than 2 points - should fail
curl -X POST http://localhost:5000/matches/4/score \
  -H "Content-Type: application/json" \
  -d '{
    "set1_team1": 25,
    "set1_team2": 24,
    "set2_team1": 25,
    "set2_team2": 24
  }'
```

**Expected**: 422 Unprocessable Entity with validation error message

### Test Not Found Error

```bash
curl http://localhost:5000/tournaments/99999
```

**Expected**: 404 Not Found

### Test Bad Request

```bash
curl -X POST http://localhost:5000/tournaments \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-03-21"}'  # Missing name
```

**Expected**: 422 Validation Error

---

## Using Postman

1. Create a new Postman collection
2. Add requests for each endpoint above
3. Use Postman variables:
   ```
   {{BASE_URL}} = http://localhost:5000
   {{TOURNAMENT_ID}} = 1
   {{POOL_ID}} = 1
   {{MATCH_ID}} = 1
   ```
4. Run requests in sequence

---

## Using Thunder Client (VS Code)

1. Install Thunder Client extension
2. Create new request:
   - Method: POST
   - URL: `http://localhost:5000/tournaments`
   - Body:
     ```json
     {
       "name": "Spring Invitational",
       "date": "2026-03-21"
     }
     ```
3. Send request

---

## Debugging Tips

### Check Application Logs

Monitor the running backend server output for:

- Database queries
- Request logs
- Error messages
- Event publishing

### Check Database Directly

```bash
psql -h localhost -U postgres -d tournament_db

# View tournaments
SELECT * FROM tournaments;

# View pools
SELECT * FROM pools WHERE tournament_id = 1;

# View standings
SELECT * FROM pool_standings WHERE pool_id = 1;

# View matches
SELECT id, team1_id, team2_id, status, winner_team_id FROM matches LIMIT 5;
```

### Common Issues

**Database connection fails**

- Check `.env` has correct DB credentials
- Verify PostgreSQL is running
- Check DB exists: `psql -l`

**Port already in use**

- Change PORT in `.env`
- Or kill existing process: `lsof -i :5000`

**Module not found errors**

- Run `npm install`
- Check imports are correct (case-sensitive)

**Transaction rollback on auto-assign**

- Check team count meets `num_pools * teams_per_pool`
- Check no duplicate team names in tournament

---

## Full Integration Test Flow

Run everything in order (copy-paste):

```bash
# 1. Create tournament
TOURNAMENT=$(curl -s -X POST http://localhost:5000/tournaments \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Tourney", "date": "2026-03-21"}' | jq '.id')

echo "Tournament ID: $TOURNAMENT"

# 2. Create location
LOCATION=$(curl -s -X POST http://localhost:5000/tournaments/$TOURNAMENT/locations \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Gym", "max_courts": 4}' | jq '.id')

echo "Location ID: $LOCATION"

# 3. Add court
COURT=$(curl -s -X POST http://localhost:5000/locations/$LOCATION/courts \
  -H "Content-Type: application/json" \
  -d '{"label": "Court 1"}' | jq '.id')

echo "Court ID: $COURT"

# 4. Bulk create teams
curl -s -X POST http://localhost:5000/tournaments/$TOURNAMENT/teams/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "teams": [
      {"name": "Team 1", "coach_name": "Coach 1"},
      {"name": "Team 2", "coach_name": "Coach 2"},
      {"name": "Team 3", "coach_name": "Coach 3"},
      {"name": "Team 4", "coach_name": "Coach 4"}
    ]
  }'

echo "Teams created"

# 5. Auto-assign pools
RESULT=$(curl -s -X POST http://localhost:5000/tournaments/$TOURNAMENT/pools/auto-assign \
  -H "Content-Type: application/json" \
  -d '{"num_pools": 1, "teams_per_pool": 4, "location_id": '$LOCATION', "court_id": '$COURT'}')

echo "Pools and matches created:"
echo "$RESULT" | jq '.'

# 6. Get standings
echo "Standings:"
curl -s http://localhost:5000/tournaments/$TOURNAMENT/standings | jq '.'
```

---

Done! Your backend is ready for comprehensive testing.
