############################
# WebSocket Real-Time Stack
#
# This file creates:
# - DynamoDB table for WebSocket connections
# - API Gateway WebSocket API + stage + routes
# - 4 Lambda functions (connect, disconnect, message, broadcast)
# - EventBridge rule to trigger broadcast Lambda
#
# IMPORTANT: You STILL need to:
# - Build/zip Lambda code and upload to S3 (see lambda_* variables below)
# - Provide an existing Lambda execution role ARN with required permissions
############################

############################
# Variables (SET THESE IN terraform.tfvars)
############################

# Example in terraform.tfvars:
#   aws_region                 = "us-east-1"
#   project_name               = "volleyball"
#   event_bus_name             = "volleyball-events"
#   lambda_execution_role_arn  = "arn:aws:iam::0881...:role/LabRole"
#   lambda_code_bucket         = "my-lambda-artifacts-bucket"
#   lambda_ws_connect_key      = "volleyball/ws-connect.zip"
#   lambda_ws_disconnect_key   = "volleyball/ws-disconnect.zip"
#   lambda_ws_message_key      = "volleyball/ws-message.zip"
#   lambda_ws_broadcast_key    = "volleyball/ws-broadcast.zip"

variable "event_bus_name" {
  type        = string
  description = "Existing EventBridge bus name (e.g. volleyball-events)"
}

variable "lambda_execution_role_arn" {
  type        = string
  description = "Existing IAM role ARN for Lambda execution (LabRole or similar)"
}

variable "ws_connections_table_name" {
  type        = string
  description = "DynamoDB table for WebSocket connections"
  default     = "volleyball-websocket-connections"
}

variable "ws_stage_name" {
  type        = string
  description = "WebSocket API stage name"
  default     = "prod"
}

# S3 bucket + keys where you upload Lambda ZIPs
variable "lambda_code_bucket" {
  type        = string
  description = "S3 bucket containing Lambda zip files (you create & upload)"
}

variable "lambda_ws_connect_key" {
  type        = string
  description = "S3 key for connect Lambda zip (e.g. volleyball/ws-connect.zip)"
}

variable "lambda_ws_disconnect_key" {
  type        = string
  description = "S3 key for disconnect Lambda zip"
}

variable "lambda_ws_message_key" {
  type        = string
  description = "S3 key for message Lambda zip"
}

variable "lambda_ws_broadcast_key" {
  type        = string
  description = "S3 key for broadcast Lambda zip"
}

############################
# DynamoDB: connection registry
############################

resource "aws_dynamodb_table" "ws_connections" {
  name         = var.ws_connections_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  tags = {
    Name = "${var.project_name}-ws-connections"
  }
}

############################
# API Gateway WebSocket API
############################

resource "aws_apigatewayv2_api" "ws" {
  name                       = "${var.project_name}-ws-api"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

resource "aws_apigatewayv2_stage" "ws" {
  api_id      = aws_apigatewayv2_api.ws.id
  name        = var.ws_stage_name
  auto_deploy = true

  default_route_settings {
    data_trace_enabled      = false
    logging_level           = "INFO"
    throttling_burst_limit  = 1000
    throttling_rate_limit   = 500
  }
}

############################
# Lambda functions (connect / disconnect / message / broadcast)
############################

resource "aws_lambda_function" "ws_connect" {
  function_name = "${var.project_name}-ws-connect"
  role          = var.lambda_execution_role_arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"

  s3_bucket = var.lambda_code_bucket
  s3_key    = var.lambda_ws_connect_key

  environment {
    variables = {
      CONNECTIONS_TABLE = aws_dynamodb_table.ws_connections.name
    }
  }
}

resource "aws_lambda_function" "ws_disconnect" {
  function_name = "${var.project_name}-ws-disconnect"
  role          = var.lambda_execution_role_arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"

  s3_bucket = var.lambda_code_bucket
  s3_key    = var.lambda_ws_disconnect_key

  environment {
    variables = {
      CONNECTIONS_TABLE = aws_dynamodb_table.ws_connections.name
    }
  }
}

resource "aws_lambda_function" "ws_message" {
  function_name = "${var.project_name}-ws-message"
  role          = var.lambda_execution_role_arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"

  s3_bucket = var.lambda_code_bucket
  s3_key    = var.lambda_ws_message_key

  environment {
    variables = {
      CONNECTIONS_TABLE = aws_dynamodb_table.ws_connections.name
    }
  }
}

resource "aws_lambda_function" "ws_broadcast" {
  function_name = "${var.project_name}-ws-broadcast"
  role          = var.lambda_execution_role_arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"

  s3_bucket = var.lambda_code_bucket
  s3_key    = var.lambda_ws_broadcast_key

  environment {
    variables = {
      CONNECTIONS_TABLE = aws_dynamodb_table.ws_connections.name
      # Used inside Lambda to construct ApiGatewayManagementApi endpoint
      WS_API_ENDPOINT = "https://${aws_apigatewayv2_api.ws.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.ws.name}"
    }
  }
}

############################
# API Gateway integrations + routes
############################

resource "aws_apigatewayv2_integration" "ws_connect" {
  api_id             = aws_apigatewayv2_api.ws.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.ws_connect.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "ws_disconnect" {
  api_id             = aws_apigatewayv2_api.ws.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.ws_disconnect.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "ws_message" {
  api_id             = aws_apigatewayv2_api.ws.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.ws_message.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "ws_connect" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_connect.id}"
}

resource "aws_apigatewayv2_route" "ws_disconnect" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_disconnect.id}"
}

resource "aws_apigatewayv2_route" "ws_message" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "message"
  target    = "integrations/${aws_apigatewayv2_integration.ws_message.id}"
}

############################
# Lambda permissions for API Gateway
############################

resource "aws_lambda_permission" "ws_connect_apigw" {
  statement_id  = "AllowAPIGWInvokeConnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_connect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.ws.execution_arn}/*/*"
}

resource "aws_lambda_permission" "ws_disconnect_apigw" {
  statement_id  = "AllowAPIGWInvokeDisconnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_disconnect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.ws.execution_arn}/*/*"
}

resource "aws_lambda_permission" "ws_message_apigw" {
  statement_id  = "AllowAPIGWInvokeMessage"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_message.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.ws.execution_arn}/*/*"
}

############################
# EventBridge rule → broadcast Lambda
############################

resource "aws_cloudwatch_event_rule" "ws_broadcast" {
  name          = "${var.project_name}-ws-broadcast"
  event_bus_name = var.event_bus_name

  event_pattern = jsonencode({
    "source"      : ["volleyball.backend"],
    "detail-type" : ["MatchCompleted", "StandingsUpdated", "BracketGenerated"]
  })
}

resource "aws_cloudwatch_event_target" "ws_broadcast" {
  rule          = aws_cloudwatch_event_rule.ws_broadcast.name
  event_bus_name = var.event_bus_name
  target_id     = "ws-broadcast-lambda"
  arn           = aws_lambda_function.ws_broadcast.arn
}

resource "aws_lambda_permission" "ws_broadcast_events" {
  statement_id  = "AllowEventBridgeInvokeBroadcast"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_broadcast.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.ws_broadcast.arn
}

############################
# Outputs
############################

output "ws_api_url" {
  description = "WebSocket API URL (set this as NEXT_PUBLIC_WS_URL)"
  value       = "wss://${aws_apigatewayv2_api.ws.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.ws.name}"
}

output "ws_connections_table" {
  description = "DynamoDB table for WebSocket connections"
  value       = aws_dynamodb_table.ws_connections.name
}

