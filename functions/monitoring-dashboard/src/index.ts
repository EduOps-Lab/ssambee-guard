import { login, verifyToken } from './auth'
import { ingest } from './ingest'
import { db } from './db'

declare global {
  namespace awslambda {
    export function streamifyResponse(
      handler: (
        event: any,
        responseStream: any,
        context: any
      ) => Promise<void>
    ): any
    export const HttpResponseStream: any
  }
}

export const handler = awslambda.streamifyResponse(
  async (event: any, responseStream: any, context: any) => {
    const path = event.rawPath || event.path
    const method = event.requestContext?.http?.method || event.httpMethod

    const headers: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
    }

    if (method === 'OPTIONS') {
      const response = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 204,
        headers,
      })
      response.end()
      return
    }

    if (path === '/login' && method === 'POST') {
      const res = await login(event)
      const response = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: res.statusCode,
        headers: { ...headers, ...res.headers },
      })
      response.write(res.body)
      response.end()
      return
    }

    if (path === '/ingest' && method === 'POST') {
      const ingestSecret = process.env.INTERNAL_INGEST_SECRET
      const providedSecret = event.headers['x-internal-secret']

      if (ingestSecret && providedSecret !== ingestSecret) {
        const response = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: 403,
          headers,
        })
        response.write(JSON.stringify({ message: 'Forbidden' }))
        response.end()
        return
      }

      const res = await ingest(event)
      const response = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: res.statusCode,
        headers: { ...headers, ...res.headers },
      })
      response.write(res.body)
      response.end()
      return
    }

    if (path === '/stream') {
      const user = verifyToken(event)
      if (!user) {
        const response = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: 401,
          headers,
        })
        response.write(JSON.stringify({ message: 'Unauthorized' }))
        response.end()
        return
      }

      const response = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })

      let lastBioId = 0
      let lastLogId = 0

      try {
        const initialBio = await db.execute('SELECT MAX(id) as maxId FROM biometrics')
        lastBioId = (initialBio.rows[0]?.maxId as number) || 0

        const initialLog = await db.execute('SELECT MAX(id) as maxId FROM logs')
        lastLogId = (initialLog.rows[0]?.maxId as number) || 0
      } catch (err) {
        console.error('Initial fetch error:', err)
      }

      const sendSSE = (data: any) => {
        response.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      const interval = setInterval(async () => {
        try {
          const bios = await db.execute({
            sql: 'SELECT * FROM biometrics WHERE id > ? ORDER BY id ASC LIMIT 50',
            args: [lastBioId],
          })
          bios.rows.forEach(row => {
            sendSSE({ type: 'biometric', data: row })
            lastBioId = Math.max(lastBioId, row.id as number)
          })

          const logs = await db.execute({
            sql: 'SELECT * FROM logs WHERE id > ? ORDER BY id ASC LIMIT 50',
            args: [lastLogId],
          })
          logs.rows.forEach(row => {
            sendSSE({ type: 'log', data: row })
            lastLogId = Math.max(lastLogId, row.id as number)
          })
        } catch (err) {
          console.error('Polling error:', err)
        }
      }, 2000)

      setTimeout(() => {
        clearInterval(interval)
        response.end()
      }, 14 * 60 * 1000)

      return
    }

    const response = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 404,
      headers,
    })
    response.write(JSON.stringify({ message: 'Not Found' }))
    response.end()
  }
)
