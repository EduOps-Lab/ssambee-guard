# 람다 코드 압축
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/sentry-to-discord/dist"
  output_path = "${path.module}/sentry_to_discord.zip"
}

# 람다 함수 생성
resource "aws_lambda_function" "sentry_notifier" {
  filename      = data.archive_file.lambda_zip.output_path
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

# HTTP API Gateway (가장 저렴한 v2)
resource "aws_apigatewayv2_api" "lambda_api" {
  name          = "ops-webhook-api"
  protocol_type = "HTTP"
}

# (이후 람다 호출 권한 및 스테이지 설정 추가...)data "archive_file" "lambda_zip"  {