import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import axios from 'axios'

/** Sentry Webhook Payload 타입 정의 */
interface SentryWebhookBody {
  project_name: string;
  message: string;
  url: string;
  level?: string;
  event?: {
    environment?: string;
    request?: {
      url?: string;
      method?: string;
    };
    exception?: {
      values?: Array<{
        type: string;
        value: string;
      }>;
    };
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // 데이터 파싱
    if (!event.body) {
      return { statusCode: 400, body: 'No body provided' };
    }
    const body: SentryWebhookBody = JSON.parse(event.body);
    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

    if (!DISCORD_WEBHOOK_URL) {
      throw new Error('Missing DISCORD_WEBHOOK_URL environment variable');
    }

    // 에러 세부 정보 추출
    const projectName = body.project_name || 'Unknown Project';
    const errorMessage = body.message || 'No message provided';
    const errorUrl = body.url || '';
    const env = body.event?.environment || 'production';
    const errorType = body.event?.exception?.values?.[0]?.type || 'Error';

    // 디스코드 Embed 메시지 구성
    const discordPayload = {
      username: 'Sentry Guard',
      avatar_url: 'https://sentry.io/_assets/favicon-fb72d3d376.png', // 센트리 아이콘
      embeds: [
        {
          title: `🚨 [${projectName}] ${errorType} 발생`,
          description: `**메시지:** ${errorMessage}`,
          url: errorUrl,
          color: 0xff0000, // 빨간색
          fields: [
            { name: 'Environment', value: env, inline: true },
            { name: 'Level', value: body.level || 'error', inline: true },
            { 
              name: 'Request URL', 
              value: body.event?.request?.url || 'N/A', 
              inline: false 
            }
          ],
          footer: {
            text: 'Sentry Monitoring System',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    // 디스코드 전송
    await axios.post(DISCORD_WEBHOOK_URL, discordPayload);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Notification sent successfully' }),
    };
  } catch (error: any) {
    console.error('Error sending to Discord:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
    };
  }
};