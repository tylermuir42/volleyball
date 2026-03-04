import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Pool } from "pg";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 4000;

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  // In local/dev we fail fast; in ECS this should be set via env var/secret.
  console.warn("DATABASE_URL is not set. Database operations will fail until configured.");
}

const dbPool = dbUrl
  ? new Pool({
      connectionString: dbUrl,
    })
  : undefined;

const awsRegion = process.env.AWS_REGION || "us-west-2";
const eventBusName = process.env.EVENT_BUS_NAME || "volleyball-events";

const eventBridgeClient = new EventBridgeClient({ region: awsRegion });

app.get("/health", async (_req, res) => {
  try {
    if (dbPool) {
      await dbPool.query("SELECT 1");
    }
    res.json({ status: "ok" });
  } catch (err) {
    console.error("Health check failed", err);
    res.status(500).json({ status: "error" });
  }
});

// Minimal example endpoint to create a tournament row.
// Schema will be evolved later with proper migrations.
app.post("/tournaments", async (req, res) => {
  if (!dbPool) {
    res.status(500).json({ error: "Database not configured" });
    return;
  }

  const { name, date } = req.body;

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  try {
    const result = await dbPool.query(
      `
      INSERT INTO tournaments (name, date, status)
      VALUES ($1, $2, 'CREATED')
      RETURNING id, name, date, status
      `,
      [name, date || null]
    );

    const tournament = result.rows[0];

    // Fire a simple domain event via EventBridge so the cloud side can react.
    try {
      await eventBridgeClient.send(
        new PutEventsCommand({
          Entries: [
            {
              EventBusName: eventBusName,
              Source: "volleyball.backend",
              DetailType: "TournamentCreated",
              Detail: JSON.stringify({
                tournamentId: tournament.id,
                name: tournament.name,
              }),
            },
          ],
        })
      );
    } catch (eventErr) {
      console.error("Failed to put TournamentCreated event", eventErr);
      // Do not fail the request on event error in this initial version.
    }

    res.status(201).json(tournament);
  } catch (err) {
    console.error("Failed to create tournament", err);
    res.status(500).json({ error: "Failed to create tournament" });
  }
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});

