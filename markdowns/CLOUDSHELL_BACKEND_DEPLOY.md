# Backend Container Build + Deploy – CloudShell Only

Everything runs in **AWS CloudShell**. No local Docker or AWS CLI required.

---

## Overview

| Step | What |
|------|------|
| 1 | Clone repo, apply Terraform (CodeBuild + ECR) |
| 2 | Start CodeBuild to build image and push to ECR |
| 3 | Apply Terraform again to update ECS with new image |
| 4 | Verify ALB `/health` and CloudWatch logs |

---

## Prerequisites

- AWS CloudShell in the **same region** as your infra (e.g. `us-east-1`)
- Values for `db_password` and `ecs_task_execution_role_arn` (from your last apply)
- ECR repo: if you already created `volleyball` in the console, set `create_ecr_repository = false` (Step 1.4)

---

# Step 1: Apply CodeBuild + ECR Terraform

## 1.1 Open CloudShell and clone repo

```bash
cd ~
git clone https://github.com/tylermuir42/volleyball.git
cd volleyball/infra/terraform
```

If you already have the repo:

```bash
cd ~/volleyball
git pull origin main
cd infra/terraform
```

## 1.2 Initialize Terraform

```bash
terraform init
```

## 1.3 Apply CodeBuild and ECR (targeted)

This creates the CodeBuild project and ECR repo (if it doesn’t exist). Use targeted apply so you don’t need `container_image` yet.

**If ECR repo `volleyball` does NOT exist yet:**

```bash
terraform apply \
  -target=aws_ecr_repository.backend \
  -target=aws_iam_role.codebuild \
  -target=aws_iam_role_policy.codebuild \
  -target=aws_codebuild_project.backend_build \
  -var="container_image=placeholder" \
  -var="db_password=YOUR_DB_PASSWORD" \
  -var="ecs_task_execution_role_arn=arn:aws:iam::YOUR_ACCOUNT_ID:role/LabRole"
```

**If ECR repo `volleyball` already exists** (created in console):

```bash
terraform apply \
  -target=aws_iam_role.codebuild \
  -target=aws_iam_role_policy.codebuild \
  -target=aws_codebuild_project.backend_build \
  -var="create_ecr_repository=false" \
  -var="container_image=placeholder" \
  -var="db_password=YOUR_DB_PASSWORD" \
  -var="ecs_task_execution_role_arn=arn:aws:iam::YOUR_ACCOUNT_ID:role/LabRole"
```

Replace `YOUR_DB_PASSWORD` and `YOUR_ACCOUNT_ID`. Type `yes` when prompted.

## 1.4 Get the ECR image URI

```bash
terraform output ecr_image_uri
```

Save this value for Step 3.

---

# Step 2: Build and push image via CodeBuild

## 2.1 Start the build

```bash
aws codebuild start-build --project-name volleyball-backend-build
```

Note the `id` from the output (e.g. `volleyball-backend-build:abc12345-...`).

## 2.2 Wait for the build to finish

```bash
# Replace BUILD_ID with the id from step 2.1
aws codebuild batch-get-builds --ids BUILD_ID --query 'builds[0].buildStatus' --output text
```

Repeat until it returns `SUCCEEDED` (or `FAILED`). Or use:

```bash
# Poll until done (runs every 30 seconds)
BUILD_ID=$(aws codebuild start-build --project-name volleyball-backend-build --query id --output text)
while true; do
  STATUS=$(aws codebuild batch-get-builds --ids $BUILD_ID --query 'builds[0].buildStatus' --output text)
  echo "Status: $STATUS"
  [ "$STATUS" = "SUCCEEDED" ] && break
  [ "$STATUS" = "FAILED" ] && echo "Build failed!" && exit 1
  sleep 30
done
echo "Build succeeded!"
```

## 2.3 If the build fails

- AWS Console → **CodeBuild** → **Build projects** → `volleyball-backend-build` → **Build history** → open the failed build → **Phase details** for logs.
- Or: CloudWatch → Log groups → `/codebuild/volleyball-backend-build`.

---

# Step 3: Update ECS with the new image

## 3.1 Apply Terraform with the ECR image

```bash
terraform apply \
  -var="container_image=$(terraform output -raw ecr_image_uri)" \
  -var="db_password=YOUR_DB_PASSWORD" \
  -var="ecs_task_execution_role_arn=arn:aws:iam::YOUR_ACCOUNT_ID:role/LabRole"
```

Replace `YOUR_DB_PASSWORD` and `YOUR_ACCOUNT_ID`. Type `yes` when prompted.

**If you get `Role is not valid`**, use targeted apply:

```bash
terraform apply \
  -target=aws_ecs_task_definition.backend \
  -target=aws_ecs_service.backend \
  -var="container_image=$(terraform output -raw ecr_image_uri)" \
  -var="db_password=YOUR_DB_PASSWORD" \
  -var="ecs_task_execution_role_arn=arn:aws:iam::YOUR_ACCOUNT_ID:role/LabRole"
```

---

# Step 4: Verify

## 4.1 Get ALB URL

```bash
terraform output alb_dns_name
```

## 4.2 Test health endpoint

```bash
curl http://$(terraform output -raw alb_dns_name)/health
```

Expected: `{"status":"ok"}` or similar.

## 4.3 Check CloudWatch logs

1. AWS Console → **CloudWatch** → **Log groups**
2. Open `/ecs/volleyball-backend`
3. Open the latest log stream
4. Confirm backend startup messages (e.g. "Server running", "Database connected")

---

## Quick reference

| Command | Purpose |
|---------|---------|
| `terraform output ecr_image_uri` | ECR image URI for `container_image` |
| `terraform output codebuild_project_name` | CodeBuild project name |
| `terraform output alb_dns_name` | ALB URL for health check |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `RepositoryAlreadyExistsException` | Set `-var="create_ecr_repository=false"` and omit `-target=aws_ecr_repository.backend` |
| `Role is not valid` on ECS apply | Use targeted apply (Step 3.1) for ECS only |
| CodeBuild fails with IAM error | Lab may restrict IAM; ask admin for a CodeBuild role |
| CodeBuild fails at `git clone` | Check repo URL and that it’s public |
| `/health` returns 502/503 | Wait 2–3 min for ECS to pull image; check target group health |
| Database errors in logs | Run migrations against RDS; check security groups |

---

## Region

If your infra is in another region (e.g. `us-west-2`):

```bash
terraform apply -var="aws_region=us-west-2" ...
```

Or set it in `terraform.tfvars`.
