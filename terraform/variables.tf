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

variable "turso_url" {
  description = "Turso DB URL"
  type        = string
}

variable "turso_auth_token" {
  description = "Turso DB Auth Token"
  type        = string
  sensitive   = true
}

variable "internal_ingest_secret" {
  description = "Shared secret for internal data ingestion"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT Secret for authentication"
  type        = string
  sensitive   = true
}