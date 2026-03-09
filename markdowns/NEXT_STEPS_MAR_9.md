## Current Status & What Still Needs to Happen

Last updated: 2026-03-04

### Done

- **Core infra applied successfully** (ECS + RDS + ALB + VPC/subnets) via `infra/terraform/main.tf`
- **ECR repository created**

### In Progress

- **EventBridge Terraform** (cloud engineer)
- **Frontend hosting via Amplify** (software engineer)

### Still Needed (High Priority)

#### 1) Backend container build + deploy to ECS

- **Build and push backend image to ECR**
  - Build from `backend/Dockerfile`
  - Tag with a version (e.g. `:v0.1.0` or `:latest`)
  - Push to ECR
- **Update ECS service to use the pushed image**
  - Ensure Terraform `container_image` points to the correct tag
  - `terraform apply` to update the ECS task definition/service
- **Verify backend is reachable**
  - Confirm ALB target is healthy (`/health` returns 200)
  - Confirm backend logs show startup (CloudWatch)

#### 2) Database schema + migrations (minimum viable)

- Create tables for the MVP:
  - `tournaments`
  - `locations`, `courts`
  - `teams`
  - `pools`, `pool_teams`
  - `matches`
- Decide migration strategy for 2-week scope:
  - simplest: SQL migrations folder + a small “migrate” script in `backend`
  - or a migration tool (e.g. Prisma/Knex) if the team prefers
- Apply migrations against the **RDS Postgres** instance and verify connectivity from ECS

#### 3) Backend REST API (MVP endpoints)

- Tournament setup:
  - `POST /tournaments`
  - `POST /tournaments/:id/locations`
  - `POST /tournaments/:id/teams`
  - `POST /tournaments/:id/pools/auto-assign` (create pools + pool matches)
- Site director operations:
  - `GET /tournaments/:id/pools` (pools + matches + standings)
  - `POST /matches/:id/score` (submit pool score, mark complete)
- Add standings calculation (wins, point differential, pool rank)

#### 4) Event-driven wiring (backend → EventBridge → clients)

- **Event model** (at minimum):
  - `MatchCompleted`
  - `StandingsUpdated`
  - `PoolCompleted`
  - `BracketGenerated` (later)
- Backend publishes events using AWS SDK v3 (EventBridge `PutEvents`)
- EventBridge rules forward events to:
  - WebSocket broadcast Lambda (once built)
  - (optional) bracket-generation Lambda/service

#### 5) WebSocket real-time (API Gateway + Lambdas + DynamoDB)

- API Gateway WebSocket API:
  - `$connect`, `$disconnect`, and a `message` route
- DynamoDB table for connection IDs + subscription filters:
  - tournament subscriptions (minimum)
  - optionally team subscriptions (nice-to-have)
- Broadcast Lambda triggered by EventBridge:
  - resolves interested connections
  - uses ApiGatewayManagementApi to `postToConnection`
- Frontend WebSocket client:
  - subscribe to tournament
  - apply live updates to pools/standings/brackets view

### Still Needed (Phase 2 / “Next After MVP”)

#### Brackets + multi-location routing

- Seeding algorithm:
  - pool rank → wins → point differential
  - handle 2-set pool play ties and 3-team pool 3-set matches
- Bracket generator (start with 8-team)
- Assign each bracket to a location and show “where to go next”
- Bracket play scoring and advancement (best 2 of 3)

#### Duties + reminders

- Duty assignment generation (ref / line judge)
- Clear “team duty” view on frontend
- (optional) SNS notifications for coaches

### Environment / Operational Checklist

- **Amplify env vars**
  - `NEXT_PUBLIC_API_BASE_URL` set to the backend ALB URL (or API domain)
  - (later) `NEXT_PUBLIC_WS_URL` for WebSocket API Gateway endpoint
- **Backend env vars (ECS task)**
  - `DATABASE_URL` points to RDS (already wired by Terraform)
  - `AWS_REGION`
  - `EVENT_BUS_NAME` matches the EventBridge bus Terraform creates
- **Verification**
  - Backend `/health` is green behind ALB
  - RDS reachable from ECS task
  - EventBridge receives a test event and triggers a target
  - WebSocket broadcast reaches connected browser clients

