## Phase 3 E2E Smoke Test (EventBridge + WebSocket)

Use this runbook to validate the full live-update path:

`score submit -> backend event publish -> EventBridge rule -> ws-broadcast Lambda -> frontend UI refresh`

---

## 1) Prerequisites

- Backend deployed and reachable (local or ECS/App Runner).
- Frontend running and reachable (local Vite or Amplify).
- WebSocket stack deployed (`ws-connect`, `ws-message`, `ws-disconnect`, `ws-broadcast`).
- EventBridge bus and rule active (rule targets `ws-broadcast` Lambda).
- At least one tournament with pools/matches in DB.

### Frontend env

```env
VITE_API_BASE_URL=<backend-base-url>
VITE_WS_URL=wss://<api-id>.execute-api.<region>.amazonaws.com/<stage>
```

---

## 2) Quick Pre-checks

### API health

```powershell
Invoke-RestMethod -Method GET -Uri "<backend-base-url>/health"
```

Expected: HTTP 200.

### Tournaments list

```powershell
Invoke-RestMethod -Method GET -Uri "<backend-base-url>/tournaments"
```

Expected: JSON array with at least one tournament.

---

## 3) Browser setup for live check

1. Open **two browser windows** to the same tournament page:
   - Admin: `/tournaments/<id>`
   - Public: `/public/tournaments/<id>`
2. Confirm both pages show websocket or polling status badges.
3. In at least one window, keep devtools console open (for visibility if needed).

---

## 4) Trigger an event by submitting score

Option A: Use Admin UI “Save Score” on a scheduled match.

Option B: Call API directly:

```powershell
$payload = @{
  set1_team1 = 25
  set1_team2 = 18
  set2_team1 = 25
  set2_team2 = 21
} | ConvertTo-Json

Invoke-RestMethod -Method POST -Uri "<backend-base-url>/matches/<match-id>/score" -ContentType "application/json" -Body $payload
```

Expected API result:

- Match status becomes `COMPLETE`
- `winner_team_id` is set

---

## 5) Verify full event path

### Backend publish check

Look for backend logs indicating EventBridge publish attempts/results for:

- `MatchCompleted`
- `StandingsUpdated`
- `PoolCompleted` (only when pool is fully complete)

### EventBridge/Lambda check

In CloudWatch logs for `ws-broadcast` Lambda, verify invocation after score submit.

### Frontend live update check

In the second browser window (no manual refresh):

- Match status updates to `COMPLETE`
- Standings update reflects new result
- Bracket page (if open) refreshes if relevant events exist

---

## 6) Pass/Fail Criteria

Mark PASS only if all are true:

- [ ] `POST /matches/:id/score` returns success
- [ ] Backend emits `MatchCompleted`
- [ ] Backend emits `StandingsUpdated` for pool matches
- [ ] EventBridge rule invokes `ws-broadcast`
- [ ] Second browser window updates without manual refresh

---

## 7) Fast Troubleshooting

### No frontend live update

- Verify `VITE_WS_URL` is set correctly.
- Confirm websocket route subscription works (`SUBSCRIBE_TOURNAMENT`).
- Confirm connection records exist in DynamoDB connections table.

### Backend saves score but no Lambda invocation

- Verify backend env has:
  - `EVENT_BUS_NAME` (or `EVENTBRIDGE_BUS_NAME`)
  - `EVENTBRIDGE_ENABLED=true`
- Check EventBridge rule event pattern includes `source=volleyball.backend` and detail types.

### Lambda invoked but no clients updated

- Validate `WS_API_ENDPOINT` env in `ws-broadcast` Lambda.
- Check for stale connections (410 errors) and cleanup behavior.
- Confirm `tournamentId` in emitted detail matches subscribed clients.

---

## 8) Suggested smoke matrix (repeat quickly)

- Match in Pool A updates both Admin + Public.
- Another match in a different pool updates only same tournament viewers.
- Final match in a pool triggers `PoolCompleted`.

If all three pass, Phase 3 live-update flow is healthy.
