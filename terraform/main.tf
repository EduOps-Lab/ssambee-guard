terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0" # 최신 버전 사용 권장
    }
  }

  # 👈 이 부분이 있어야 GitHub Actions와 로컬이 같은 장부를 공유합니다.
  backend "s3" {
    bucket = "ssambee-tf-state"
    key    = "terraform.tfstate"
    region = "ap-northeast-2"
  }
}

# 람다 코드 압축 (Sentry)
data "archive_file" "sentry_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/sentry-to-discord/dist"
  output_path = "${path.module}/sentry_to_discord.zip"
}

# 람다 코드 압축 (Kakao)
data "archive_file" "kakao_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/kakao-notification/dist"
  output_path = "${path.module}/kakao_notification.zip"
}

# 람다 함수 생성 (Sentry)
resource "aws_lambda_function" "sentry_notifier" {
  filename      = data.archive_file.sentry_lambda_zip.output_path
  function_name = "sentry-to-discord-notifier"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"

  environment {
    variables = {
      DISCORD_WEBHOOK_URL = var.discord_webhook_url
    }
  }
}

# 람다 함수 생성 (Kakao)
resource "aws_lambda_function" "kakao_notifier" {
  filename      = data.archive_file.kakao_lambda_zip.output_path
  function_name = "kakao-notification-notifier"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  timeout       = 30
}

# HTTP API Gateway (가장 저렴한 v2)
resource "aws_apigatewayv2_api" "lambda_api" {
  name          = "ops-webhook-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "sentry_lambda" {
  api_id           = aws_apigatewayv2_api.lambda_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.sentry_notifier.invoke_arn
}

# 어떤 주소(/webhook)로 요청을 받을지 결정
resource "aws_apigatewayv2_route" "sentry_route" {
  api_id    = aws_apigatewayv2_api.lambda_api.id
  route_key = "POST /webhook"
  target    = "integrations/${aws_apigatewayv2_integration.sentry_lambda.id}"
}

# 실제 URL을 활성화하는 스테이지
resource "aws_apigatewayv2_stage" "sentry_stage" {
  api_id      = aws_apigatewayv2_api.lambda_api.id
  name        = "$default"
  auto_deploy = true
}

# 람다 실행을 위한 IAM Role (반드시 필요!)
resource "aws_iam_role" "lambda_exec" {
  name = "ssambee_guard_lambda_exec_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# 람다 로그를 위한 기본 권한 연결
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# SQS 실행 권한 추가
resource "aws_iam_role_policy_attachment" "lambda_sqs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole"
}

# SSM 파라미터 읽기 권한 추가
resource "aws_iam_policy" "lambda_ssm" {
  name        = "ssambee_guard_lambda_ssm_policy"
  description = "Allow lambda to read Solapi keys from SSM"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action   = "ssm:GetParameters"
        Effect   = "Allow"
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/ssambee-guard/solapi/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_ssm_attach" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_ssm.arn
}

# API Gateway가 람다를 깨울 수 있는 권한
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sentry_notifier.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.lambda_api.execution_arn}/*/*"
}

# SQS 큐 생성 (Kakao 알림용)
resource "aws_sqs_queue" "kakao_queue" {
  name                      = "kakao-notification-queue"
  message_retention_seconds = 86400
  visibility_timeout_seconds = 60
}

# SQS를 람다의 트리거로 설정
resource "aws_lambda_event_source_mapping" "kakao_sqs_trigger" {
  event_source_arn = aws_sqs_queue.kakao_queue.arn
  function_name    = aws_lambda_function.kakao_notifier.arn
}

# S3 버킷 생성 (상태 파일 저장소)
resource "aws_s3_bucket" "tf_state" {
  bucket = "ssambee-tf-state"

  # 실수로 버킷이 삭제되는 것을 방지 (운영 환경 권장)
  lifecycle {
    prevent_destroy = true
  }
}

# 모든 퍼블릭 액세스 차단
resource "aws_s3_bucket_public_access_block" "tf_state_block" {
  bucket = aws_s3_bucket.tf_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 버킷 버전 관리 (실수로 상태 파일이 깨졌을 때 복구용)
resource "aws_s3_bucket_versioning" "tf_state_versioning" {
  bucket = aws_s3_bucket.tf_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# 서버 측 기본 암호화 (저장되는 파일 자동 암호화)
resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state_crypto" {
  bucket = aws_s3_bucket.tf_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}