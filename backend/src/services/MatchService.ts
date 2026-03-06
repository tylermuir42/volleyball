/**
 * Match Service
 * Handles match CRUD and score submission
 */

import { query, queryOne, execute } from "../config/database";
import { Match, SubmitScoreInput, MatchStatus } from "../types";
import { Errors } from "../middleware/errorHandler";

export class MatchService {
  /**
   * Get match by ID
   */
  async getById(id: number): Promise<Match> {
    const result = await queryOne("SELECT * FROM matches WHERE id = $1", [id]);

    if (!result) {
      throw Errors.notFound(`Match ${id} not found`);
    }

    return result as Match;
  }

  /**
   * List matches for a pool
   */
  async listByPool(poolId: number): Promise<Match[]> {
    const result = await query(
      `SELECT m.* FROM matches m
       WHERE m.pool_id = $1
       ORDER BY m.created_at DESC`,
      [poolId],
    );
    return result as Match[];
  }

  /**
   * List matches for a bracket
   */
  async listByBracket(bracketId: number): Promise<Match[]> {
    const result = await query(
      `SELECT m.* FROM matches m
       WHERE m.bracket_id = $1
       ORDER BY m.created_at DESC`,
      [bracketId],
    );
    return result as Match[];
  }

  /**
   * List all matches for a tournament
   */
  async listByTournament(tournamentId: number): Promise<Match[]> {
    const result = await query(
      `SELECT * FROM matches WHERE tournament_id = $1 ORDER BY created_at DESC`,
      [tournamentId],
    );
    return result as Match[];
  }

  /**
   * List matches for a team
   */
  async listByTeam(tournamentId: number, teamId: number): Promise<Match[]> {
    const result = await query(
      `SELECT * FROM matches 
       WHERE tournament_id = $1 AND (team1_id = $2 OR team2_id = $2)
       ORDER BY created_at DESC`,
      [tournamentId, teamId],
    );
    return result as Match[];
  }

  /**
   * Validate volleyball scoring rules
   */
  private validateScore(input: SubmitScoreInput): void {
    const setErrors: string[] = [];

    // Set 1
    if (input.set1_team1 < 25 || input.set1_team2 < 25) {
      setErrors.push("Set 1: At least one team must reach 25 points");
    }
    if (Math.abs(input.set1_team1 - input.set1_team2) < 2) {
      setErrors.push("Set 1: Winning team must win by 2 points");
    }

    // Set 2
    if (input.set2_team1 < 25 || input.set2_team2 < 25) {
      setErrors.push("Set 2: At least one team must reach 25 points");
    }
    if (Math.abs(input.set2_team1 - input.set2_team2) < 2) {
      setErrors.push("Set 2: Winning team must win by 2 points");
    }

    // Set 3 (if provided)
    if (input.set3_team1 !== undefined && input.set3_team2 !== undefined) {
      if (
        (input.set3_team1 < 15 && input.set3_team2 < 15) ||
        (input.set3_team1 >= 15 &&
          input.set3_team2 >= 15 &&
          Math.abs(input.set3_team1 - input.set3_team2) < 2)
      ) {
        setErrors.push(
          "Set 3: At least one team must reach 15 points and win by 2",
        );
      }
    }

    if (setErrors.length > 0) {
      throw Errors.validationError(setErrors.join("; "));
    }
  }

  /**
   * Determine match winner from score
   */
  private determineWinner(input: SubmitScoreInput): number {
    const team1Wins =
      (input.set1_team1 > input.set1_team2 ? 1 : 0) +
      (input.set2_team1 > input.set2_team2 ? 1 : 0) +
      (input.set3_team1 &&
      input.set3_team2 &&
      input.set3_team1 > input.set3_team2
        ? 1
        : 0);

    return team1Wins >= 2 ? 1 : 2; // 1 = team1, 2 = team2
  }

  /**
   * Submit match score and mark as complete
   */
  async submitScore(matchId: number, input: SubmitScoreInput): Promise<Match> {
    // Validate scoring rules
    this.validateScore(input);

    // Get match to find team IDs
    const match = await this.getById(matchId);

    // Determine winner
    const winnerTeamNumber = this.determineWinner(input);
    const winnerTeamId =
      winnerTeamNumber === 1 ? match.team1_id : match.team2_id;

    // Update match with scores
    const result = await queryOne(
      `UPDATE matches SET
        set1_team1 = $1, set1_team2 = $2,
        set2_team1 = $3, set2_team2 = $4,
        set3_team1 = $5, set3_team2 = $6,
        status = $7, winner_team_id = $8,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        input.set1_team1,
        input.set1_team2,
        input.set2_team1,
        input.set2_team2,
        input.set3_team1 || null,
        input.set3_team2 || null,
        "COMPLETE",
        winnerTeamId,
        matchId,
      ],
    );

    if (!result) {
      throw Errors.notFound(`Match ${matchId} not found`);
    }

    return result as Match;
  }

  /**
   * Update match status
   */
  async updateStatus(matchId: number, status: MatchStatus): Promise<Match> {
    const result = await queryOne(
      `UPDATE matches SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, matchId],
    );

    if (!result) {
      throw Errors.notFound(`Match ${matchId} not found`);
    }

    return result as Match;
  }

  /**
   * Get match count by status for a pool
   */
  async countByPoolAndStatus(
    poolId: number,
    status: MatchStatus,
  ): Promise<number> {
    const result = await queryOne(
      "SELECT COUNT(*) as count FROM matches WHERE pool_id = $1 AND status = $2",
      [poolId, status],
    );
    return (result as any).count;
  }

  /**
   * Get match count by status for a tournament
   */
  async countByTournamentAndStatus(
    tournamentId: number,
    status: MatchStatus,
  ): Promise<number> {
    const result = await queryOne(
      "SELECT COUNT(*) as count FROM matches WHERE tournament_id = $1 AND status = $2",
      [tournamentId, status],
    );
    return (result as any).count;
  }
}

export const matchService = new MatchService();
