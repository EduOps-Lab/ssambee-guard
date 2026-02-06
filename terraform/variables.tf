variable "aws_region" {
  description = "AWS 리전 설정"
  type        = string
  default     = "ap-northeast-2" # 서울 리전
}

variable "discord_webhook_url" {
  description = "에러 알림을 보낼 디스코드 웹훅 URL"
  type        = string
  sensitive   = true # 보안을 위해 로그에 노출되지 않도록
}