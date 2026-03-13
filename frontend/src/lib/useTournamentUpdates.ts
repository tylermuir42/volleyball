import { useEffect, useRef, useState } from "react";

type RealtimeMode = "websocket" | "polling";

type UseTournamentUpdatesOptions = {
  tournamentId: number;
  refresh: () => Promise<void> | void;
  pollMs?: number;
};

type RealtimeState = {
  mode: RealtimeMode;
  socketConnected: boolean;
};

const updateEventNames = new Set([
  "StandingsUpdated",
  "MatchCompleted",
  "BracketGenerated",
  "PoolCompleted",
]);

export function useTournamentUpdates({
  tournamentId,
  refresh,
  pollMs = 2000,
}: UseTournamentUpdatesOptions): RealtimeState {
  const [mode, setMode] = useState<RealtimeMode>("polling");
  const [socketConnected, setSocketConnected] = useState(false);

  const pollRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) {
      return;
    }

    const wsBase = import.meta.env.VITE_WS_URL as string | undefined;

    const clearPolling = () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const startPolling = () => {
      setMode("polling");
      setSocketConnected(false);
      if (pollRef.current !== null) {
        return;
      }

      pollRef.current = window.setInterval(() => {
        void Promise.resolve(refresh());
      }, pollMs);
    };

    if (!wsBase) {
      startPolling();
      return () => {
        clearPolling();
      };
    }

    let closedByCleanup = false;

    try {
      const socket = new WebSocket(wsBase);
      socketRef.current = socket;
      setMode("websocket");

      socket.onopen = () => {
        setSocketConnected(true);
        clearPolling();
        socket.send(
          JSON.stringify({
            type: "SUBSCRIBE_TOURNAMENT",
            tournamentId,
          }),
        );
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as {
            type?: string;
            eventType?: string;
            detailType?: string;
            tournamentId?: number;
          };

          const messageType =
            message.type || message.eventType || message.detailType || "";

          if (
            updateEventNames.has(messageType) ||
            message.tournamentId === tournamentId
          ) {
            void Promise.resolve(refresh());
          }
        } catch {
          void Promise.resolve(refresh());
        }
      };

      socket.onerror = () => {
        startPolling();
      };

      socket.onclose = () => {
        if (!closedByCleanup) {
          startPolling();
        }
      };

      return () => {
        closedByCleanup = true;
        clearPolling();
        setSocketConnected(false);

        if (socketRef.current) {
          try {
            socketRef.current.close();
          } catch {
            // ignore close failures
          }
          socketRef.current = null;
        }
      };
    } catch {
      startPolling();
      return () => {
        clearPolling();
      };
    }
  }, [pollMs, refresh, tournamentId]);

  return {
    mode,
    socketConnected,
  };
}
