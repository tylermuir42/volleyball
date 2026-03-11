# Backend Container Build + Deploy to ECS

Deploy the backend Docker image to ECS. **Build/push** happens on a machine with Docker; **Terraform apply** runs in **AWS CloudShell**.

---

## Overview

| Step | Where | What |
|------|--------|------|
| 1. Build image | Local machine (Docker) | Build from `backend/Dockerfile` |
| 2. Push to ECR | Local machine | Tag and push to your ECR repo |
| 3. Update ECS | **CloudShell** | `terraform apply` with new `container_image` |
| 4. Verify | Browser / curl | Hit ALB `/health`, check CloudWatch logs |

---

## Prerequisites

- **Local**: Docker installed, AWS CLI configured, repo cloned
- **CloudShell**: Same AWS account/region as your infra, repo cloned
- **ECR**: Repository created (e.g. `volleyball-backend`)
- **RDS**: Database exists (Terraform already created it)
- **Migrations**: Run against RDS before app can serve full API (see [DATABASE_SETUP.md](./DATABASE_SETUP.md))

---

# Part 1: Build and Push (Local Machine)

## Step 1.1: Get AWS Account ID and Region

```bash
aws sts get-caller-identity --query Account --output text
aws configure get region || echo "us-east-1"
```

Use your actual account ID and region (e.g. `088125374736`, `us-east-1`).

## Step 1.2: Authenticate Docker to ECR

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

Replace `YOUR_ACCOUNT_ID` and `us-east-1` if different.

## Step 1.3: Build the Image

From the **repo root**:

```bash
cd volleyball
docker build -t volleyball-backend:latest -f backend/Dockerfile .
```

## Step 1.4: Tag for ECR

```bash
docker tag volleyball-backend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/volleyball-backend:latest
```

## Step 1.5: Push to ECR

```bash
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/volleyball-backend:latest
```

**Full image URI** (save this for Part 2):

```
YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/volleyball-backend:latest
```

---

# Part 2: Update ECS via Terraform (CloudShell)

## Step 2.1: Open CloudShell and Go to Terraform

```bash
cd ~/volleyball
git pull origin main
cd infra/terraform
```

If you don't have the repo:

```bash
git clone https://github.com/tylermuir42/volleyball.git
cd volleyball/infra/terraform
```

## Step 2.2: Initialize Terraform (if needed)

```bash
terraform init
```

## Step 2.3: Apply with New Container Image

Use the **full ECR URI** from Part 1. You must pass all required variables.

### Option A: Command line

```bash
terraform apply \
  -var="container_image=YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/volleyball-backend:latest" \
  -var="db_password=YOUR_DB_PASSWORD" \
  -var="ecs_task_execution_role_arn=arn:aws:iam::YOUR_ACCOUNT_ID:role/LabRole"
```

### Option B: If you have `terraform.tfvars`

Edit `terraform.tfvars` and set:

```hcl
container_image = "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/volleyball-backend:latest"
```

Then:

```bash
terraform apply
```

### Option C: Environment variables (no secrets in history)

```bash
export TF_VAR_container_image="YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/volleyball-backend:latest"
export TF_VAR_db_password="YOUR_DB_PASSWORD"
export TF_VAR_ecs_task_execution_role_arn="arn:aws:iam::YOUR_ACCOUNT_ID:role/LabRole"
terraform apply
```

Type `yes` when prompted.

## Step 2.4: Targeted Apply (if full apply fails on ECS role)

If you get `Role is not valid` and only need to update the image:

```bash
terraform apply \
  -target=aws_ecs_task_definition.backend \
  -target=aws_ecs_service.backend \
  -var="container_image=YOUR_ECR_URI" \
  -var="db_password=YOUR_DB_PASSWORD" \
  -var="ecs_task_execution_role_arn=arn:aws:iam::YOUR_ACCOUNT_ID:role/LabRole"
```

---

# Part 3: Verify

## Step 3.1: Get ALB URL

```bash
terraform output alb_dns_name
```

## Step 3.2: Hit Health Endpoint

```bash
curl http://YOUR_ALB_DNS_NAME/health
```

Expected: `{"status":"ok"}` or similar.

## Step 3.3: Check CloudWatch Logs

1. AWS Console → **CloudWatch** → **Log groups**
2. Open `/ecs/volleyball-backend`
3. Open the latest log stream
4. Confirm backend startup messages (e.g. "Server running", "Database connected")

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `no basic auth credentials` on push | Re-run `aws ecr get-login-password` and `docker login` |
| `RepositoryNotFoundException` | Create ECR repo: `aws ecr create-repository --repository-name volleyball-backend` |
| `Role is not valid` on apply | Use targeted apply (Step 2.4) or get valid ECS task execution role from lab admin |
| `/health` returns 502/503 | Wait 2–3 min for ECS to pull image and start; check target group health in EC2 console |
| Database connection errors in logs | Ensure RDS security group allows ECS; migrations run against RDS `postgres` database |

---

## Region Note

If your infra is in a different region (e.g. `us-west-2`), use that region in:

- ECR login
- ECR URI
- `terraform apply` (provider uses `var.aws_region`)
