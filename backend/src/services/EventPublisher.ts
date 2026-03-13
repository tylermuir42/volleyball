import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import { config } from "../config/env";
import { Match, Standing } from "../types";

type EventDetailType = "MatchCompleted" | "StandingsUpdated" | "PoolCompleted";

type MatchCompletedDetail = {
  type: "MatchCompleted";
  tournamentId: number;
  matchId: number;
  poolId: number | null;
  bracketId: number | null;
  team1Id: number;
  team2Id: number;
  winnerTeamId: number | null;
  sets: {
    set1: { team1: number | null; team2: number | null };
    set2: { team1: number | null; team2: number | null };
    set3: { team1: number | null; team2: number | null };
  };
  completedAt: string;
};

type StandingsUpdatedDetail = {
  type: "StandingsUpdated";
  tournamentId: number;
  poolId: number;
  standings: Standing[];
  updatedAt: string;
};

type PoolCompletedDetail = {
  type: "PoolCompleted";
  tournamentId: number;
  poolId: number;
  completedAt: string;
};

export class EventPublisher {
  private readonly client: EventBridgeClient;
  private readonly busName: string;
  private readonly enabled: boolean;

  constructor() {
    this.client = new EventBridgeClient({ region: config.AWS.REGION });
    this.busName = config.EVENTBRIDGE.BUS_NAME;
    this.enabled = config.EVENTBRIDGE.ENABLED;
  }

  private async publish(
    detailType: EventDetailType,
    detail: MatchCompletedDetail | StandingsUpdatedDetail | PoolCompletedDetail,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const command = new PutEventsCommand({
      Entries: [
        {
          EventBusName: this.busName,
          Source: "volleyball.backend",
          DetailType: detailType,
          Detail: JSON.stringify(detail),
          Time: new Date(),
        },
      ],
    });

    const result = await this.client.send(command);

    if ((result.FailedEntryCount || 0) > 0) {
      console.error("⚠️ EventBridge publish failed", {
        detailType,
        failedEntryCount: result.FailedEntryCount,
        entries: result.Entries,
      });
    }
  }

  async publishMatchCompleted(match: Match): Promise<void> {
    await this.publish("MatchCompleted", {
      type: "MatchCompleted",
      tournamentId: match.tournament_id,
      matchId: match.id,
      poolId: match.pool_id,
      bracketId: match.bracket_id,
      team1Id: match.team1_id,
      team2Id: match.team2_id,
      winnerTeamId: match.winner_team_id,
      sets: {
        set1: { team1: match.set1_team1, team2: match.set1_team2 },
        set2: { team1: match.set2_team1, team2: match.set2_team2 },
        set3: { team1: match.set3_team1, team2: match.set3_team2 },
      },
      completedAt: new Date().toISOString(),
    });
  }

  async publishStandingsUpdated(
    tournamentId: number,
    poolId: number,
    standings: Standing[],
  ): Promise<void> {
    await this.publish("StandingsUpdated", {
      type: "StandingsUpdated",
      tournamentId,
      poolId,
      standings,
      updatedAt: new Date().toISOString(),
    });
  }

  async publishPoolCompleted(
    tournamentId: number,
    poolId: number,
  ): Promise<void> {
    await this.publish("PoolCompleted", {
      type: "PoolCompleted",
      tournamentId,
      poolId,
      completedAt: new Date().toISOString(),
    });
  }
}

export const eventPublisher = new EventPublisher();
