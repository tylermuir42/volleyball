terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  # In the AWS Learner Lab, Terraform will assume the Lab-role using the
  # provided console credentials. No explicit profile or role_arn is set here
  # so that it "just works" in the lab environment.
}

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-west-2"
}

variable "project_name" {
  description = "Prefix for resource naming"
  type        = string
  default     = "volleyball"
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "volleyapp"
}

variable "db_password" {
  description = "RDS master password (use a secret in real environments)"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "container_image" {
  description = "Backend container image for ECS (ECR URI). After CodeBuild build, use output ecr_image_uri."
  type        = string
}

variable "ecs_task_execution_role_arn" {
  description = "Existing IAM role ARN for ECS task execution (Learner Lab usually provides one, e.g. LabRole). Terraform will not create IAM roles in restricted labs."
  type        = string
}

variable "ecr_repository_name" {
  description = "ECR repository name for backend image"
  type        = string
  default     = "volleyball"
}

variable "create_ecr_repository" {
  description = "Create ECR repo in Terraform. Set false if repo already exists (e.g. created in console)."
  type        = bool
  default     = true
}

variable "github_repo_url" {
  description = "GitHub repo URL for CodeBuild to clone"
  type        = string
  default     = "https://github.com/tylermuir42/volleyball.git"
}

locals {
  name_prefix = "${var.project_name}"
  account_id  = data.aws_caller_identity.current.account_id
  ecr_uri     = "${local.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.ecr_repository_name}:latest"
}

data "aws_caller_identity" "current" {}

# ECR repository for backend image
resource "aws_ecr_repository" "backend" {
  count                = var.create_ecr_repository ? 1 : 0
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

data "aws_ecr_repository" "backend" {
  count        = var.create_ecr_repository ? 0 : 1
  name         = var.ecr_repository_name
}

# CodeBuild project - builds backend Docker image and pushes to ECR (CloudShell-only workflow)
resource "aws_iam_role" "codebuild" {
  name = "${local.name_prefix}-codebuild"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = { Service = "codebuild.amazonaws.com" }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "codebuild" {
  name   = "${local.name_prefix}-codebuild"
  role   = aws_iam_role.codebuild.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = var.create_ecr_repository ? aws_ecr_repository.backend[0].arn : data.aws_ecr_repository.backend[0].arn
      }
    ]
  })
}

resource "aws_codebuild_project" "backend_build" {
  name          = "${local.name_prefix}-backend-build"
  description   = "Build backend Docker image and push to ECR"
  build_timeout = 15
  service_role = aws_iam_role.codebuild.arn

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type                = "BUILD_GENERIC1_SMALL"
    image                       = "aws/codebuild/standard:7.0"
    type                        = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode             = true

    environment_variable {
      name  = "ECR_REPO_NAME"
      value = var.ecr_repository_name
    }
  }

  source {
    type      = "NO_SOURCE"
    buildspec = <<-EOT
      version: 0.2
      phases:
        pre_build:
          commands:
            - echo Logging in to Amazon ECR...
            - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
            - echo Cloning repository...
            - git clone ${var.github_repo_url} .
            - echo Build started on $(date)
        build:
          commands:
            - docker build -t volleyball-backend -f backend/Dockerfile .
            - docker tag volleyball-backend $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/${var.ecr_repository_name}:latest
            - docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/${var.ecr_repository_name}:latest
      artifacts:
        files: []
    EOT
  }

  logs_config {
    cloudwatch_logs {
      group_name  = "/codebuild/${local.name_prefix}-backend-build"
      stream_name = "build"
    }
  }
}

# EventBridge bus for domain events (MatchCompleted, StandingsUpdated, PoolCompleted, BracketGenerated)
# Backend ECS task uses EVENT_BUS_NAME = "${local.name_prefix}-events"
resource "aws_cloudwatch_event_bus" "main" {
  name = "${local.name_prefix}-events"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-igw"
  }
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "${local.name_prefix}-public-a"
  }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true

  tags = {
    Name = "${local.name_prefix}-public-b"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "${local.name_prefix}-public-rt"
  }
}

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

resource "aws_db_subnet_group" "db" {
  name       = "${local.name_prefix}-db-subnets"
  subnet_ids = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  tags = {
    Name = "${local.name_prefix}-db-subnets"
  }
}

resource "aws_security_group" "db" {
  name        = "${local.name_prefix}-db-sg"
  description = "RDS security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Postgres from ECS tasks"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [
      aws_security_group.ecs_service.id
    ]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-db-sg"
  }
}

resource "aws_db_instance" "postgres" {
  identifier              = "${local.name_prefix}-db"
  engine                  = "postgres"
  engine_version          = "15"
  instance_class          = var.db_instance_class
  allocated_storage       = 20
  max_allocated_storage   = 100
  username                = var.db_username
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.db.name
  vpc_security_group_ids  = [aws_security_group.db.id]
  publicly_accessible     = true
  skip_final_snapshot     = true
  deletion_protection     = false
  backup_retention_period = 0

  tags = {
    Name = "${local.name_prefix}-postgres"
  }
}

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_security_group" "ecs_service" {
  name        = "${local.name_prefix}-ecs-sg"
  description = "Allow HTTP in to ECS and all egress"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-ecs-sg"
  }
}

resource "aws_lb" "public" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.ecs_service.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  tags = {
    Name = "${local.name_prefix}-alb"
  }
}

resource "aws_lb_target_group" "backend" {
  name     = "${local.name_prefix}-tg"
  port     = 4000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    unhealthy_threshold = 3
    healthy_threshold   = 2
  }

  tags = {
    Name = "${local.name_prefix}-tg"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.public.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name_prefix}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.ecs_task_execution_role_arn

  container_definitions = jsonencode([
    {
      name  = "backend",
      image = var.container_image,
      portMappings = [
        {
          containerPort = 4000,
          protocol      = "tcp"
        }
      ],
      environment = [
        {
          name  = "PORT",
          value = "4000"
        },
        {
          name  = "DATABASE_URL",
          value = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.address}:5432/postgres"
        },
        {
          name  = "AWS_REGION",
          value = var.aws_region
        },
        {
          name  = "EVENT_BUS_NAME",
          value = "${local.name_prefix}-events"
        }
      ],
      logConfiguration = {
        logDriver = "awslogs",
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name,
          "awslogs-region"        = var.aws_region,
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "backend" {
  name            = "${local.name_prefix}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = [aws_subnet.public_a.id, aws_subnet.public_b.id]
    security_groups = [aws_security_group.ecs_service.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 4000
  }

  depends_on = [
    aws_lb_listener.http
  ]
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name_prefix}-backend"
  retention_in_days = 3
}

resource "aws_cloudwatch_log_stream" "backend" {
  name           = "${local.name_prefix}-backend-stream"
  log_group_name = aws_cloudwatch_log_group.backend.name
}

resource "aws_cloudwatch_log_metric_filter" "backend_errors" {
  name           = "${local.name_prefix}-backend-errors"
  log_group_name = aws_cloudwatch_log_group.backend.name
  pattern        = "\"ERROR\""

  metric_transformation {
    name      = "${local.name_prefix}-backend-error-count"
    namespace = "volleyball"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "backend_error_alarm" {
  alarm_name          = "${local.name_prefix}-backend-error-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = aws_cloudwatch_log_metric_filter.backend_errors.metric_transformation[0].name
  namespace           = aws_cloudwatch_log_metric_filter.backend_errors.metric_transformation[0].namespace
  period              = 300
  statistic           = "Sum"
  threshold           = 5
}

output "alb_dns_name" {
  description = "Public DNS name of the load balancer"
  value       = aws_lb.public.dns_name
}

output "db_endpoint" {
  description = "RDS Postgres endpoint"
  value       = aws_db_instance.postgres.address
}

output "event_bus_name" {
  description = "EventBridge bus name for domain events"
  value       = aws_cloudwatch_event_bus.main.name
}

output "event_bus_arn" {
  description = "EventBridge bus ARN for domain events"
  value       = aws_cloudwatch_event_bus.main.arn
}

output "ecr_image_uri" {
  description = "Full ECR image URI for backend (use as container_image after CodeBuild push)"
  value       = local.ecr_uri
}

output "codebuild_project_name" {
  description = "CodeBuild project name for starting backend build"
  value       = aws_codebuild_project.backend_build.name
}

