import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import axios from 'axios'

/** Redis Error Webhook Payload 타입 정의 */
interface RedisErrorPayload {
  type: 'REDIS_ERROR'
  service: string
  server: string
  timestamp: string
  message: string
  guide: string
}

/** Sentry Webhook Payload 타입 정의 */
interface SentryWebhookPayload {
  type?: string
  project_name?: string
  message?: string
  url?: string
  level?: string
  event?: {
    environment?: string
    request?: {
      url?: string
      method?: string
    }
    exception?: {
      values?: Array<{
        type: string
        value: string
      }>
    }
  }
}

/** Discord Embed Field 타입 정의 */
interface DiscordEmbedField {
  name: string
  value: string
  inline: boolean
}

/** Discord Embed 타입 정의 */
interface DiscordEmbed {
  title: string
  description?: string
  url?: string
  color: number
  fields: DiscordEmbedField[]
  footer?: { text: string }
  timestamp?: string
}

/** Discord Webhook Payload 타입 정의 */
interface DiscordPayload {
  username: string
  avatar_url: string
  embeds: DiscordEmbed[]
}

/** Redis 에러에 대한 Discord Payload 생성 */
function createRedisErrorPayload(body: RedisErrorPayload): DiscordPayload {
  return {
    username: '인메모리DB 관리자',
    avatar_url: 'https://cdn-icons-png.flaticon.com/512/6897/6897039.png',
    embeds: [
      {
        title: `🚨 [장애] ${body.service}`,
        color: 15158332, // 빨간색
        fields: [
          { name: '서버 환경', value: `\`${body.server}\``, inline: true },
          { name: '발생 시각', value: body.timestamp, inline: true },
          { name: '에러 메시지', value: `\`\`\`${body.message}\`\`\``, inline: false },
          { name: '💡 조치 가이드', value: `**${body.guide}**`, inline: false },
        ],
        footer: { text: '우리 프로젝트 인프라 알림' },
      },
    ],
  }
}

/** Sentry 에러에 대한 Discord Payload 생성 */
function createSentryErrorPayload(body: SentryWebhookPayload): DiscordPayload {
  const projectName = body.project_name || 'Unknown Project'
  const errorMessage = body.message || 'No message provided'
  const errorUrl = body.url || ''
  const env = body.event?.environment || 'production'
  const errorType = body.event?.exception?.values?.[0]?.type || 'Error'

  return {
    username: 'Sentry Guard',
    avatar_url: 'https://sentry.io/_assets/favicon-fb72d3d376.png',
    embeds: [
      {
        title: `🚨 [${projectName}] ${errorType} 발생`,
        description: `**메시지:** ${errorMessage}`,
        url: errorUrl,
        color: 0xff0000, // 빨간색
        fields: [
          { name: 'Environment', value: env, inline: true },
          { name: 'Level', value: body.level || 'error', inline: true },
          { name: 'Request URL', value: body.event?.request?.url || 'N/A', inline: false },
        ],
        footer: { text: 'Sentry Monitoring System' },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // 데이터 파싱
    if (!event.body) {
      return { statusCode: 400, body: 'No body provided' }
    }

    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL
    if (!DISCORD_WEBHOOK_URL) {
      throw new Error('Missing DISCORD_WEBHOOK_URL environment variable')
    }

    const body: RedisErrorPayload | SentryWebhookPayload = JSON.parse(event.body)

    // 웹훅 타입에 따라 Discord Payload 생성
    const discordPayload: DiscordPayload =
      body.type === 'REDIS_ERROR'
        ? createRedisErrorPayload(body as RedisErrorPayload)
        : createSentryErrorPayload(body as SentryWebhookPayload)

    // 디스코드 전송
    await axios.post(DISCORD_WEBHOOK_URL, discordPayload)

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Notification sent successfully' }),
    }
  } catch (error: unknown) {
    console.error('Error sending to Discord:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error', error: errorMessage }),
    }
  }
}
