/**
 * Tournament Service
 * Handles tournament CRUD and lifecycle operations
 */

import { query, queryOne, execute } from "../config/database";
import { Tournament, CreateTournamentInput, TournamentStatus } from "../types";
import { Errors } from "../middleware/errorHandler";

export class TournamentService {
  /**
   * Create a new tournament
   */
  async create(input: CreateTournamentInput): Promise<Tournament> {
    const result = await query(
      `INSERT INTO tournaments (name, date, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.name, input.date, "CREATED"],
    );

    if (result.length === 0) {
      throw Errors.internalError("Failed to create tournament");
    }

    return result[0] as Tournament;
  }

  /**
   * Get tournament by ID
   */
  async getById(id: number): Promise<Tournament> {
    const result = await queryOne("SELECT * FROM tournaments WHERE id = $1", [
      id,
    ]);

    if (!result) {
      throw Errors.notFound(`Tournament ${id} not found`);
    }

    return result as Tournament;
  }

  /**
   * List all tournaments
   */
  async list(): Promise<Tournament[]> {
    const result = await query("SELECT * FROM tournaments ORDER BY date DESC");
    return result as Tournament[];
  }

  /**
   * List tournaments for a date range
   */
  async listByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<Tournament[]> {
    const result = await query(
      "SELECT * FROM tournaments WHERE date BETWEEN $1 AND $2 ORDER BY date DESC",
      [startDate, endDate],
    );
    return result as Tournament[];
  }

  /**
   * Update tournament status
   */
  async updateStatus(
    id: number,
    status: TournamentStatus,
  ): Promise<Tournament> {
    const result = await queryOne(
      `UPDATE tournaments SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id],
    );

    if (!result) {
      throw Errors.notFound(`Tournament ${id} not found`);
    }

    return result as Tournament;
  }

  /**
   * Get tournament overview with count of teams, pools, matches
   */
  async getOverview(tournamentId: number): Promise<{
    tournament: Tournament;
    num_teams: number;
    num_pools: number;
    num_matches: number;
    num_brackets: number;
  }> {
    const result = await queryOne(
      `SELECT 
        t.id, t.name, t.date, t.status, t.created_at, t.updated_at,
        COUNT(DISTINCT tm.id) as num_teams,
        COUNT(DISTINCT p.id) as num_pools,
        COUNT(DISTINCT m.id) as num_matches,
        COUNT(DISTINCT b.id) as num_brackets
      FROM tournaments t
      LEFT JOIN teams tm ON tm.tournament_id = t.id
      LEFT JOIN pools p ON p.tournament_id = t.id
      LEFT JOIN matches m ON m.tournament_id = t.id
      LEFT JOIN brackets b ON b.tournament_id = t.id
      WHERE t.id = $1
      GROUP BY t.id, t.name, t.date, t.status, t.created_at, t.updated_at`,
      [tournamentId],
    );

    if (!result) {
      throw Errors.notFound(`Tournament ${tournamentId} not found`);
    }

    return {
      tournament: result as Tournament,
      num_teams: (result as any).num_teams || 0,
      num_pools: (result as any).num_pools || 0,
      num_matches: (result as any).num_matches || 0,
      num_brackets: (result as any).num_brackets || 0,
    };
  }

  /**
   * Delete a tournament (cascades to related records)
   */
  async delete(id: number): Promise<void> {
    const rowCount = await execute("DELETE FROM tournaments WHERE id = $1", [
      id,
    ]);

    if (rowCount === 0) {
      throw Errors.notFound(`Tournament ${id} not found`);
    }
  }
}

export const tournamentService = new TournamentService();
