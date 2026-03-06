## Southern LA Volleyball Tournament Manager

Cloud-native, event-driven tournament management system for pools + brackets across multiple locations.

### Repo Structure

- `backend/`: Node.js + TypeScript API (Express) + AWS SDK v3
- `frontend/`: Next.js UI
- `infra/terraform/`: AWS infrastructure (ECS + RDS now; more coming)
- `PROJECT_PLAN.md`: full implementation plan
- `PHASE_PLAN.md`: 5-phase execution plan

### What `infra/terraform/main.tf` Deploys (Today)

- **Networking**
  - VPC `10.0.0.0/16`
  - 2 public subnets (`{region}a`, `{region}b`)
  - Internet Gateway + public route table
- **Database**
  - RDS PostgreSQL (engine 15)
  - Security group allowing Postgres **only** from the ECS service SG
- **Backend compute**
  - ECS cluster (Fargate)
  - ECS task definition + ECS service for the backend container (port 4000)
  - ALB (HTTP :80) → target group → backend `:4000` with health check on `/health`
- **IAM**
  - ECS task execution role (image pull + CloudWatch logs)
- **Observability (basic)**
  - CloudWatch log group + a simple ERROR metric filter/alarm

**Terraform inputs you must provide**
- **`container_image`**: ECR image URI for the backend container
- **`db_password`**: RDS master password (sensitive)

Terraform outputs:
- **`alb_dns_name`**: where the backend is reachable over HTTP
- **`db_endpoint`**: RDS endpoint hostname

### What’s Left for the Team (Task Checklist)

#### Cloud Engineers (Terraform / AWS)

- **ECR**
  - Create ECR repository for the backend image
  - Build/tag/push backend Docker image
- **EventBridge**
  - Create EventBridge bus (name should match `EVENT_BUS_NAME`, currently `${project_name}-events`)
  - Add rules/targets for domain events (e.g., `MatchCompleted`, `StandingsUpdated`, `PoolCompleted`, `BracketGenerated`)
- **WebSocket real-time layer**
  - API Gateway WebSocket API (`$connect`, `$disconnect`, message routes)
  - DynamoDB table for connection storage (by tournament/team subscription)
  - Lambda handlers for connect/disconnect and subscription messages
  - Broadcast Lambda subscribed to EventBridge that posts to clients via ApiGatewayManagementApi
- **Frontend hosting**
  - Choose **S3 + CloudFront** or **Amplify**
  - Deploy Next.js build output and configure environment variables
- **Security / IAM**
  - IAM roles/policies for Lambdas (DynamoDB, EventBridge, ApiGatewayManagementApi)
  - ECS task role permissions (EventBridge publish)
- **Ops**
  - CloudWatch dashboards/alarms for ECS, ALB, Lambda errors, RDS health

#### Software Engineers (Backend / Frontend)

- **Database schema & migrations**
  - Implement migrations for: tournaments, locations, courts, teams, pools, pool_teams, matches, brackets, duties
- **Backend API (REST)**
  - Expand endpoints (see `PROJECT_PLAN.md`):
    - Tournament setup (locations/teams/pools)
    - Score submission (`POST /matches/:id/score`)
    - Standings calculation + tie-break logic
    - Bracket generation + bracket match progression
  - Publish domain events to EventBridge via AWS SDK v3
- **Frontend UI**
  - Admin/site director views: tournament setup, pool score entry, standings
  - Public/coach views: live pools + brackets + “where to go” location info
  - WebSocket client: subscribe to tournament/team updates and apply live UI updates

### Running Locally (Dev)

#### Backend

From `backend/`:
- `npm install`
- `npm run dev`

Environment:
- **`DATABASE_URL`**: Postgres connection string (local DB)
- **`AWS_REGION`** (optional): defaults to `us-west-2`
- **`EVENT_BUS_NAME`** (optional): defaults to `volleyball-events`

#### Frontend

From `frontend/`:
- `npm install`
- `npm run dev`

Environment:
- **`NEXT_PUBLIC_API_BASE_URL`**: e.g. `http://localhost:4000`

### Deploying in AWS Learner Lab (Terraform)

From `infra/terraform/`:
- `terraform init`
- `terraform apply`

You’ll need to set `db_password` and `container_image` (e.g. via `terraform.tfvars` or CLI `-var` flags). This repo assumes the Learner Lab provides credentials and uses the **Lab-role** by default (no explicit `role_arn` configured in Terraform).

