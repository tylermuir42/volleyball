/**
 * Location Service
 * Handles location and court management
 */

import { query, queryOne, execute } from "../config/database";
import { Location, Court, CreateCourtInput } from "../types";
import { Errors } from "../middleware/errorHandler";

export class LocationService {
  /**
   * Create a location for a tournament
   */
  async create(
    tournamentId: number,
    name: string,
    maxCourts: number,
  ): Promise<Location> {
    const result = await queryOne(
      `INSERT INTO locations (tournament_id, name, max_courts)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [tournamentId, name, maxCourts],
    );

    if (!result) {
      throw Errors.internalError("Failed to create location");
    }

    return result as Location;
  }

  /**
   * Get all locations for a tournament
   */
  async listByTournament(tournamentId: number): Promise<Location[]> {
    const result = await query(
      "SELECT * FROM locations WHERE tournament_id = $1 ORDER BY name",
      [tournamentId],
    );
    return result as Location[];
  }

  /**
   * Get location by ID
   */
  async getById(id: number): Promise<Location> {
    const result = await queryOne("SELECT * FROM locations WHERE id = $1", [
      id,
    ]);

    if (!result) {
      throw Errors.notFound(`Location ${id} not found`);
    }

    return result as Location;
  }

  /**
   * Add court to location
   */
  async addCourt(locationId: number, input: CreateCourtInput): Promise<Court> {
    // Verify location exists
    await this.getById(locationId);

    const result = await queryOne(
      `INSERT INTO courts (location_id, label)
       VALUES ($1, $2)
       RETURNING *`,
      [locationId, input.label],
    );

    if (!result) {
      throw Errors.internalError("Failed to create court");
    }

    return result as Court;
  }

  /**
   * Get courts for a location
   */
  async getCourtsByLocation(locationId: number): Promise<Court[]> {
    const result = await query(
      "SELECT * FROM courts WHERE location_id = $1 ORDER BY label",
      [locationId],
    );
    return result as Court[];
  }

  /**
   * Get all courts for a tournament
   */
  async getCourtsByTournament(
    tournamentId: number,
  ): Promise<(Court & { location_name: string })[]> {
    const result = await query(
      `SELECT c.*, l.name as location_name
       FROM courts c
       JOIN locations l ON c.location_id = l.id
       WHERE l.tournament_id = $1
       ORDER BY l.name, c.label`,
      [tournamentId],
    );
    return result as (Court & { location_name: string })[];
  }

  /**
   * Delete location (cascades to courts)
   */
  async delete(id: number): Promise<void> {
    const rowCount = await execute("DELETE FROM locations WHERE id = $1", [id]);

    if (rowCount === 0) {
      throw Errors.notFound(`Location ${id} not found`);
    }
  }
}

export const locationService = new LocationService();
