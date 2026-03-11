# EventBridge Terraform – CloudShell Deployment Guide

Deploy the EventBridge bus from **AWS CloudShell** (required when using AWS Learner Lab or restricted environments).

---

## Prerequisites

- AWS CloudShell open in the **same region** as your existing infra (e.g. `us-east-1`)
- Terraform already installed in CloudShell (it is by default)
- Your repo cloned in CloudShell, or you can clone it
- Values for `container_image`, `db_password`, `ecs_task_execution_role_arn` (from your last successful `terraform apply`)

---

## Step 1: Get the Repo and Go to Terraform Directory

If you don’t have the repo yet:

```bash
git clone https://github.com/tylermuir42/volleyball.git
cd volleyball
```

If you already have it:

```bash
cd volleyball
git pull origin main
```

Then:

```bash
cd infra/terraform
```

---

## Step 2: Initialize Terraform (if needed)

```bash
terraform init
```

If you see “Terraform has been successfully initialized”, you’re good. If you’ve run Terraform here before, this may be a no-op.

---

## Step 3: Apply Only the EventBridge Bus (Targeted Apply)

Use a **targeted apply** so Terraform only creates the EventBridge bus and does not change ECS, RDS, or other resources.

### Option A: You have `terraform.tfvars`

If you already have `terraform.tfvars` with your variables:

```bash
terraform apply -target=aws_cloudwatch_event_bus.main
```

Type `yes` when prompted.

### Option B: Pass variables on the command line

Replace the placeholders with your real values:

```bash
terraform apply -target=aws_cloudwatch_event_bus.main \
  -var="container_image=YOUR_ECR_URI" \
  -var="db_password=YOUR_DB_PASSWORD" \
  -var="ecs_task_execution_role_arn=arn:aws:iam::YOUR_ACCOUNT_ID:role/LabRole"
```

Example:

```bash
terraform apply -target=aws_cloudwatch_event_bus.main \
  -var="container_image=088125374736.dkr.ecr.us-east-1.amazonaws.com/volleyball-backend:latest" \
  -var="db_password=YourSecurePassword123!" \
  -var="ecs_task_execution_role_arn=arn:aws:iam::088125374736:role/LabRole"
```

Type `yes` when prompted.

### Option C: Use environment variables (no secrets in history)

```bash
export TF_VAR_container_image="YOUR_ECR_URI"
export TF_VAR_db_password="YOUR_DB_PASSWORD"
export TF_VAR_ecs_task_execution_role_arn="arn:aws:iam::YOUR_ACCOUNT_ID:role/LabRole"
terraform apply -target=aws_cloudwatch_event_bus.main
```

---

## Step 4: Confirm Success

You should see something like:

```
Apply complete! Resources: 1 added, 0 changed, 0 destroyed.
```

Check the outputs:

```bash
terraform output
```

You should see `event_bus_name` and `event_bus_arn` in addition to `alb_dns_name` and `db_endpoint`.

---

## Step 5: Verify the Bus Exists

```bash
aws events list-event-buses --query "EventBuses[?Name=='volleyball-events'].Name" --output text
```

Expected output: `volleyball-events`

---

## Step 6: (Optional) Send a Test Event

```bash
aws events put-events --entries '[
  {
    "Source": "volleyball.backend",
    "DetailType": "MatchCompleted",
    "Detail": "{\"version\":1,\"tournamentId\":\"t1\",\"matchId\":\"m1\",\"occurredAt\":\"2026-03-09T00:00:00Z\"}",
    "EventBusName": "volleyball-events"
  }
]'
```

If it works, the response will show `FailedEntryCount: 0`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `No such file or directory: infra/terraform` | You’re in the wrong folder. Run `pwd`, then `cd` to the repo root and `cd infra/terraform`. |
| `Error: No value for required variable` | Provide all required variables via `-var`, `terraform.tfvars`, or `TF_VAR_*` env vars. |
| `Role is not valid` (ECS) | You used a full `terraform apply` instead of targeted. Use `-target=aws_cloudwatch_event_bus.main` only. |
| `event_bus_name` not in output | The EventBridge Terraform may not be in your repo yet. Run `git pull origin main` and re-apply. |

---

## What This Creates

- **EventBridge bus**: `volleyball-events` (or `<project_name>-events` if you changed `project_name`)
- The backend ECS task already has `EVENT_BUS_NAME` set to this bus name
- Backend can publish events (`MatchCompleted`, `StandingsUpdated`, etc.) once the bus exists
