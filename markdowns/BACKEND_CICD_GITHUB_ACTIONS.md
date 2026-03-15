# Backend CI/CD to ECR + ECS (GitHub Actions)

This repo now includes:

- `.github/workflows/backend-ecs-deploy.yml`

It automatically:

1. Triggers on push to `main` when `backend/**` changes.
2. Builds Docker image from `backend/Dockerfile`.
3. Pushes image to ECR.
4. Registers a new ECS task definition revision (updates `backend` container image).
5. Updates ECS service and waits until stable.

## One-time setup

### 1) Create/configure ECR repo

Ensure an ECR repository named `volleyball` exists in `us-east-1`.

If your repo name differs, update `ECR_REPOSITORY` in the workflow file.

### 2) Create IAM role for GitHub OIDC

Create an IAM role trusted by GitHub Actions OIDC with permissions for:

- `ecr:GetAuthorizationToken`
- `ecr:BatchCheckLayerAvailability`
- `ecr:InitiateLayerUpload`
- `ecr:UploadLayerPart`
- `ecr:CompleteLayerUpload`
- `ecr:PutImage`
- `ecr:BatchGetImage`
- `ecs:DescribeServices`
- `ecs:DescribeTaskDefinition`
- `ecs:RegisterTaskDefinition`
- `ecs:UpdateService`
- `ecs:ListTasks`
- `ecs:DescribeTasks`
- `iam:PassRole` (for roles used by ECS task definitions)

### 3) Add repository secret

In GitHub repo settings, add:

- `AWS_ROLE_TO_ASSUME` = ARN of the OIDC-assumable IAM role.

### 4) Verify workflow env values

In `.github/workflows/backend-ecs-deploy.yml`, confirm:

- `AWS_REGION=us-east-1`
- `ECS_CLUSTER=volleyball-cluster`
- `ECS_SERVICE=volleyball-backend`
- `ECR_REPOSITORY=volleyball`
- `CONTAINER_NAME=backend`

## Manual trigger

You can run this pipeline from GitHub Actions using **workflow_dispatch**.

## Notes

- This pipeline avoids needing Terraform to own CodeBuild/CodePipeline resources.
- It updates only the image in the existing ECS task definition structure.
