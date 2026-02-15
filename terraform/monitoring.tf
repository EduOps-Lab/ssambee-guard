# Monitoring Dashboard Lambda

data "archive_file" "dashboard_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/monitoring-dashboard/dist"
  output_path = "${path.module}/monitoring_dashboard.zip"
}

resource "aws_lambda_function" "monitoring_dashboard" {
  filename      = data.archive_file.dashboard_zip.output_path
  function_name = "monitoring-dashboard-service"
  role          = aws_iam_role.monitoring_lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  timeout       = 900 # 15 minutes max for streaming

  environment {
    variables = {
      TURSO_URL              = var.turso_url
      TURSO_AUTH_TOKEN       = var.turso_auth_token
      JWT_SECRET             = var.jwt_secret
      INTERNAL_INGEST_SECRET = var.internal_ingest_secret
    }
  }
}

# Lambda Function URL with Streaming support
resource "aws_lambda_function_url" "monitoring_url" {
  function_name      = aws_lambda_function.monitoring_dashboard.function_name
  authorization_type = "NONE" # We handle auth in the app
  invoke_mode        = "RESPONSE_STREAM"

  cors {
    allow_origins     = ["*"] # Adjust to your Vercel URL in production
    allow_methods     = ["POST", "GET", "OPTIONS"]
    allow_headers     = ["content-type", "authorization"]
    expose_headers    = ["x-amzn-header", "x-amz-cf-id"]
    max_age           = 3600
    allow_credentials = true
  }
}

resource "aws_iam_role" "monitoring_lambda_role" {
  name = "monitoring_dashboard_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "monitoring_logs" {
  role       = aws_iam_role.monitoring_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

output "monitoring_dashboard_url" {
  value = aws_lambda_function_url.monitoring_url.function_url
}
