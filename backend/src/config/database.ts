/**
 * Database Configuration & Connection Pool
 * Manages PostgreSQL connections using the pg library
 */

import { Pool, PoolClient } from "pg";
import { config } from "./env";

let pool: Pool | null = null;

/**
 * Initialize the database connection pool
 */
export function initializeDb(): Pool {
  if (pool) {
    return pool;
  }

  const poolConfig = config.DATABASE.URL
    ? {
        connectionString: config.DATABASE.URL,
        max: config.DATABASE.POOL_SIZE,
        idleTimeoutMillis: config.DATABASE.IDLE_TIMEOUT,
      }
    : {
        host: config.DATABASE.HOST,
        port: config.DATABASE.PORT,
        user: config.DATABASE.USER,
        password: config.DATABASE.PASSWORD,
        database: config.DATABASE.NAME,
        max: config.DATABASE.POOL_SIZE,
        idleTimeoutMillis: config.DATABASE.IDLE_TIMEOUT,
      };

  pool = new Pool(poolConfig);

  // Log pool errors but don't crash
  pool.on("error", (err: Error) => {
    console.error("Unexpected error on idle client", err);
  });

  return pool;
}

/**
 * Get the database pool instance
 */
export function getDb(): Pool {
  if (!pool) {
    throw new Error("Database not initialized. Call initializeDb() first.");
  }
  return pool;
}

/**
 * Health check query
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    const result = await getDb().query("SELECT 1");
    return result.rowCount === 1;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}

/**
 * Gracefully close the connection pool
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("✓ Database pool closed");
  }
}

/**
 * Execute a query and return rows directly
 * Use this for simple, one-off queries
 */
export async function query(
  text: string,
  values?: Array<unknown>,
): Promise<unknown[]> {
  const result = await getDb().query(text, values);
  return result.rows;
}

/**
 * Execute a query and return the first row
 */
export async function queryOne(
  text: string,
  values?: Array<unknown>,
): Promise<unknown | null> {
  const result = await getDb().query(text, values);
  return result.rows[0] || null;
}

/**
 * Execute a query and return count of affected rows
 */
export async function execute(
  text: string,
  values?: Array<unknown>,
): Promise<number> {
  const result = await getDb().query(text, values);
  return result.rowCount || 0;
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  return getDb().connect();
}
