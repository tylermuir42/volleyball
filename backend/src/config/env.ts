/**
 * Environment Configuration
 * Centralizes all environment variable loading with defaults and validation
 */

export const config = {
  // Server
  PORT: parseInt(process.env.PORT || "5000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // Database
  DATABASE: {
    HOST: process.env.DB_HOST || "localhost",
    PORT: parseInt(process.env.DB_PORT || "5432", 10),
    USER: process.env.DB_USER || "postgres",
    PASSWORD: process.env.DB_PASSWORD || "",
    NAME: process.env.DB_NAME || "tournament_db",
    URL: process.env.DATABASE_URL, // Alternative: full connection string
    POOL_SIZE: parseInt(process.env.DB_POOL_SIZE || "10", 10),
    IDLE_TIMEOUT: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || "30000", 10),
    CONNECTION_TIMEOUT: parseInt(
      process.env.DB_POOL_CONNECTION_TIMEOUT || "5000",
      10,
    ),
    SSL: {
      ENABLED: process.env.DB_SSL === "true",
      REJECT_UNAUTHORIZED:
        process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
    },
  },

  // AWS
  AWS: {
    REGION: process.env.AWS_REGION || "us-west-2",
    ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  },

  // EventBridge (ECS Terraform passes EVENT_BUS_NAME)
  EVENTBRIDGE: {
    BUS_NAME: process.env.EVENT_BUS_NAME || process.env.EVENTBRIDGE_BUS_NAME || "volleyball-events",
    ENABLED: process.env.EVENTBRIDGE_ENABLED !== "false", // Enabled by default
  },

  // Additional
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
};

/**
 * Validate critical configuration on startup
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Database configuration
  if (!config.DATABASE.URL && !config.DATABASE.PASSWORD) {
    errors.push("Either DATABASE_URL or DB_PASSWORD must be set");
  }

  // In production, enforce more strict validation
  if (config.NODE_ENV === "production") {
    if (!config.DATABASE.PASSWORD && !config.DATABASE.URL) {
      errors.push("Production requires DB_PASSWORD or DATABASE_URL");
    }
  }

  if (errors.length > 0) {
    console.error("Configuration validation failed:");
    errors.forEach((err) => console.error(`  - ${err}`));
    // Don't exit in development; allow warnings
    if (config.NODE_ENV === "production") {
      process.exit(1);
    }
  }
}

/**
 * Log configuration on startup (safe values only)
 */
export function logConfig(): void {
  console.log("\n📋 Backend Configuration:");
  console.log(`  NODE_ENV: ${config.NODE_ENV}`);
  console.log(`  PORT: ${config.PORT}`);
  console.log(`  LOG_LEVEL: ${config.LOG_LEVEL}`);
  console.log(`\n🗂️  Database:`);
  console.log(`  HOST: ${config.DATABASE.HOST}`);
  console.log(`  PORT: ${config.DATABASE.PORT}`);
  console.log(`  NAME: ${config.DATABASE.NAME}`);
  console.log(`  POOL_SIZE: ${config.DATABASE.POOL_SIZE}`);
  console.log(`  SSL: ${config.DATABASE.SSL.ENABLED}`);
  console.log(`\n🔌 AWS:`);
  console.log(`  REGION: ${config.AWS.REGION}`);
  console.log(`  EventBridge enabled: ${config.EVENTBRIDGE.ENABLED}`);
  console.log("");
}
