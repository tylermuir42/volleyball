/**
 * Pool Service
 * Handles pool creation, team assignment, and round-robin match generation
 */

import { query, queryOne, execute, getClient } from "../config/database";
import { Pool, PoolTeam, Match } from "../types";
import { Errors } from "../middleware/errorHandler";
import { PoolClient } from "pg";

export class PoolService {
  /**
   * Create a pool manually
   */
  async create(
    tournamentId: number,
    name: string,
    locationId?: number,
    courtId?: number,
  ): Promise<Pool> {
    const result = await queryOne(
      `INSERT INTO pools (tournament_id, name, location_id, court_id, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tournamentId, name, locationId || null, courtId || null, "SCHEDULED"],
    );

    if (!result) {
      throw Errors.internalError("Failed to create pool");
    }

    return result as Pool;
  }

  /**
   * Get pool by ID
   */
  async getById(id: number): Promise<Pool> {
    const result = await queryOne("SELECT * FROM pools WHERE id = $1", [id]);

    if (!result) {
      throw Errors.notFound(`Pool ${id} not found`);
    }

    return result as Pool;
  }

  /**
   * List all pools for a tournament
   */
  async listByTournament(tournamentId: number): Promise<Pool[]> {
    const result = await query(
      "SELECT * FROM pools WHERE tournament_id = $1 ORDER BY name",
      [tournamentId],
    );
    return result as Pool[];
  }

  /**
   * Auto-assign teams to pools and generate round-robin matches
   * This is a complex operation that should be transactional
   */
  async autoAssignTeamsAndCreateMatches(
    tournamentId: number,
    numPools: number,
    teamsPerPool: number,
    locationId?: number,
    courtId?: number,
  ): Promise<{ pools: Pool[]; matches: Match[] }> {
    const client = await getClient();

    try {
      await client.query("BEGIN");

      // Get all teams for tournament
      const teamsResult = await client.query(
        "SELECT id FROM teams WHERE tournament_id = $1 ORDER BY id",
        [tournamentId],
      );
      const teams = teamsResult.rows;

      if (teams.length < numPools * teamsPerPool) {
        throw Errors.badRequest(
          `Need at least ${numPools * teamsPerPool} teams but only have ${teams.length}`,
        );
      }

      // Create pools
      const pools: Pool[] = [];
      for (let i = 0; i < numPools; i++) {
        const poolName = String.fromCharCode(65 + i); // A, B, C, ...
        const result = await client.query(
          `INSERT INTO pools (tournament_id, name, location_id, court_id, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            tournamentId,
            `Pool ${poolName}`,
            locationId || null,
            courtId || null,
            "SCHEDULED",
          ],
        );
        pools.push(result.rows[0] as Pool);
      }

      // Assign teams to pools in round-robin fashion
      const poolTeams: PoolTeam[] = [];
      let poolIdx = 0;
      let seedIdx = 1;

      for (let i = 0; i < teams.length; i++) {
        const teamId = teams[i].id;
        const poolId = pools[poolIdx].id;

        const result = await client.query(
          `INSERT INTO pool_teams (pool_id, team_id, seed_in_pool)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [poolId, teamId, (i % teamsPerPool) + 1],
        );
        poolTeams.push(result.rows[0] as PoolTeam);

        poolIdx = (poolIdx + 1) % numPools;
      }

      // Generate round-robin matches for each pool
      const matches: Match[] = [];
      for (const pool of pools) {
        const poolTeamsResult = await client.query(
          `SELECT t.id FROM teams t
           JOIN pool_teams pt ON t.id = pt.team_id
           WHERE pt.pool_id = $1
           ORDER BY pt.seed_in_pool`,
          [pool.id],
        );

        const poolTeamIds = poolTeamsResult.rows.map((r: any) => r.id);

        // Generate round-robin matches
        for (let i = 0; i < poolTeamIds.length; i++) {
          for (let j = i + 1; j < poolTeamIds.length; j++) {
            const result = await client.query(
              `INSERT INTO matches (tournament_id, pool_id, team1_id, team2_id, court_id, status)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING *`,
              [
                tournamentId,
                pool.id,
                poolTeamIds[i],
                poolTeamIds[j],
                courtId || null,
                "SCHEDULED",
              ],
            );
            matches.push(result.rows[0] as Match);
          }
        }
      }

      await client.query("COMMIT");

      return { pools, matches };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Manually assign a team to a pool
   */
  async assignTeamToPool(
    poolId: number,
    teamId: number,
    seed: number,
  ): Promise<PoolTeam> {
    const result = await queryOne(
      `INSERT INTO pool_teams (pool_id, team_id, seed_in_pool)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [poolId, teamId, seed],
    );

    if (!result) {
      throw Errors.internalError("Failed to assign team to pool");
    }

    return result as PoolTeam;
  }

  /**
   * Get teams in a pool (with seeding)
   */
  async getPoolTeams(
    poolId: number,
  ): Promise<(PoolTeam & { team_name: string })[]> {
    const result = await query(
      `SELECT pt.*, t.name as team_name
       FROM pool_teams pt
       JOIN teams t ON pt.team_id = t.id
       WHERE pt.pool_id = $1
       ORDER BY pt.seed_in_pool`,
      [poolId],
    );
    return result as (PoolTeam & { team_name: string })[];
  }

  /**
   * Update pool status
   */
  async updateStatus(
    poolId: number,
    status: "SCHEDULED" | "ACTIVE" | "COMPLETE",
  ): Promise<Pool> {
    const result = await queryOne(
      `UPDATE pools SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, poolId],
    );

    if (!result) {
      throw Errors.notFound(`Pool ${poolId} not found`);
    }

    return result as Pool;
  }

  /**
   * Check if all matches in pool are complete
   */
  async allMatchesComplete(poolId: number): Promise<boolean> {
    const result = await queryOne(
      `SELECT COUNT(*) as incomplete FROM matches 
       WHERE pool_id = $1 AND status != 'COMPLETE'`,
      [poolId],
    );
    return (result as any).incomplete === 0;
  }

  /**
   * Delete a pool (cascades to pool_teams and matches)
   */
  async delete(id: number): Promise<void> {
    const rowCount = await execute("DELETE FROM pools WHERE id = $1", [id]);

    if (rowCount === 0) {
      throw Errors.notFound(`Pool ${id} not found`);
    }
  }
}

export const poolService = new PoolService();
