import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { db } from './db'

export async function getLogs(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {}
    const { level, search, range } = params
    let query = 'SELECT * FROM logs WHERE 1=1'
    const args: any[] = []
    if (level) {
      query += ' AND level = ?'
      args.push(level)
    }
    if (search) {
      query += ' AND (message LIKE ? OR metadata LIKE ?)'
      args.push(`%${search}%`, `%${search}%`)
    }
    if (range) {
      const now = new Date()
      let fromDate: Date
      if (range === '1h') fromDate = new Date(now.getTime() - 60 * 60 * 1000)
      else if (range === '24h') fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      else if (range === '7d') fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      else fromDate = new Date(now.getTime() - 60 * 60 * 1000)
      query += ' AND timestamp >= ?'
      args.push(fromDate.toISOString())
    }
    query += ' ORDER BY timestamp DESC LIMIT 200'
    const result = await db.execute({ sql: query, args })
    return { statusCode: 200, body: JSON.stringify(result.rows) }
  } catch (error) {
    console.error('Get logs error:', error)
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) }
  }
}

export async function getAlerts(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {}
    const { type, range } = params
    let query = 'SELECT * FROM alerts WHERE 1=1'
    const args: any[] = []
    if (type) {
      query += ' AND type = ?'
      args.push(type)
    }
    if (range) {
      const now = new Date()
      let fromDate: Date
      if (range === '1h') fromDate = new Date(now.getTime() - 60 * 60 * 1000)
      else if (range === '24h') fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      else if (range === '7d') fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      else fromDate = new Date(now.getTime() - 60 * 60 * 1000)
      query += ' AND created_at >= ?'
      args.push(fromDate.toISOString())
    }
    query += ' ORDER BY created_at DESC LIMIT 100'
    const result = await db.execute({ sql: query, args })
    return { statusCode: 200, body: JSON.stringify(result.rows) }
  } catch (error) {
    console.error('Get alerts error:', error)
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) }
  }
}

export async function getMetrics(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {}
    const { range } = params
    let query = 'SELECT * FROM server_metrics WHERE 1=1'
    const args: any[] = []
    const now = new Date()
    let fromDate: Date
    if (range === '1h') fromDate = new Date(now.getTime() - 60 * 60 * 1000)
    else if (range === '24h') fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    else if (range === '7d') fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    else fromDate = new Date(now.getTime() - 60 * 60 * 1000)
    query += ' AND created_at >= ? ORDER BY created_at ASC'
    args.push(fromDate.toISOString())
    const result = await db.execute({ sql: query, args })
    return { statusCode: 200, body: JSON.stringify(result.rows) }
  } catch (error) {
    console.error('Get metrics error:', error)
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) }
  }
}
