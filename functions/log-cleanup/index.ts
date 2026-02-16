import { createClient } from '@libsql/client/web'

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !authToken) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set')
}

const db = createClient({
  url,
  authToken,
})

export const handler = async () => {
  try {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    console.log(`Cleaning up logs older than ${twoWeeksAgo}`)
    const result = await db.execute({
      sql: 'DELETE FROM logs WHERE timestamp < ?',
      args: [twoWeeksAgo]
    })
    console.log(`Successfully deleted ${result.rowsAffected} log entries.`)
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Log cleanup successful', deleted: result.rowsAffected }),
    }
  } catch (error) {
    console.error('Log cleanup error:', error)
    throw error
  }
}
