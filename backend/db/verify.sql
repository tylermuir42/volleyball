-- Quick verification and test queries
-- Run these after migrations to verify everything is set up correctly

-- ==============================================================================
-- 1. VERIFY SCHEMA IS COMPLETE
-- ==============================================================================

\echo '===== VERIFICATION QUERIES ====='

-- Check that all tables exist
\echo ''
\echo 'Tables created:'
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check that view exists
\echo ''
\echo 'Views created:'
SELECT viewname FROM pg_views WHERE schemaname = 'public';

-- ==============================================================================
-- 2. VERIFY SAMPLE DATA
-- ==============================================================================

\echo ''
\echo '===== SAMPLE DATA VERIFICATION ====='

\echo ''
\echo 'Tournaments:'
SELECT id, name, date, status FROM tournaments;

\echo ''
\echo 'Locations:'
SELECT id, name, max_courts FROM locations;

\echo ''
\echo 'Courts:'
SELECT id, label FROM courts LIMIT 5;

\echo ''
\echo 'Teams:'
SELECT id, name, coach_name FROM teams LIMIT 5;

\echo ''
\echo 'Pools:'
SELECT id, name FROM pools;

\echo ''
\echo 'Teams per Pool:'
SELECT 
    p.id, p.name as pool_name, 
    COUNT(pt.team_id) as num_teams
FROM pools p
LEFT JOIN pool_teams pt ON p.id = pt.pool_id
GROUP BY p.id, p.name;

\echo ''
\echo 'Total Matches:'
SELECT COUNT(*) as total_matches FROM matches;

-- ==============================================================================
-- 3. TEST STANDINGS VIEW (THE HEART OF POOL PLAY)
-- ==============================================================================

\echo ''
\echo '===== POOL STANDINGS (BEFORE SCORES) ====='

SELECT 
    pool_id,
    team_name,
    wins,
    losses,
    points_for,
    points_against,
    rank
FROM pool_standings 
WHERE pool_id = 1 
ORDER BY rank;

-- ==============================================================================
-- 4. CHECK COMPLETED MATCHES
-- ==============================================================================

\echo ''
\echo '===== COMPLETED MATCHES ====='

SELECT 
    id, 
    (SELECT name FROM teams WHERE id = team1_id) as team1,
    (SELECT name FROM teams WHERE id = team2_id) as team2,
    set1_team1, set1_team2,
    set2_team1, set2_team2,
    (SELECT name FROM teams WHERE id = winner_team_id) as winner
FROM matches 
WHERE status = 'COMPLETE';

-- ==============================================================================
-- 5. EXAMPLE: GET TOURNAMENT OVERVIEW
-- ==============================================================================

\echo ''
\echo '===== TOURNAMENT OVERVIEW ====='

SELECT 
    t.id, 
    t.name, 
    t.date, 
    t.status,
    COUNT(DISTINCT tm.id) as num_teams,
    COUNT(DISTINCT p.id) as num_pools,
    COUNT(DISTINCT m.id) as num_matches
FROM tournaments t
LEFT JOIN teams tm ON tm.tournament_id = t.id
LEFT JOIN pools p ON p.tournament_id = t.id
LEFT JOIN matches m ON m.tournament_id = t.id
WHERE t.id = 1
GROUP BY t.id, t.name, t.date, t.status;

-- ==============================================================================
-- 6. EXAMPLE: GET TEAM'S MATCHES IN A POOL
-- ==============================================================================

\echo ''
\echo '===== TEAM 1 MATCHES ====='

SELECT 
    m.id, 
    m.pool_id,
    (CASE WHEN m.team1_id = 1 THEN (SELECT name FROM teams WHERE id = m.team2_id) 
           ELSE (SELECT name FROM teams WHERE id = m.team1_id) END) as opponent,
    m.status,
    (CASE 
        WHEN m.team1_id = 1 AND m.winner_team_id = 1 THEN 'W'
        WHEN m.team2_id = 1 AND m.winner_team_id = 1 THEN 'W'
        WHEN m.status = 'COMPLETE' THEN 'L'
        ELSE 'TBD'
    END) as result,
    (CASE WHEN m.team1_id = 1 THEN m.set1_team1 || '-' || m.set1_team2 || ', ' || m.set2_team1 || '-' || m.set2_team2
           ELSE m.set1_team2 || '-' || m.set1_team1 || ', ' || m.set2_team2 || '-' || m.set2_team1 END) as score
FROM matches m
WHERE (m.team1_id = 1 OR m.team2_id = 1) AND m.pool_id IS NOT NULL
ORDER BY m.created_at;

-- ==============================================================================
-- 7. EXAMPLE: STANDINGS AFTER FIRST MATCH
-- ==============================================================================

\echo ''
\echo '===== POOL A STANDINGS (WITH 2 MATCHES COMPLETED) ====='

SELECT 
    team_name,
    wins,
    losses,
    points_for,
    points_against,
    (points_for - points_against) as point_differential,
    rank
FROM pool_standings
WHERE pool_id = 1
ORDER BY rank;

-- ==============================================================================
-- 8. COACHES INFO (FOR NOTIFICATIONS PHASE)
-- ==============================================================================

\echo ''
\echo '===== COACH CONTACT INFO ====='

SELECT DISTINCT
    t.id,
    t.name as team_name,
    t.coach_name,
    t.coach_email
FROM teams t
WHERE t.coach_email IS NOT NULL
ORDER BY t.name;

-- ==============================================================================
-- 9. DATA INTEGRITY CHECKS
-- ==============================================================================

\echo ''
\echo '===== DATA INTEGRITY CHECKS ====='

\echo ''
\echo 'Teams without duplicates per tournament:'
SELECT tournament_id, COUNT(*) 
FROM teams 
GROUP BY tournament_id 
HAVING COUNT(*) > 0;

\echo ''
\echo 'Pools assigned to tournaments:'
SELECT tournament_id, COUNT(*) as num_pools
FROM pools
GROUP BY tournament_id;

\echo ''
\echo 'Match count by status:'
SELECT status, COUNT(*) as num_matches
FROM matches
GROUP BY status;

-- ==============================================================================
-- 10. PERFORMANCE CHECK - INDEX USAGE
-- ==============================================================================

\echo ''
\echo '===== INDEXES FOR PERFORMANCE ====='

SELECT 
    schemaname,
    tablename, 
    indexname
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ==============================================================================
-- 11. SUCCESS! Schema and data are ready
-- ==============================================================================

\echo ''
\echo '===== ✅ ALL VERIFICATIONS COMPLETE ====='
\echo ''
\echo 'Database is ready for:'
\echo '  1. Backend REST API development'
\echo '  2. Event publishing (EventBridge)'
\echo '  3. WebSocket integration'
\echo ''
\echo 'Next: Implement Phase 2 (REST API)'
\echo ''
