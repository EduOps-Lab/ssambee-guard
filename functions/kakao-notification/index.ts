import { SQSEvent, SQSBatchResponse } from 'aws-lambda'
import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm'
import axios from 'axios'
import * as crypto from 'crypto'

const ssmClient = new SSMClient({})

/** Kakao Notification Payload 타입 정의 */
interface KakaoNotificationBody {
  to: string
  from: string
  text: string
  kakaoOptions: {
    pfId: string
    templateId: string
    variables?: Record<string, string>
  }
}

/** SSM에서 Solapi API 키 가져오기 */
async function getSolapiKeys() {
  const command = new GetParametersCommand({
    Names: ['/ssambee-guard/solapi/api-key', '/ssambee-guard/solapi/api-secret'],
    WithDecryption: true,
  })
  const response = await ssmClient.send(command)
  const params = response.Parameters || []
  const apiKey = params.find((p) => p.Name === '/ssambee-guard/solapi/api-key')?.Value
  const apiSecret = params.find((p) => p.Name === '/ssambee-guard/solapi/api-secret')?.Value

  if (!apiKey || !apiSecret) {
    throw new Error('Missing Solapi keys in Parameter Store (/ssambee-guard/solapi/api-key or /ssambee-guard/solapi/api-secret)')
  }
  return { apiKey, apiSecret }
}

/** Solapi 인증 헤더 생성 */
export function generateHeader(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString('hex')
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex')
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

/** SQS 이벤트 핸들러 */
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  let keys: { apiKey: string; apiSecret: string } | null = null
  const batchItemFailures = []

  for (const record of event.Records) {
    try {
      if (!keys) {
        keys = await getSolapiKeys()
      }

      const body: KakaoNotificationBody = JSON.parse(record.body)

      const payload = {
        message: {
          to: body.to,
          from: body.from,
          text: body.text,
          kakaoOptions: body.kakaoOptions,
        },
      }

      await axios.post('https://api.solapi.com/messages/v4/send', payload, {
        headers: {
          Authorization: generateHeader(keys.apiKey, keys.apiSecret),
          'Content-Type': 'application/json',
        },
      })

      console.log(`Successfully sent message to ${body.to} for record ${record.messageId}`)
    } catch (error: unknown) {
      console.error('Error processing record:', record.messageId, error)
      if (axios.isAxiosError(error)) {
        console.error('Solapi Error Response:', error.response?.data)
      }
      batchItemFailures.push({ itemIdentifier: record.messageId })
    }
  }

  return { batchItemFailures }
}
