## Southern LA Volleyball – 5‑Phase Implementation Plan

This plan is for a 2‑week project with 4 people (2 software engineers, 2 cloud engineers) using **AWS (ECS + RDS + EventBridge + API Gateway WebSockets + Lambda)** and **Next.js + Node/TypeScript**.

### Phase 1 – Foundations & Scaffolding

- **Goals**
  - Agree on architecture and domain boundaries.
  - Scaffold codebases and baseline AWS infrastructure.
- **App Work**
  - Create `backend` (Node/TypeScript + Express or Fastify) with:
    - `/health` endpoint.
    - Basic project structure (src, config, env handling).
  - Create `frontend` (Next.js + TypeScript) with:
    - Landing/dashboard page.
    - Simple “Tournament list” mock view wired to a placeholder API.
- **Cloud Work**
  - In Terraform:
    - Define **AWS provider** configured for the Learner Lab **Lab-role** (via default credentials).
    - Create **VPC**, public subnets, internet gateway, and route tables.
    - Create **RDS Postgres** (small instance, simple security group).
    - Create **ECS cluster** (Fargate) skeleton.
  - Wire backend to local Postgres first; plan environment variables for ECS/RDS.

### Phase 2 – Core Domain & REST API

- **Goals**
  - Have a working CRUD backend for tournaments, pools, teams, and matches backed by RDS.
  - Allow site directors to create tournaments and enter pool scores (without real‑time yet).
- **App Work**
  - Implement Postgres models and migrations for:
    - `tournaments`, `locations`, `courts`, `teams`, `pools`, `pool_teams`, `matches`.
  - REST endpoints:
    - `POST /tournaments`, `POST /tournaments/:id/locations`, `POST /tournaments/:id/teams`.
    - `POST /tournaments/:id/pools/auto-assign` to auto‑create pools and pool matches.
    - `GET /tournaments/:id/pools` to show pools, matches, and standings.
    - `POST /matches/:id/score` to submit scores and recalc standings.
  - Implement standings logic (wins, point differential, pool ranking).
  - Hook frontend pages to these APIs for basic admin/site‑director flows.
- **Cloud Work**
  - Complete Terraform for:
    - ECS task definition & service (backend container).
    - Security groups: ECS ↔ RDS, internet access via NAT/public.
    - Application Load Balancer (ALB) in front of ECS backend.
  - Containerize backend and run it on ECS against RDS.

### Phase 3 – Event‑Driven Core & Real‑Time Updates

- **Goals**
  - Introduce EventBridge events and WebSocket‑based real‑time UI updates.
  - Demonstrate distributed, event‑driven behavior (important for the cloud class).
- **App Work**
  - Use **AWS SDK v3** in backend to publish domain events (`MatchCompleted`, `StandingsUpdated`, `PoolCompleted`) to **EventBridge** on score submission and pool completion.
  - Add WebSocket client in the frontend:
    - Connect to API Gateway WebSocket URL.
    - Subscribe to tournament/team channels (simple message contract).
    - Update UI on incoming `StandingsUpdated` and `MatchCompleted` events.
- **Cloud Work (Terraform)**
  - Create **EventBridge bus** and rules for key domain events.
  - Provision **API Gateway WebSocket API** with:
    - `$connect`, `$disconnect`, and message routes.
  - Provision **DynamoDB table** for WebSocket connections (partition by tournament or team).
  - Provision **Lambda functions**:
    - Connect/disconnect handlers (store/remove connection IDs in DynamoDB).
    - Broadcast handler subscribed to EventBridge to fan‑out updates via ApiGatewayManagementApi client.
  - Set IAM roles and policies for Lambdas to use DynamoDB, EventBridge, and API Gateway (still assuming Terraform is run under Lab‑role).

### Phase 4 – Brackets, Multi‑Location, and Duties

- **Goals**
  - Implement tournament progression beyond pool play (brackets, locations, duties).
  - Solve the real‑world problems: “Which gym?”, “Which court?”, “Who refs?”.
- **App Work**
  - Implement seeding algorithm (pool rank → wins → point diff; handle 3‑team pools).
  - Implement 8‑team bracket generator (Gold bracket first), with:
    - Bracket structure in DB (`brackets`, `bracket_slots`, bracket matches).
    - Automatic trigger when all relevant pools complete.
  - Extend REST API and frontend to:
    - Display full bracket tree and highlight team path.
    - Show location and court assignments for each bracket.
    - Assign and show ref/line‑judge duties per match.
  - Emit `BracketGenerated` and `DutyReminderRequested` events from backend when brackets/duties are created.
- **Cloud Work**
  - Add EventBridge rule + Lambda to:
    - React to `PoolCompleted` → call backend or internal logic to generate brackets (if not done inline).
  - Extend WebSocket broadcast payloads to include location/court info.
  - (Optional) Add **SNS** topic + Lambda subscriber to send coach notifications on bracket and duty creation.

### Phase 5 – Hardening, Testing, and Demo Readiness

- **Goals**
  - Stabilize, document, and prepare a compelling, cloud‑focused demo.
- **App Work**
  - End‑to‑end test flows:
    - Tournament setup → pool play → bracket generation → bracket play.
  - Test edge cases:
    - 3‑team pools and tie‑breakers.
    - Incomplete data (no‑shows, missing scores).
  - Add minimal error handling and input validation (no need for perfection, just robustness).
  - Add a simple “Demo mode” script or seeded test data.
- **Cloud Work**
  - Add CloudWatch log groups, metrics, and basic alarms (ECS health, RDS connectivity, Lambda errors).
  - Document Terraform usage in the repo (`terraform apply` sequence, inputs, regions).
  - Produce:
    - Architecture diagram.
    - Event flow diagram.
    - Short README explaining how ECS, RDS, EventBridge, WebSockets, and Lambda fit together.
  - Dry‑run the live demo using the Learner Lab environment and Lab‑role credentials.

