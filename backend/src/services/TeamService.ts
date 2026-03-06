/**
 * Team Service
 * Handles team registration and management
 */

import { query, queryOne, execute } from "../config/database";
import { Team, CreateTeamInput } from "../types";
import { Errors } from "../middleware/errorHandler";

export class TeamService {
  /**
   * Create a team for a tournament
   */
  async create(tournamentId: number, input: CreateTeamInput): Promise<Team> {
    const result = await queryOne(
      `INSERT INTO teams (tournament_id, name, coach_name, coach_email)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        tournamentId,
        input.name,
        input.coach_name || null,
        input.coach_email || null,
      ],
    );

    if (!result) {
      throw Errors.internalError("Failed to create team");
    }

    return result as Team;
  }

  /**
   * Create multiple teams (bulk import)
   */
  async createBulk(
    tournamentId: number,
    teams: CreateTeamInput[],
  ): Promise<Team[]> {
    if (teams.length === 0) {
      return [];
    }

    // Build VALUES clause for bulk insert
    let valuesClause = "";
    const values: unknown[] = [];
    let paramIndex = 1;

    teams.forEach((team, idx) => {
      if (idx > 0) valuesClause += ", ";
      valuesClause += `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`;
      values.push(
        tournamentId,
        team.name,
        team.coach_name || null,
        team.coach_email || null,
      );
      paramIndex += 4;
    });

    const result = await query(
      `INSERT INTO teams (tournament_id, name, coach_name, coach_email)
       VALUES ${valuesClause}
       RETURNING *`,
      values,
    );

    return result as Team[];
  }

  /**
   * Get team by ID
   */
  async getById(id: number): Promise<Team> {
    const result = await queryOne("SELECT * FROM teams WHERE id = $1", [id]);

    if (!result) {
      throw Errors.notFound(`Team ${id} not found`);
    }

    return result as Team;
  }

  /**
   * List all teams in a tournament
   */
  async listByTournament(tournamentId: number): Promise<Team[]> {
    const result = await query(
      "SELECT * FROM teams WHERE tournament_id = $1 ORDER BY name",
      [tournamentId],
    );
    return result as Team[];
  }

  /**
   * Get teams in a specific pool
   */
  async listByPool(poolId: number): Promise<Team[]> {
    const result = await query(
      `SELECT t.* FROM teams t
       JOIN pool_teams pt ON t.id = pt.team_id
       WHERE pt.pool_id = $1
       ORDER BY pt.seed_in_pool`,
      [poolId],
    );
    return result as Team[];
  }

  /**
   * Update team info
   */
  async update(id: number, input: Partial<CreateTeamInput>): Promise<Team> {
    const result = await queryOne(
      `UPDATE teams 
       SET 
        name = COALESCE($1, name),
        coach_name = COALESCE($2, coach_name),
        coach_email = COALESCE($3, coach_email),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [input.name, input.coach_name, input.coach_email, id],
    );

    if (!result) {
      throw Errors.notFound(`Team ${id} not found`);
    }

    return result as Team;
  }

  /**
   * Delete team
   */
  async delete(id: number): Promise<void> {
    const rowCount = await execute("DELETE FROM teams WHERE id = $1", [id]);

    if (rowCount === 0) {
      throw Errors.notFound(`Team ${id} not found`);
    }
  }

  /**
   * Get total team count for a tournament
   */
  async countByTournament(tournamentId: number): Promise<number> {
    const result = await queryOne(
      "SELECT COUNT(*) as count FROM teams WHERE tournament_id = $1",
      [tournamentId],
    );
    return (result as any).count;
  }
}

export const teamService = new TeamService();
