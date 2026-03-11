## Step 5 – WebSocket Real‑Time Layer (API Gateway + Lambda + DynamoDB + Frontend)

This guide assumes:
- Backend + RDS + ECS + ALB are already running.
- EventBridge bus is (or soon will be) created by Terraform.
- You are working in **`us-east-1`** with the lab account.

There are two parallel tracks: **Cloud Engineer** (AWS infra) and **Software Engineer** (frontend WebSocket client + message handling).

---

### A. Cloud Engineer – AWS Resources

#### 1. Create DynamoDB table for WebSocket connections

Goal: store each WebSocket connection with what it cares about (e.g., which tournament).

Recommended schema:
- **Table name**: `volleyball-websocket-connections`
- **Partition key**: `pk` (string) – e.g. `"tournament#<tournamentId>"`
- **Sort key**: `sk` (string) – e.g. `"connection#<connectionId>"`

You can create this via console or Terraform:
- If another Terraform stack is already managing EventBridge, add a new `dynamodb_table` to that stack or create a small `websockets.tf` in `infra/terraform`.

Store attributes per item:
- `connectionId` – API Gateway connection ID
- `tournamentId` – numeric or string id
- (optional) `teamId` – for future, team‑level subscriptions

#### 2. API Gateway WebSocket API

Create a **WebSocket API** in API Gateway (console is fine for this lab):

- **Route selection expression**: `$request.body.action`
- Routes:
  - `$connect`
  - `$disconnect`
  - `message` (for subscribe/unsubscribe messages)

For each route, attach a Lambda integration:
- `$connect` → `volleyball-ws-connect`
- `$disconnect` → `volleyball-ws-disconnect`
- `message` → `volleyball-ws-message`

Deploy the WebSocket API:
- Create a **stage** (e.g., `prod`).
- Note the WebSocket URL: `wss://<api-id>.execute-api.us-east-1.amazonaws.com/prod`
  - This will become `NEXT_PUBLIC_WS_URL` on the frontend.

#### 3. Lambda functions for WebSocket lifecycle

Create three Node.js 18+ Lambdas:

1. **Connect handler (`volleyball-ws-connect`)**
   - Trigger: `$connect` route.
   - Responsibilities:
     - Read `connectionId` from `event.requestContext.connectionId`.
     - Optionally read query string for `tournamentId` (e.g., clients can connect with `?tournamentId=123`).
     - Put an item into DynamoDB table with:
       - `pk = "tournament#<tournamentId>"` (or a generic `"all"` if unknown)
       - `sk = "connection#<connectionId>"`
       - plus `connectionId`, `tournamentId`.

2. **Disconnect handler (`volleyball-ws-disconnect`)**
   - Trigger: `$disconnect` route.
   - Responsibilities:
     - Read `connectionId` from `event.requestContext.connectionId`.
     - Delete corresponding item(s) from DynamoDB.
       - If you don’t know the exact partition key, consider storing a reverse lookup or just do a scan for lab/demo scope.

3. **Message handler (`volleyball-ws-message`)**
   - Trigger: `message` route.
   - Responsibilities:
     - Parse `event.body` JSON; expect something like:
       - `{ "action": "SUBSCRIBE_TOURNAMENT", "tournamentId": "123" }`
     - Update DynamoDB to:
       - Move this `connectionId` into the partition for `tournament#123`.
     - Optionally send an ACK back to the client via ApiGatewayManagementApi.

**IAM permissions** for these Lambdas:
- Allow `dynamodb:PutItem`, `dynamodb:DeleteItem`, `dynamodb:UpdateItem`, `dynamodb:Query` on the connections table.
- Allow `execute-api:ManageConnections` on the WebSocket API for ACKs (if used).

#### 4. Broadcast Lambda subscribed to EventBridge

Create a Lambda (e.g., `volleyball-ws-broadcast`) with:

- **Trigger**: EventBridge rule matching your domain events:
  - Source: `volleyball.backend`
  - Detail types: `MatchCompleted`, `StandingsUpdated`, `BracketGenerated`, etc.
- **Logic**:
  1. Parse the EventBridge event:
     - `detail.tournamentId` (required)
     - include any payload needed by the frontend (match id, updated standings, etc.)
  2. Query DynamoDB:
     - `pk = "tournament#<tournamentId>"`
     - Collect all `connectionId`s.
  3. Use **ApiGatewayManagementApi** to send updates:
     - Instantiate with:
       - `endpoint: "https://<api-id>.execute-api.us-east-1.amazonaws.com/prod"`
     - For each connection:
       - `postToConnection({ ConnectionId, Data: JSON.stringify(eventPayloadForClient) })`
  4. If a connection is gone (410 Gone), delete it from DynamoDB.

**IAM permissions**:
- `dynamodb:Query`, `dynamodb:DeleteItem` on connections table.
- `execute-api:ManageConnections` on your WebSocket API.

---

### B. Software Engineer – Frontend WebSocket Client

#### 1. Add WebSocket URL config

In the frontend app (Next.js), add an environment variable:

- `NEXT_PUBLIC_WS_URL=wss://<api-id>.execute-api.us-east-1.amazonaws.com/prod`

Use it in a small client helper (e.g., `frontend/lib/wsClient.ts`):

- Create a function to:
  - Open a `WebSocket` connection using `NEXT_PUBLIC_WS_URL + "?tournamentId=<id>"` or connect and then send a subscribe message.
  - Listen for `onmessage` and dispatch updates into React state or a global store.

#### 2. Message contract

Agree with backend/broadcast Lambda on a simple JSON shape, for example:

- **Inbound from client → API Gateway (`message` route)**:
  - Subscribe:
    - `{ "action": "SUBSCRIBE_TOURNAMENT", "tournamentId": "123" }`
  - (Optional) unsubscribe:
    - `{ "action": "UNSUBSCRIBE_TOURNAMENT", "tournamentId": "123" }`

- **Outbound from broadcast Lambda → client**:
  - For standings update:
    - `{ "type": "STANDINGS_UPDATED", "tournamentId": "123", "poolId": "A", "standings": [...] }`
  - For match result:
    - `{ "type": "MATCH_COMPLETED", "tournamentId": "123", "matchId": "456", "winnerTeamId": "..." }`
  - Later, for brackets:
    - `{ "type": "BRACKET_UPDATED", "tournamentId": "123", "bracketId": "gold", "bracket": {...} }`

#### 3. Integrate into key pages

On the main tournament view (pools/standings/brackets):

1. On mount:
   - Open WebSocket connection.
   - Send `SUBSCRIBE_TOURNAMENT` with the current tournament ID if not passed in query.
2. On message:
   - If `type === "STANDINGS_UPDATED"` → update standings state.
   - If `type === "MATCH_COMPLETED"` → update match result state.
   - If `type === "BRACKET_UPDATED"` → update bracket UI.
3. On unmount:
   - Close the WebSocket connection.

---

### C. Verification Checklist

- **WebSocket API**
  - `$connect` and `$disconnect` are invoked (check CloudWatch logs).
  - `message` route correctly updates DynamoDB when clients subscribe.
- **DynamoDB**
  - Items appear with `pk = "tournament#<id>"` when clients subscribe.
- **Broadcast Lambda**
  - Triggered when `MatchCompleted` or `StandingsUpdated` events are published on EventBridge.
  - Successfully calls `postToConnection` and no longer‑used connections are cleaned up.
- **Frontend**
  - When a site director submits a score (once wired), connected browsers update standings/brackets **without refresh**.

