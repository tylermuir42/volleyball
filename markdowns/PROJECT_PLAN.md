## Southern LA Volleyball Tournament System – Implementation Plan (AWS + AWS SDK)

This plan turns the scenario into a 2‑week, 4‑person cloud project using AWS and the AWS SDK (v3). It assumes:
- **Frontend**: Next.js (TypeScript)
- **Backend**: Node.js/TypeScript (Express or Fastify) using **AWS SDK v3**
- **Infra**: AWS (RDS Postgres, API Gateway WebSockets, EventBridge, Lambda, DynamoDB, SNS, ECS/App Runner/Amplify)

### 1. Product Goals & Scope

- **Primary goal**: Cloud‑hosted, event‑driven, real‑time tournament manager that:
  - Centralizes tournament state (pools, matches, brackets, locations).
  - Automates **seeding & bracket generation**.
  - Pushes **real‑time updates** to all clients via WebSockets.
  - Supports **multi‑location** tournaments and basic **duty assignments**.
- **Non‑goals for 2 weeks** (can be stretch):
  - Full production‑grade auth & multi‑tenant billing.
  - Native mobile apps.
  - Deep analytics and historical reporting.

### 2. High‑Level Architecture (AWS)

- **Frontend (Next.js)**  
  - Hosted via **AWS Amplify** or **S3 + CloudFront**.  
  - Uses **REST API** for commands/queries and **WebSocket** for live updates.

- **Backend API (Node.js + AWS SDK)**  
  - Runs on **AWS App Runner** (simpler) or **ECS Fargate**.  
  - Exposes REST endpoints for:
    - Tournament management (CRUD).
    - Score submission.
    - Seeding and bracket operations (triggered by events).
  - Uses **AWS SDK v3** to:
    - Publish/consume **EventBridge** events.
    - Call **SNS** for notifications (stretch).

- **Database (Amazon RDS – PostgreSQL)**  
  - Central relational model for:
    - `tournaments`, `locations`, `courts`, `pools`, `teams`, `matches`, `brackets`, `duties`.

- **Real‑Time Layer (API Gateway WebSocket + Lambda + DynamoDB)**  
  - **API Gateway WebSocket API** for client connections.  
  - **Lambda (connect/disconnect/default handlers)** using AWS SDK:
    - On `CONNECT`: store `connectionId` in **DynamoDB**.
    - On `DISCONNECT`: delete `connectionId`.  
  - **Broadcast Lambda** subscribed to **EventBridge**:
    - On domain events (e.g., `MatchCompleted`, `StandingsUpdated`, `BracketGenerated`), fetch relevant connections and post messages back via the **ApiGatewayManagementApi** client.

- **Event System (EventBridge)**  
  - Central event bus for domain events:
    - `MatchCompleted`, `PoolCompleted`, `StandingsUpdated`, `BracketGenerated`, `DutyReminderRequested`, etc.
  - Backend API publishes events using **AWS SDK v3 EventBridgeClient**.
  - Lambdas subscribe via EventBridge rules to react and fan‑out.

- **Notifications (SNS – stretch)**  
  - Use **SNSClient** to send coach emails or SMS for:
    - New bracket assignments.
    - Upcoming ref duties.

### 3. Core Domain & Data Model (DB‑First View)

Relational schema in Postgres (simplified):

- **Tournament**
  - `id`, `name`, `date`, `status` (`CREATED`, `POOL_PLAY_ACTIVE`, `POOL_PLAY_COMPLETE`, `BRACKETS_GENERATED`, `BRACKET_PLAY_ACTIVE`, `COMPLETE`)
- **Location**
  - `id`, `tournament_id`, `name`, `max_courts`
- **Court**
  - `id`, `location_id`, `label` (e.g. “Court 1”)
- **Team**
  - `id`, `tournament_id`, `name`, `coach_name`, `coach_email`
- **Pool**
  - `id`, `tournament_id`, `location_id`, `court_id`, `name` (e.g. “Pool A”)
- **PoolTeam**
  - `id`, `pool_id`, `team_id`, `seed_in_pool`
- **Match**
  - `id`, `tournament_id`, `pool_id` (nullable), `bracket_id` (nullable),
  - `team1_id`, `team2_id`,
  - `set1_team1`, `set1_team2`, `set2_team1`, `set2_team2`, `set3_team1`, `set3_team2` (nullable),
  - `status` (`SCHEDULED`, `IN_PROGRESS`, `COMPLETE`),
  - `winner_team_id` (nullable),
  - `court_id`, `start_time` (nullable)
- **Bracket**
  - `id`, `tournament_id`, `name` (Gold/Silver/etc.), `size` (4/8/12), `location_id`
- **BracketSlot**
  - `id`, `bracket_id`, `seed`, `team_id` (nullable), `source_pool_id` (nullable), `source_pool_rank` (nullable)
- **Duty**
  - `id`, `match_id`, `team_id`, `role` (`REF`, `LINE_JUDGE`), `status`

### 4. Event‑Driven Domain Model

We treat key state changes as **events** on EventBridge:

- **Events**
  - `MatchCompleted`
  - `StandingsUpdated`
  - `PoolCompleted`
  - `BracketGenerated`
  - `DutyReminderRequested`

- **Producers**
  - REST API (backend service) publishes:
    - `MatchCompleted` when a match score is submitted and finalized.
    - `StandingsUpdated` after recalculating a pool.
    - `PoolCompleted` when all matches in a pool are `COMPLETE`.
    - `BracketGenerated` when brackets are built.

- **Consumers**
  - **Bracket service Lambda** (or backend listener) reacts to `PoolCompleted` → generates seeds/brackets if conditions met.
  - **WebSocket broadcast Lambda** reacts to:
    - `StandingsUpdated`, `BracketGenerated`, `MatchCompleted` → pushes JSON payloads to subscribed clients.
  - **Notification Lambda** (stretch) listens for `DutyReminderRequested` → triggers SNS notifications.

### 5. AWS SDK Usage Plan (Backend & Lambdas)

Use **AWS SDK for JavaScript v3** in Node.js:

- **EventBridge**
  - `@aws-sdk/client-eventbridge`
  - Used by backend REST API and Lambdas to:
    - `PutEvents` when domain events occur.

- **API Gateway Management API (WebSocket)**
  - `@aws-sdk/client-apigatewaymanagementapi`
  - Used only in broadcast Lambda:
    - `postToConnection` to send updates to specific WebSocket clients.

- **DynamoDB**
  - `@aws-sdk/client-dynamodb` or `@aws-sdk/lib-dynamodb`
  - Used in WebSocket Lambdas to:
    - Store `connectionId` + filters (tournamentId/teamId).
    - Query which connections should receive which event.

- **SNS (stretch)**
  - `@aws-sdk/client-sns`
  - For sending coach email/SMS notifications.

- **RDS Access**
  - Option A (simpler): connect via standard PostgreSQL driver (e.g. `pg`) from backend service (ECS/App Runner).
  - Option B (if Aurora Serverless): use **RDS Data API** (`@aws-sdk/client-rds-data`).
  - The plan assumes **Option A** for speed; cloud engineers just expose RDS endpoint inside VPC.

### 6. API Surface (Initial Endpoints)

REST endpoints (to be refined during implementation):

- **Admin / Setup**
  - `POST /tournaments` – create tournament.
  - `POST /tournaments/:id/locations` – add locations and courts.
  - `POST /tournaments/:id/teams` – bulk add teams.
  - `POST /tournaments/:id/pools/auto-assign` – auto‑assign teams into pools and generate pool matches.

- **Site Director**
  - `GET /tournaments/:id/pools` – list pools, matches, standings.
  - `POST /matches/:id/score` – submit score (pool or bracket).  
    - Backend:
      - Updates DB.
      - Recalculates standings if pool match.
      - Publishes `MatchCompleted` (+ `StandingsUpdated`, `PoolCompleted` when applicable) via EventBridge (AWS SDK).

- **Bracket & Locations**
  - `POST /tournaments/:id/brackets/generate` – manual generation (backup to auto).
  - `GET /tournaments/:id/brackets` – view bracket structures & matches.

- **Public / Coach / Parent**
  - `GET /public/tournaments/:id/overview` – pools, brackets, locations summary.

WebSocket message types (from clients):

- `SUBSCRIBE_TOURNAMENT` – subscribe to updates for one tournament.
- `SUBSCRIBE_TEAM` – subscribe to updates for one team.
- `UNSUBSCRIBE_*` – optional if time permits.

### 7. Frontend UX Scope (Next.js)

- **Views**
  - **Tournament Dashboard (Admin/Site Director)**:
    - Create tournament, locations, pools, teams (simple forms).
    - Pool view: matches, current standings, editable score fields.
  - **Public/Coach View**:
    - Read‑only bracket and pool standings.
    - Clear display of:
      - Next match.
      - Court.
      - Location (gym).
      - Ref duties.

- **Real‑time behaviour**
  - Open WebSocket on page load for a given tournament or team.
  - On `StandingsUpdated` event: update standings table.
  - On `BracketGenerated` event: refresh bracket view.
  - Show minimal loading and error states (don’t over‑polish).

### 8. Work Breakdown & Ownership

**Software Engineers**
- Design DB schema and migrations.
- Implement backend REST API (Express/Fastify + TypeScript).
- Implement tournament state machine and seeding/bracket logic.
- Integrate AWS SDK v3 for EventBridge publishing from API.
- Build Next.js UI for:
  - Pool management & score entry.
  - Bracket visualization.
  - Coach/parent read‑only views.

**Cloud Engineers**
- Provision AWS resources (initially via console, stretch via CDK/Terraform):
  - VPC, subnets, security groups.
  - RDS Postgres instance.
  - App Runner or ECS Fargate service for backend.
  - API Gateway WebSocket API + routes.
  - DynamoDB table for WebSocket connections.
  - EventBridge bus and rules.
  - SNS topics (if used).
- Configure IAM roles/policies for:
  - Backend service → EventBridge.
  - Lambdas → DynamoDB, EventBridge, ApiGatewayManagementApi, SNS.
- Set up basic CI/CD (GitHub → App Runner/Amplify).
- Create CloudWatch dashboards/alarms for key services.

### 9. 2‑Week Timeline (Phased)

#### Week 1 – Core System & Event Skeleton

- **Day 1–2**
  - Cloud:
    - Create VPC, RDS (Postgres), App Runner/ECS service skeleton, EventBridge bus.
  - App:
    - Finalize DB schema and domain model.
    - Scaffold backend (Express/Fastify) and basic Next.js app.
    - Connect backend to RDS (local dev first, then AWS).

- **Day 3–4**
  - App:
    - Implement core entities:
      - Create tournament, locations, teams, pools.
      - Auto‑generate pool matches.
      - Score submission endpoint for pool matches.
    - Implement standings calculation (wins, points differential).
  - Cloud:
    - Add EventBridge client usage to backend (`PutEvents` on `MatchCompleted` & `StandingsUpdated`).
    - Define EventBridge rules for relevant event types.

- **Day 5–6**
  - Cloud:
    - Implement WebSocket connect/disconnect Lambdas + DynamoDB storage.
    - Implement broadcast Lambda listening to EventBridge events and pushing via ApiGatewayManagementApi.
  - App:
    - Frontend WebSocket integration and basic live UI updates for:
      - Standings.
      - Match results.

#### Week 2 – Brackets, Multi‑Location, Duties, Polish

- **Day 7–8**
  - App:
    - Implement seeding algorithm:
      - Order by pool rank, wins, point differential.
      - Handle 3‑team pools with 3‑set matches.
    - Implement 8‑team bracket generator (Gold bracket first).
    - Persist brackets & bracket matches.
    - Expose bracket read endpoints.
  - Cloud:
    - Trigger bracket generation on `PoolCompleted` (EventBridge rule → Lambda or backend hook).
    - Emit `BracketGenerated` event and wire to WebSocket broadcast.

- **Day 9–10**
  - App:
    - Add locations and court assignment logic for brackets:
      - Each bracket assigned to a single location and courts.
    - Extend UI to show:
      - Which gym/location a team should go to.
      - Which court and approximate time.
  - Cloud:
    - Ensure events include location context so WebSocket payloads have human‑readable location data.

- **Day 11–12**
  - App:
    - Introduce simple duty assignment per match (ref team and line‑judge teams).
    - Show duties clearly in team view (“You ref Court X at Y time”).
  - Cloud (stretch):
    - Add SNS integration for coach notifications:
      - On bracket generation or duties.
    - EventBridge → Notification Lambda → SNS using AWS SDK.

- **Day 13–14**
  - Hardening, testing, and demo prep:
    - End‑to‑end flows:
      - Setup → Pool play → Brackets → Bracket play.
    - Edge cases:
      - 3‑team pools.
      - Ties in standings.
    - Basic performance checks (no N+1 queries).
  - Documentation:
    - Architecture diagram.
    - Event flow diagram (who publishes/consumes what).
    - Short “How to run locally” + “How to deploy” sections.

### 10. Deliverables for the Class

- **Running system** on AWS:
  - Public URL for frontend.
  - Live demo of real‑time updates.
- **Architecture documentation**:
  - Diagram of AWS components and data flow.
  - Explanation of event‑driven design and WebSocket integration.
- **Code artifacts**:
  - Backend using AWS SDK v3 for EventBridge / DynamoDB / WebSocket / SNS (stretch).
  - Clear seeding & bracket logic.
- **Demo script**:
  - Create tournament → Enter scores → See live updates → Auto‑generated brackets → Show locations and duties.

