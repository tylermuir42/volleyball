/**
 * Express Server Setup
 * Main application entry point with middleware and routes
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

// Configuration
dotenv.config();
import { config, validateConfig, logConfig } from "./config/env";
import { initializeDb, closeDb } from "./config/database";

// Middleware
import { logger } from "./middleware/logging";
import { errorHandler, asyncHandler } from "./middleware/errorHandler";

// Routes
import { healthRouter } from "./routes/health";

// Services (will be used in routes)
import { tournamentService } from "./services/TournamentService";
import { locationService } from "./services/LocationService";
import { teamService } from "./services/TeamService";
import { poolService } from "./services/PoolService";
import { matchService } from "./services/MatchService";
import { standingsService } from "./services/StandingsService";
import { eventPublisher } from "./services/EventPublisher";

// ============================================================================
// Initialize Express App
// ============================================================================

const app = express();

// ============================================================================
// Middleware
// ============================================================================

// CORS
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
  }),
);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Request logging
app.use(logger);

// ============================================================================
// Routes - Health
// ============================================================================

app.use("/health", healthRouter);

// ============================================================================
// Routes - Tournaments (CRUD)
// ============================================================================

// POST /tournaments - Create tournament
app.post(
  "/tournaments",
  asyncHandler(async (req: Request, res: Response) => {
    const { name, date } = req.body;
    const tournament = await tournamentService.create({ name, date });
    res.status(201).json(tournament);
  }),
);

// GET /tournaments - List all tournaments
app.get(
  "/tournaments",
  asyncHandler(async (_req: Request, res: Response) => {
    const tournaments = await tournamentService.list();
    res.json(tournaments);
  }),
);

// GET /tournaments/:id - Get tournament by ID
app.get(
  "/tournaments/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const tournament = await tournamentService.getById(parseInt(req.params.id));
    res.json(tournament);
  }),
);

// GET /tournaments/:id/overview - Get tournament overview with stats
app.get(
  "/tournaments/:id/overview",
  asyncHandler(async (req: Request, res: Response) => {
    const overview = await tournamentService.getOverview(
      parseInt(req.params.id),
    );
    res.json(overview);
  }),
);

// ============================================================================
// Routes - Locations & Courts
// ============================================================================

// POST /tournaments/:tournamentId/locations - Add location
app.post(
  "/tournaments/:tournamentId/locations",
  asyncHandler(async (req: Request, res: Response) => {
    const { name, max_courts } = req.body;
    const location = await locationService.create(
      parseInt(req.params.tournamentId),
      name,
      max_courts || 4,
    );
    res.status(201).json(location);
  }),
);

// GET /tournaments/:tournamentId/locations - List locations
app.get(
  "/tournaments/:tournamentId/locations",
  asyncHandler(async (req: Request, res: Response) => {
    const locations = await locationService.listByTournament(
      parseInt(req.params.tournamentId),
    );
    res.json(locations);
  }),
);

// POST /locations/:locationId/courts - Add court
app.post(
  "/locations/:locationId/courts",
  asyncHandler(async (req: Request, res: Response) => {
    const court = await locationService.addCourt(
      parseInt(req.params.locationId),
      req.body,
    );
    res.status(201).json(court);
  }),
);

// GET /locations/:locationId/courts - List courts in location
app.get(
  "/locations/:locationId/courts",
  asyncHandler(async (req: Request, res: Response) => {
    const courts = await locationService.getCourtsByLocation(
      parseInt(req.params.locationId),
    );
    res.json(courts);
  }),
);

// ============================================================================
// Routes - Teams
// ============================================================================

// POST /tournaments/:tournamentId/teams - Create team
app.post(
  "/tournaments/:tournamentId/teams",
  asyncHandler(async (req: Request, res: Response) => {
    const team = await teamService.create(
      parseInt(req.params.tournamentId),
      req.body,
    );
    res.status(201).json(team);
  }),
);

// POST /tournaments/:tournamentId/teams/bulk - Bulk import teams
app.post(
  "/tournaments/:tournamentId/teams/bulk",
  asyncHandler(async (req: Request, res: Response) => {
    const teams = await teamService.createBulk(
      parseInt(req.params.tournamentId),
      req.body.teams || [],
    );
    res.status(201).json(teams);
  }),
);

// GET /tournaments/:tournamentId/teams - List teams
app.get(
  "/tournaments/:tournamentId/teams",
  asyncHandler(async (req: Request, res: Response) => {
    const teams = await teamService.listByTournament(
      parseInt(req.params.tournamentId),
    );
    res.json(teams);
  }),
);

// ============================================================================
// Routes - Pools & Matches
// ============================================================================

// POST /tournaments/:tournamentId/pools/auto-assign - Auto-assign teams to pools
app.post(
  "/tournaments/:tournamentId/pools/auto-assign",
  asyncHandler(async (req: Request, res: Response) => {
    const { num_pools, teams_per_pool, location_id, court_id } = req.body;

    const result = await poolService.autoAssignTeamsAndCreateMatches(
      parseInt(req.params.tournamentId),
      num_pools,
      teams_per_pool,
      location_id,
      court_id,
    );

    res.status(201).json(result);
  }),
);

// GET /tournaments/:tournamentId/pools - List pools with standings
app.get(
  "/tournaments/:tournamentId/pools",
  asyncHandler(async (req: Request, res: Response) => {
    const pools = await poolService.listByTournament(
      parseInt(req.params.tournamentId),
    );

    // Enrich each pool with standings and matches
    const enrichedPools = await Promise.all(
      pools.map(async (pool) => {
        const standings = await standingsService.getPoolStandings(pool.id);
        const matches = await matchService.listByPool(pool.id);
        return {
          ...pool,
          standings,
          matches,
        };
      }),
    );

    res.json(enrichedPools);
  }),
);

// GET /pools/:poolId - Get single pool
app.get(
  "/pools/:poolId",
  asyncHandler(async (req: Request, res: Response) => {
    const pool = await poolService.getById(parseInt(req.params.poolId));
    const standings = await standingsService.getPoolStandings(pool.id);
    const matches = await matchService.listByPool(pool.id);
    const poolTeams = await poolService.getPoolTeams(pool.id);

    res.json({
      ...pool,
      standings,
      matches,
      teams: poolTeams,
    });
  }),
);

// ============================================================================
// Routes - Matches & Scoring
// ============================================================================

// GET /matches/:matchId - Get match details
app.get(
  "/matches/:matchId",
  asyncHandler(async (req: Request, res: Response) => {
    const match = await matchService.getById(parseInt(req.params.matchId));
    res.json(match);
  }),
);

// POST /matches/:matchId/score - Submit match score
app.post(
  "/matches/:matchId/score",
  asyncHandler(async (req: Request, res: Response) => {
    const match = await matchService.submitScore(
      parseInt(req.params.matchId),
      req.body,
    );

    try {
      await eventPublisher.publishMatchCompleted(match);

      if (match.pool_id) {
        const standings = await standingsService.getPoolStandings(
          match.pool_id,
        );
        await eventPublisher.publishStandingsUpdated(
          match.tournament_id,
          match.pool_id,
          standings,
        );

        const poolComplete = await poolService.allMatchesComplete(
          match.pool_id,
        );
        if (poolComplete) {
          await eventPublisher.publishPoolCompleted(
            match.tournament_id,
            match.pool_id,
          );
        }
      }
    } catch (eventError) {
      console.error(
        "⚠️ Failed to publish one or more domain events",
        eventError,
      );
    }

    res.json(match);
  }),
);

// GET /tournaments/:tournamentId/standings - Get all standings
app.get(
  "/tournaments/:tournamentId/standings",
  asyncHandler(async (req: Request, res: Response) => {
    const standings = await standingsService.getTournamentStandings(
      parseInt(req.params.tournamentId),
    );
    res.json(standings);
  }),
);

// ============================================================================
// Error Handling (must be last)
// ============================================================================

app.use(errorHandler);

// ============================================================================
// Startup & Shutdown
// ============================================================================

let server: ReturnType<typeof app.listen>;

export async function startServer(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();
    logConfig();

    // Initialize database
    console.log("🔌 Initializing database connection pool...");
    initializeDb();
    console.log("✓ Database connected");

    // Start HTTP server
    server = app.listen(config.PORT, () => {
      console.log(`\n🚀 Server running at http://localhost:${config.PORT}`);
      console.log(`   Health check: http://localhost:${config.PORT}/health`);
      console.log("");
    });
  } catch (error) {
    console.error("⚠️  Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log("\n🛑 Shutting down server...");

  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log("✓ HTTP server closed");
        resolve();
      });
    });
  }

  await closeDb();
  console.log("✓ Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Export for testing
export { app };

// Start if this is the main module
if (require.main === module) {
  startServer();
}
