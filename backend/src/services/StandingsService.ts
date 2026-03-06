/**
 * Standings Service
 * Handles standings calculation and ranking queries
 */

import { query, queryOne } from "../config/database";
import { Standing } from "../types";
import { Errors } from "../middleware/errorHandler";

export class StandingsService {
  /**
   * Get current standings for a pool
   * Uses the materialized pool_standings view
   */
  async getPoolStandings(poolId: number): Promise<Standing[]> {
    const result = await query(
      "SELECT * FROM pool_standings WHERE pool_id = $1 ORDER BY rank",
      [poolId],
    );

    if (result.length === 0) {
      // Pool might exist but have no teams yet
      throw Errors.notFound(`No standings available for pool ${poolId}`);
    }

    return result as Standing[];
  }

  /**
   * Get a specific team's standing in a pool
   */
  async getTeamStanding(poolId: number, teamId: number): Promise<Standing> {
    const result = await queryOne(
      "SELECT * FROM pool_standings WHERE pool_id = $1 AND team_id = $2",
      [poolId, teamId],
    );

    if (!result) {
      throw Errors.notFound(`Team ${teamId} has no standing in pool ${poolId}`);
    }

    return result as Standing;
  }

  /**
   * Get all standings for all pools in a tournament
   */
  async getTournamentStandings(tournamentId: number): Promise<Standing[]> {
    const result = await query(
      `SELECT ps.* FROM pool_standings ps
       JOIN pools p ON ps.pool_id = p.id
       WHERE p.tournament_id = $1
       ORDER BY p.id, ps.rank`,
      [tournamentId],
    );

    return result as Standing[];
  }

  /**
   * Get the top N teams from a pool for seeding into brackets
   */
  async getTopTeamsByPool(
    poolId: number,
    limit: number = 2,
  ): Promise<Standing[]> {
    const result = await query(
      "SELECT * FROM pool_standings WHERE pool_id = $1 ORDER BY rank LIMIT $2",
      [poolId, limit],
    );

    return result as Standing[];
  }

  /**
   * Rank teams by points for and points against
   */
  async getRankingWithTiebreaker(poolId: number): Promise<Standing[]> {
    const result = await query(
      `SELECT * FROM pool_standings 
       WHERE pool_id = $1 
       ORDER BY wins DESC, points_for DESC, points_against ASC`,
      [poolId],
    );

    return result as Standing[];
  }

  /**
   * Get point differential for a team in a pool
   */
  async getPointDifferential(poolId: number, teamId: number): Promise<number> {
    const result = await queryOne(
      `SELECT (points_for - points_against) as differential
       FROM pool_standings 
       WHERE pool_id = $1 AND team_id = $2`,
      [poolId, teamId],
    );

    if (!result) {
      throw Errors.notFound(`Team ${teamId} not found in pool ${poolId}`);
    }

    return (result as any).differential;
  }

  /**
   * Calculate win rate for a team
   */
  async getWinRate(poolId: number, teamId: number): Promise<number> {
    const result = await queryOne(
      `SELECT 
        CASE 
          WHEN (wins + losses) = 0 THEN 0
          ELSE ROUND(wins::numeric / (wins + losses) * 100, 2)
        END as win_rate
       FROM pool_standings 
       WHERE pool_id = $1 AND team_id = $2`,
      [poolId, teamId],
    );

    if (!result) {
      throw Errors.notFound(`Team ${teamId} not found in pool ${poolId}`);
    }

    return (result as any).win_rate;
  }
}

export const standingsService = new StandingsService();
