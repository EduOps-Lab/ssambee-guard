output "sentry_webhook_url" {
  description = "Sentry 대시보드에 입력할 Webhook URL입니다."
  value       = "${aws_apigatewayv2_api.lambda_api.api_endpoint}/webhook"
}