#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPOSITORY="${ECR_REPOSITORY:-volleyball}"
ECS_CLUSTER="${ECS_CLUSTER:-volleyball-cluster}"
ECS_SERVICE="${ECS_SERVICE:-volleyball-backend}"
CONTAINER_NAME="${CONTAINER_NAME:-backend}"
IMAGE_TAG="${IMAGE_TAG:-manual-$(date +%Y%m%d-%H%M%S)}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

for cmd in aws docker jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd"
    exit 1
  fi
done

echo "Checking AWS identity..."
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_URI="${REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}"

echo "Using image: ${IMAGE_URI}"

echo "Verifying ECR repository exists..."
aws ecr describe-repositories \
  --region "$AWS_REGION" \
  --repository-names "$ECR_REPOSITORY" >/dev/null

echo "Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$REGISTRY"

echo "Building backend image..."
docker build -f "$REPO_ROOT/backend/Dockerfile" -t "$IMAGE_URI" "$REPO_ROOT/backend"

echo "Pushing image to ECR..."
docker push "$IMAGE_URI"

echo "Getting current ECS task definition from service..."
CURRENT_TASK_DEF_ARN="$(aws ecs describe-services \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --query 'services[0].taskDefinition' \
  --output text)"

if [[ "$CURRENT_TASK_DEF_ARN" == "None" || -z "$CURRENT_TASK_DEF_ARN" ]]; then
  echo "Could not resolve current task definition for service ${ECS_SERVICE}."
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

aws ecs describe-task-definition \
  --region "$AWS_REGION" \
  --task-definition "$CURRENT_TASK_DEF_ARN" \
  --query 'taskDefinition' > "$TMP_DIR/taskdef.json"

jq --arg IMAGE "$IMAGE_URI" --arg NAME "$CONTAINER_NAME" '
  def upsert_env(envs; key; value):
    if (envs // [] | any(.name == key))
    then (envs // [] | map(if .name == key then .value = value else . end))
    else ((envs // []) + [{ name: key, value: value }])
    end;

  .containerDefinitions |= map(
    if .name == $NAME then
      .image = $IMAGE
      | .environment = upsert_env(.environment; "DB_SSL"; "true")
      | .environment = upsert_env(.environment; "DB_SSL_REJECT_UNAUTHORIZED"; "false")
    else
      .
    end
  )
  | del(
      .taskDefinitionArn,
      .revision,
      .status,
      .requiresAttributes,
      .compatibilities,
      .registeredAt,
      .registeredBy
    )
' "$TMP_DIR/taskdef.json" > "$TMP_DIR/taskdef-new.json"

NEW_TASK_DEF_ARN="$(aws ecs register-task-definition \
  --region "$AWS_REGION" \
  --cli-input-json "file://$TMP_DIR/taskdef-new.json" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)"

echo "Updating ECS service..."
aws ecs update-service \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --task-definition "$NEW_TASK_DEF_ARN" \
  --force-new-deployment >/dev/null

echo "Waiting for ECS service to become stable..."
aws ecs wait services-stable \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE"

echo "Deployment complete."
echo "Cluster: ${ECS_CLUSTER}"
echo "Service: ${ECS_SERVICE}"
echo "Image:   ${IMAGE_URI}"
