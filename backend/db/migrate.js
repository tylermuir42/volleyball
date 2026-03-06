#!/usr/bin/env node
/**
 * Database Migration Runner
 * 
 * Usage:
 *   node db/migrate.js              # Uses .env variables
 *   DB_HOST=localhost node db/migrate.js
 * 
 * Environment Variables:
 *   DB_HOST - Database hostname (default: localhost)
 *   DB_PORT - Database port (default: 5432)
 *   DB_USER - Database user (default: postgres)
 *   DB_PASSWORD - Database password (required)
 *   DB_NAME - Database name (default: tournament_db)
 *   SEED - Whether to run seed data (default: true)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
    database: process.env.DB_NAME || 'tournament_db',
};

const MIGRATIONS = [
    'migrations/001_init_schema.sql',
    'migrations/002_seed_data.sql',
];

const SCHEMA_ONLY = [
    'migrations/001_init_schema.sql',
];

async function readMigrationFile(migrationPath) {
    const fullPath = path.join(__dirname, migrationPath);
    try {
        return fs.readFileSync(fullPath, 'utf8');
    } catch (error) {
        throw new Error(`Failed to read migration file ${migrationPath}: ${error.message}`);
    }
}

async function runMigrations(client, migrationsToRun) {
    console.log('\n📝 Running Database Migrations...\n');

    for (const migration of migrationsToRun) {
        try {
            const sql = await readMigrationFile(migration);

            console.log(`⏳ Running: ${migration}`);

            // Split by semicolons and execute statements individually
            const statements = sql
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

            for (const statement of statements) {
                try {
                    await client.query(statement);
                } catch (error) {
                    // Log but continue for some errors (e.g., "relation already exists")
                    if (!error.message.includes('already exists')) {
                        throw error;
                    }
                    // Silently skip if table already exists
                }
            }

            console.log(`✅ Completed: ${migration}\n`);
        } catch (error) {
            console.error(`❌ Failed on ${migration}:`);
            console.error(error.message);
            throw error;
        }
    }
}

async function verifyConnection(client) {
    try {
        const result = await client.query('SELECT version();');
        console.log('✅ Connected to PostgreSQL');
        console.log(`   Version: ${result.rows[0].version.split(',')[0]}`);
        return true;
    } catch (error) {
        throw new Error(`Failed to connect to database: ${error.message}`);
    }
}

async function createDatabaseIfNotExists(superUserClient, dbName) {
    try {
        const result = await superUserClient.query(
            `SELECT datname FROM pg_database WHERE datname = $1`,
            [dbName]
        );

        if (result.rows.length === 0) {
            console.log(`📦 Creating database: ${dbName}`);
            await superUserClient.query(`CREATE DATABASE ${dbName}`);
            console.log(`✅ Database created: ${dbName}\n`);
        } else {
            console.log(`✅ Database exists: ${dbName}\n`);
        }
    } catch (error) {
        throw new Error(`Failed to create database: ${error.message}`);
    }
}

async function main() {
    console.log('\n🏐 Southern LA Volleyball Tournament System - Database Migration\n');
    console.log('Configuration:');
    console.log(`  Host:     ${config.host}`);
    console.log(`  Port:     ${config.port}`);
    console.log(`  User:     ${config.user}`);
    console.log(`  Database: ${config.database}`);

    // First, connect as postgres to create DB if needed
    if (config.user === 'postgres') {
        const superUserClient = new Client({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: 'postgres', // Connect to default postgres db
        });

        try {
            await superUserClient.connect();
            console.log('✅ Connected to PostgreSQL (superuser)\n');
            await createDatabaseIfNotExists(superUserClient, config.database);
            await superUserClient.end();
        } catch (error) {
            console.error('❌ Error connecting as superuser:');
            console.error(error.message);
            process.exit(1);
        }
    }

    // Now connect to the target database
    const client = new Client(config);

    try {
        await client.connect();
        await verifyConnection(client);

        // Determine which migrations to run
        const args = process.argv.slice(2);
        const shouldSeed = !args.includes('--schema-only');
        const migrationsToRun = shouldSeed ? MIGRATIONS : SCHEMA_ONLY;

        if (!shouldSeed) {
            console.log('⚠️  Running schema-only migrations (use migrations/002_seed_data.sql separately if desired)\n');
        }

        await runMigrations(client, migrationsToRun);

        console.log('\n✨ All migrations completed successfully!');
        console.log('\nNext steps:');
        console.log('  1. Verify schema: psql -h ' + config.host + ' -U ' + config.user + ' -d ' + config.database + ' -c "\\dt"');
        console.log('  2. Check standings: psql -h ' + config.host + ' -U ' + config.user + ' -d ' + config.database + ' -c "SELECT * FROM pool_standings;"');
        console.log('  3. Start your backend server\n');

    } catch (error) {
        console.error('\n❌ Migration failed:');
        console.error(error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Run
main().catch(error => {
    console.error(error);
    process.exit(1);
});
