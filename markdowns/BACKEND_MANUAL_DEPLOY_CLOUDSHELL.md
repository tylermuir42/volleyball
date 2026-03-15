# Backend Manual Deploy (CloudShell)

Use this when GitHub OIDC is unavailable in Learner Lab.

## Script

- `scripts/deploy-backend-cloudshell.sh`

This script will:

1. Build backend Docker image from `backend/Dockerfile`.
2. Push image to ECR.
3. Register a new ECS task definition revision with the new image.
4. Update ECS service and wait for stability.

## Usage

From repo root in CloudShell:

```bash
chmod +x scripts/deploy-backend-cloudshell.sh
./scripts/deploy-backend-cloudshell.sh
```

## Optional overrides

```bash
AWS_REGION=us-east-1 \
ECR_REPOSITORY=volleyball \
ECS_CLUSTER=volleyball-cluster \
ECS_SERVICE=volleyball-backend \
CONTAINER_NAME=backend \
IMAGE_TAG=manual-test-001 \
./scripts/deploy-backend-cloudshell.sh
```

## Verify

```bash
aws ecs describe-services \
  --region us-east-1 \
  --cluster volleyball-cluster \
  --services volleyball-backend \
  --query 'services[0].[status,desiredCount,runningCount,taskDefinition]'

aws elbv2 describe-target-health \
  --region us-east-1 \
  --target-group-arn <your-target-group-arn>

curl -i http://<your-alb-dns>/health/live
curl -i http://<your-alb-dns>/tournaments
```

## Notes

- Requires `aws`, `docker`, and `jq` in CloudShell.
- If ECR repo doesn’t exist, create it first:

```bash
aws ecr create-repository --region us-east-1 --repository-name volleyball
```
