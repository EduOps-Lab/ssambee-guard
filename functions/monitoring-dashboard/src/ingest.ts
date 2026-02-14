import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { db } from './db'
import { z } from 'zod'

const BiometricSchema = z.object({
  device_id: z.string(),
  heart_rate: z.number().optional(),
  systolic_bp: z.number().optional(),
  diastolic_bp: z.number().optional(),
})

const LogSchema = z.object({
  level: z.string(),
  message: z.string(),
  metadata: z.record(z.any()).optional(),
})

const IngestSchema = z.object({
  biometrics: z.array(BiometricSchema).optional(),
  logs: z.array(LogSchema).optional(),
})

export async function ingest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}')
    const parsed = IngestSchema.safeParse(body)

    if (!parsed.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid input', errors: parsed.error.errors }),
      }
    }

    const { biometrics, logs } = parsed.data

    if (biometrics && biometrics.length > 0) {
      for (const bio of biometrics) {
        await db.execute({
          sql: 'INSERT INTO biometrics (device_id, heart_rate, systolic_bp, diastolic_bp) VALUES (?, ?, ?, ?)',
          args: [bio.device_id, bio.heart_rate ?? null, bio.systolic_bp ?? null, bio.diastolic_bp ?? null],
        })
      }
    }

    if (logs && logs.length > 0) {
      for (const log of logs) {
        await db.execute({
          sql: 'INSERT INTO logs (level, message, metadata) VALUES (?, ?, ?)',
          args: [log.level, log.message, JSON.stringify(log.metadata || {})],
        })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Data ingested successfully' }),
    }
  } catch (error) {
    console.error('Ingest error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    }
  }
}
