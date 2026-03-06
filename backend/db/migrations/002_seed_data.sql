-- Sample Data for Testing
-- Run this after 001_init_schema.sql

-- ==============================================================================
-- INSERT SAMPLE TOURNAMENT
-- ==============================================================================
INSERT INTO tournaments (name, date, status)
VALUES ('Spring 2026 Southern LA Invitational', '2026-03-21', 'CREATED')
RETURNING id;
-- Note: Copy the returned ID and use it for the rest of the inserts below

-- For this example, let's use tournament_id = 1
-- Replace with actual ID if different

-- ==============================================================================
-- INSERT LOCATIONS
-- ==============================================================================
INSERT INTO locations (tournament_id, name, max_courts)
VALUES 
    (1, 'Lincoln High School', 6),
    (1, 'Roosevelt High School', 4),
    (1, 'Washington High School', 5);

-- ==============================================================================
-- INSERT COURTS FOR EACH LOCATION
-- ==============================================================================
-- Lincoln High School courts
INSERT INTO courts (location_id, label)
VALUES 
    (1, 'Court 1'),
    (1, 'Court 2'),
    (1, 'Court 3'),
    (1, 'Court 4'),
    (1, 'Court 5'),
    (1, 'Court 6');

-- Roosevelt High School courts
INSERT INTO courts (location_id, label)
VALUES 
    (2, 'Court A'),
    (2, 'Court B'),
    (2, 'Court C'),
    (2, 'Court D');

-- Washington High School courts
INSERT INTO courts (location_id, label)
VALUES 
    (3, 'Court 1'),
    (3, 'Court 2'),
    (3, 'Court 3'),
    (3, 'Court 4'),
    (3, 'Court 5');

-- ==============================================================================
-- INSERT TEAMS (12 teams for a 3-pool tournament)
-- ==============================================================================
INSERT INTO teams (tournament_id, name, coach_name, coach_email)
VALUES 
    (1, 'Lakewood Eagles', 'Maria Garcia', 'maria.garcia@email.com'),
    (1, 'Santa Monica Waves', 'John Smith', 'j.smith@email.com'),
    (1, 'Culver City Vipers', 'Sarah Johnson', 's.johnson@email.com'),
    (1, 'Venice Beach Dolphins', 'Carlos Rodriguez', 'c.rodriguez@email.com'),
    (1, 'Manhattan Beach Stingrays', 'Jennifer Lee', 'j.lee@email.com'),
    (1, 'Long Beach Tigers', 'Michael Chen', 'm.chen@email.com'),
    (1, 'Torrance Falcons', 'Amanda Martinez', 'a.martinez@email.com'),
    (1, 'Redondo Beach Sharks', 'David Thompson', 'd.thompson@email.com'),
    (1, 'Inglewood Phoenix', 'Lisa Anderson', 'l.anderson@email.com'),
    (1, 'Compton Warriors', 'Robert Davis', 'r.davis@email.com'),
    (1, 'Downey Patriots', 'Emily Wilson', 'e.wilson@email.com'),
    (1, 'Palmdale Wildcats', 'James Brown', 'j.brown@email.com');

-- ==============================================================================
-- INSERT POOLS (4 teams per pool)
-- ==============================================================================
INSERT INTO pools (tournament_id, location_id, court_id, name, status)
VALUES 
    (1, 1, 1, 'Pool A', 'SCHEDULED'),
    (1, 1, 3, 'Pool B', 'SCHEDULED'),
    (1, 2, 7, 'Pool C', 'SCHEDULED');

-- ==============================================================================
-- ASSIGN TEAMS TO POOLS (seed order)
-- ==============================================================================
-- Pool A: Teams 1-4
INSERT INTO pool_teams (pool_id, team_id, seed_in_pool)
VALUES 
    (1, 1, 1),
    (1, 5, 2),
    (1, 9, 3),
    (1, 2, 4);

-- Pool B: Teams 5-8
INSERT INTO pool_teams (pool_id, team_id, seed_in_pool)
VALUES 
    (2, 3, 1),
    (2, 6, 2),
    (2, 10, 3),
    (2, 4, 4);

-- Pool C: Teams 9-12
INSERT INTO pool_teams (pool_id, team_id, seed_in_pool)
VALUES 
    (3, 7, 1),
    (3, 11, 2),
    (3, 8, 3),
    (3, 12, 4);

-- ==============================================================================
-- INSERT POOL MATCHES (Round-robin: 4 teams = 6 matches per pool)
-- ==============================================================================
-- Pool A Matches
INSERT INTO matches (tournament_id, pool_id, team1_id, team2_id, court_id, status)
VALUES 
    -- Round 1
    (1, 1, 1, 5, 1, 'SCHEDULED'),
    (1, 1, 9, 2, 1, 'SCHEDULED'),
    -- Round 2
    (1, 1, 1, 9, 1, 'SCHEDULED'),
    (1, 1, 5, 2, 1, 'SCHEDULED'),
    -- Round 3
    (1, 1, 1, 2, 1, 'SCHEDULED'),
    (1, 1, 5, 9, 1, 'SCHEDULED');

-- Pool B Matches
INSERT INTO matches (tournament_id, pool_id, team1_id, team2_id, court_id, status)
VALUES 
    -- Round 1
    (1, 2, 3, 6, 3, 'SCHEDULED'),
    (1, 2, 10, 4, 3, 'SCHEDULED'),
    -- Round 2
    (1, 2, 3, 10, 3, 'SCHEDULED'),
    (1, 2, 6, 4, 3, 'SCHEDULED'),
    -- Round 3
    (1, 2, 3, 4, 3, 'SCHEDULED'),
    (1, 2, 6, 10, 3, 'SCHEDULED');

-- Pool C Matches
INSERT INTO matches (tournament_id, pool_id, team1_id, team2_id, court_id, status)
VALUES 
    -- Round 1
    (1, 3, 7, 11, 7, 'SCHEDULED'),
    (1, 3, 8, 12, 7, 'SCHEDULED'),
    -- Round 2
    (1, 3, 7, 8, 7, 'SCHEDULED'),
    (1, 3, 11, 12, 7, 'SCHEDULED'),
    -- Round 3
    (1, 3, 7, 12, 7, 'SCHEDULED'),
    (1, 3, 11, 8, 7, 'SCHEDULED');

-- ==============================================================================
-- SAMPLE: A completed match with scores (for testing standings)
-- ==============================================================================
-- Pool A Match 1: Team 1 beats Team 5 (25-20, 25-22)
UPDATE matches SET 
    status = 'COMPLETE',
    winner_team_id = 1,
    set1_team1 = 25, set1_team2 = 20,
    set2_team1 = 25, set2_team2 = 22
WHERE tournament_id = 1 AND pool_id = 1 AND team1_id = 1 AND team2_id = 5;

-- Pool A Match 2: Team 9 beats Team 2 (25-18, 25-23)
UPDATE matches SET 
    status = 'COMPLETE',
    winner_team_id = 9,
    set1_team1 = 25, set1_team2 = 18,
    set2_team1 = 25, set2_team2 = 23
WHERE tournament_id = 1 AND pool_id = 1 AND team1_id = 9 AND team2_id = 2;

-- ==============================================================================
-- VERIFY DATA
-- ==============================================================================
-- Check tournament
SELECT 'Tournament' as entity, COUNT(*) as count FROM tournaments WHERE id = 1;
SELECT 'Locations' as entity, COUNT(*) as count FROM locations WHERE tournament_id = 1;
SELECT 'Courts' as entity, COUNT(*) as count FROM courts;
SELECT 'Teams' as entity, COUNT(*) as count FROM teams WHERE tournament_id = 1;
SELECT 'Pools' as entity, COUNT(*) as count FROM pools WHERE tournament_id = 1;
SELECT 'Matches' as entity, COUNT(*) as count FROM matches WHERE tournament_id = 1;

-- Check Pool A standings
SELECT 'Pool A Standings:' as info;
SELECT * FROM pool_standings WHERE pool_id = 1 ORDER BY rank;
