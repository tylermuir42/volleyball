-- Southern LA Volleyball Tournament System - Initial Schema
-- This migration creates the complete database schema for the tournament management system

-- Enable UUID extension if needed (optional, using serial IDs instead)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- TOURNAMENTS TABLE
-- ==============================================================================
CREATE TABLE tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    -- Valid statuses: CREATED, POOL_PLAY_ACTIVE, POOL_PLAY_COMPLETE, BRACKETS_GENERATED, BRACKET_PLAY_ACTIVE, COMPLETE
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT status_check CHECK (status IN ('CREATED', 'POOL_PLAY_ACTIVE', 'POOL_PLAY_COMPLETE', 'BRACKETS_GENERATED', 'BRACKET_PLAY_ACTIVE', 'COMPLETE'))
);

-- ==============================================================================
-- LOCATIONS TABLE
-- ==============================================================================
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    max_courts INTEGER NOT NULL DEFAULT 4,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT max_courts_positive CHECK (max_courts > 0),
    UNIQUE(tournament_id, name)
);

CREATE INDEX idx_locations_tournament_id ON locations(tournament_id);

-- ==============================================================================
-- COURTS TABLE
-- ==============================================================================
CREATE TABLE courts (
    id SERIAL PRIMARY KEY,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id, label)
);

CREATE INDEX idx_courts_location_id ON courts(location_id);

-- ==============================================================================
-- TEAMS TABLE
-- ==============================================================================
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    coach_name VARCHAR(255),
    coach_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tournament_id, name)
);

CREATE INDEX idx_teams_tournament_id ON teams(tournament_id);

-- ==============================================================================
-- POOLS TABLE
-- ==============================================================================
CREATE TABLE pools (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    court_id INTEGER REFERENCES courts(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    -- Valid statuses: SCHEDULED, ACTIVE, COMPLETE
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pool_status_check CHECK (status IN ('SCHEDULED', 'ACTIVE', 'COMPLETE')),
    UNIQUE(tournament_id, name)
);

CREATE INDEX idx_pools_tournament_id ON pools(tournament_id);
CREATE INDEX idx_pools_location_id ON pools(location_id);

-- ==============================================================================
-- POOL_TEAMS TABLE (Join table with seeding rank)
-- ==============================================================================
CREATE TABLE pool_teams (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    seed_in_pool INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pool_id, team_id),
    CONSTRAINT seed_positive CHECK (seed_in_pool > 0)
);

CREATE INDEX idx_pool_teams_pool_id ON pool_teams(pool_id);
CREATE INDEX idx_pool_teams_team_id ON pool_teams(team_id);

-- ==============================================================================
-- MATCHES TABLE
-- ==============================================================================
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    pool_id INTEGER REFERENCES pools(id) ON DELETE SET NULL,
    bracket_id INTEGER,
    -- bracket_id will reference brackets table once created
    team1_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    team2_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Set scores (nullable until match is played)
    set1_team1 INTEGER,
    set1_team2 INTEGER,
    set2_team1 INTEGER,
    set2_team2 INTEGER,
    set3_team1 INTEGER,
    set3_team2 INTEGER,
    
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    -- Valid statuses: SCHEDULED, IN_PROGRESS, COMPLETE
    winner_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    court_id INTEGER REFERENCES courts(id) ON DELETE SET NULL,
    start_time TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT match_status_check CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETE')),
    CONSTRAINT team_different CHECK (team1_id != team2_id),
    CONSTRAINT set_scores_positive CHECK (
        (set1_team1 IS NULL OR set1_team1 >= 0) AND
        (set1_team2 IS NULL OR set1_team2 >= 0) AND
        (set2_team1 IS NULL OR set2_team1 >= 0) AND
        (set2_team2 IS NULL OR set2_team2 >= 0) AND
        (set3_team1 IS NULL OR set3_team1 >= 0) AND
        (set3_team2 IS NULL OR set3_team2 >= 0)
    )
);

CREATE INDEX idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX idx_matches_pool_id ON matches(pool_id);
CREATE INDEX idx_matches_team1_id ON matches(team1_id);
CREATE INDEX idx_matches_team2_id ON matches(team2_id);
CREATE INDEX idx_matches_status ON matches(status);

-- ==============================================================================
-- BRACKETS TABLE
-- ==============================================================================
CREATE TABLE brackets (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    -- Examples: Gold, Silver, Bronze, Consolation
    size INTEGER NOT NULL,
    -- Valid sizes: 4, 8, 12
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    -- Valid statuses: CREATED, ACTIVE, COMPLETE
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bracket_size_check CHECK (size IN (4, 8, 12)),
    CONSTRAINT bracket_status_check CHECK (status IN ('CREATED', 'ACTIVE', 'COMPLETE')),
    UNIQUE(tournament_id, name)
);

CREATE INDEX idx_brackets_tournament_id ON brackets(tournament_id);
CREATE INDEX idx_brackets_location_id ON brackets(location_id);

-- ==============================================================================
-- BRACKET_SLOTS TABLE
-- ==============================================================================
CREATE TABLE bracket_slots (
    id SERIAL PRIMARY KEY,
    bracket_id INTEGER NOT NULL REFERENCES brackets(id) ON DELETE CASCADE,
    seed INTEGER NOT NULL,
    -- Seeding position (1-4, 1-8, 1-12 depending on bracket size)
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    -- Which team is seeded in this slot (populated after pool play)
    source_pool_id INTEGER REFERENCES pools(id) ON DELETE SET NULL,
    -- Which pool this team came from
    source_pool_rank INTEGER,
    -- What rank (1st, 2nd, 3rd) did this team finish in their pool?
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bracket_id, seed),
    CONSTRAINT seed_positive CHECK (seed > 0)
);

CREATE INDEX idx_bracket_slots_bracket_id ON bracket_slots(bracket_id);
CREATE INDEX idx_bracket_slots_team_id ON bracket_slots(team_id);

-- ==============================================================================
-- Add foreign key constraint for bracket_id in matches
-- ==============================================================================
ALTER TABLE matches
ADD CONSTRAINT fk_matches_bracket_id
FOREIGN KEY (bracket_id) REFERENCES brackets(id) ON DELETE SET NULL;

CREATE INDEX idx_matches_bracket_id ON matches(bracket_id);

-- ==============================================================================
-- DUTIES TABLE
-- ==============================================================================
CREATE TABLE duties (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    -- Valid roles: REF, LINE_JUDGE
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    -- Valid statuses: SCHEDULED, COMPLETED, MISSED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT duty_role_check CHECK (role IN ('REF', 'LINE_JUDGE')),
    CONSTRAINT duty_status_check CHECK (status IN ('SCHEDULED', 'COMPLETED', 'MISSED'))
);

CREATE INDEX idx_duties_match_id ON duties(match_id);
CREATE INDEX idx_duties_team_id ON duties(team_id);
CREATE INDEX idx_duties_status ON duties(status);

-- ==============================================================================
-- STANDINGS VIEW (Materialized or on-demand)
-- ==============================================================================
-- This view calculates current standings for a pool
CREATE VIEW pool_standings AS
SELECT 
    pt.pool_id,
    pt.team_id,
    t.name as team_name,
    COUNT(CASE WHEN m.winner_team_id = pt.team_id THEN 1 END) as wins,
    COUNT(CASE WHEN m.status = 'COMPLETE' AND m.winner_team_id != pt.team_id THEN 1 END) as losses,
    COALESCE(SUM(CASE 
        WHEN m.team1_id = pt.team_id THEN m.set1_team1 + m.set2_team1 + COALESCE(m.set3_team1, 0)
        WHEN m.team2_id = pt.team_id THEN m.set1_team2 + m.set2_team2 + COALESCE(m.set3_team2, 0)
        ELSE 0
    END), 0) as points_for,
    COALESCE(SUM(CASE 
        WHEN m.team1_id = pt.team_id THEN m.set1_team2 + m.set2_team2 + COALESCE(m.set3_team2, 0)
        WHEN m.team2_id = pt.team_id THEN m.set1_team1 + m.set2_team1 + COALESCE(m.set3_team1, 0)
        ELSE 0
    END), 0) as points_against,
    ROW_NUMBER() OVER (PARTITION BY pt.pool_id ORDER BY 
        COUNT(CASE WHEN m.winner_team_id = pt.team_id THEN 1 END) DESC,
        COALESCE(SUM(CASE 
            WHEN m.team1_id = pt.team_id THEN m.set1_team1 + m.set2_team1 + COALESCE(m.set3_team1, 0)
            WHEN m.team2_id = pt.team_id THEN m.set1_team2 + m.set2_team2 + COALESCE(m.set3_team2, 0)
            ELSE 0
        END), 0) DESC,
        COALESCE(SUM(CASE 
            WHEN m.team1_id = pt.team_id THEN m.set1_team2 + m.set2_team2 + COALESCE(m.set3_team2, 0)
            WHEN m.team2_id = pt.team_id THEN m.set1_team1 + m.set2_team1 + COALESCE(m.set3_team1, 0)
            ELSE 0
        END), 0) ASC
    ) as rank
FROM pool_teams pt
JOIN teams t ON pt.team_id = t.id
LEFT JOIN matches m ON (
    (m.pool_id = pt.pool_id AND (m.team1_id = pt.team_id OR m.team2_id = pt.team_id))
    AND m.status = 'COMPLETE'
)
GROUP BY pt.pool_id, pt.team_id, t.name;

-- ==============================================================================
-- Sample queries for reference
-- ==============================================================================
-- Get tournament with all pools and standings:
-- SELECT t.*, p.*, ps.* FROM tournaments t
-- JOIN pools p ON p.tournament_id = t.id
-- JOIN pool_standings ps ON ps.pool_id = p.id
-- WHERE t.id = ?;

-- Get all matches for a team in a tournament:
-- SELECT m.* FROM matches m
-- WHERE m.tournament_id = ? AND (m.team1_id = ? OR m.team2_id = ?);

-- Get upcoming duties for a team:
-- SELECT d.*, m.*, c.label, l.name as location
-- FROM duties d
-- JOIN matches m ON d.match_id = m.id
-- JOIN courts c ON m.court_id = c.id
-- JOIN locations l ON c.location_id = l.id
-- WHERE d.team_id = ? AND d.status = 'SCHEDULED'
-- ORDER BY m.start_time ASC;
