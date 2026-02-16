# Log Cleanup Lambda

data "archive_file" "log_cleanup_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/log-cleanup/dist"
  output_path = "${path.module}/log_cleanup.zip"
}

resource "aws_lambda_function" "log_cleanup" {
  filename      = data.archive_file.log_cleanup_zip.output_path
  function_name = "log-cleanup-service"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  timeout       = 300

  environment {
    variables = {
      TURSO_DATABASE_URL = var.turso_url
      TURSO_AUTH_TOKEN    = var.turso_auth_token
    }
  }
}

resource "aws_cloudwatch_event_rule" "log_cleanup_schedule" {
  name                = "log-cleanup-daily-schedule"
  description         = "Trigger log cleanup lambda daily"
  schedule_expression = "cron(0 0 * * ? *)"
}

resource "aws_cloudwatch_event_target" "log_cleanup_target" {
  rule      = aws_cloudwatch_event_rule.log_cleanup_schedule.name
  target_id = "LogCleanupLambda"
  arn       = aws_lambda_function.log_cleanup.arn
}

resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.log_cleanup.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.log_cleanup_schedule.arn
}
