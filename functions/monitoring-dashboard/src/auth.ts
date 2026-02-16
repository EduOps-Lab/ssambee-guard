import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { db } from './db'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret'
const MAX_ATTEMPTS = 3
const COOLDOWN_HOURS = 6

async function checkRateLimit(username: string | null, ip: string, type: 'login' | 'register'): Promise<boolean> {
  const sixHoursAgo = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString()
  let query = 'SELECT COUNT(*) as count FROM login_attempts WHERE ip = ? AND attempt_type = ? AND created_at > ?'
  let args: any[] = [ip, type, sixHoursAgo]
  if (type === 'login' && username) {
    query = 'SELECT COUNT(*) as count FROM login_attempts WHERE (username = ? OR ip = ?) AND attempt_type = ? AND created_at > ?'
    args = [username, ip, type, sixHoursAgo]
  }
  const result = await db.execute({ sql: query, args })
  const count = Number(result.rows[0]?.count || 0)
  return count < MAX_ATTEMPTS
}

async function recordAttempt(username: string | null, ip: string, type: 'login' | 'register') {
  await db.execute({
    sql: 'INSERT INTO login_attempts (username, ip, attempt_type) VALUES (?, ?, ?)',
    args: [username, ip, type]
  })
}

export async function register(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const ip = event.requestContext?.identity?.sourceIp || 'unknown'
    const body = JSON.parse(event.body || '{}')
    const { username, password } = body
    if (!username || !password) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Username and password are required' }) }
    }
    const canRegister = await checkRateLimit(null, ip, 'register')
    if (!canRegister) {
      return { statusCode: 429, body: JSON.stringify({ message: `Too many registration attempts. Please try again after ${COOLDOWN_HOURS} hours.` }) }
    }
    const existingUser = await db.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] })
    if (existingUser.rows.length > 0) {
      await recordAttempt(username, ip, 'register')
      return { statusCode: 409, body: JSON.stringify({ message: 'Username already exists' }) }
    }
    const passwordHash = bcrypt.hashSync(password, 10)
    await db.execute({ sql: 'INSERT INTO users (username, password_hash, is_approved) VALUES (?, ?, 0)', args: [username, passwordHash] })
    return { statusCode: 201, body: JSON.stringify({ message: 'Registration successful. Please wait for administrator approval.' }) }
  } catch (error) {
    console.error('Registration error:', error)
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) }
  }
}

export async function login(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const ip = event.requestContext?.identity?.sourceIp || 'unknown'
    const body = JSON.parse(event.body || '{}')
    const { username, password } = body
    if (!username || !password) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Username and password are required' }) }
    }
    const canLogin = await checkRateLimit(username, ip, 'login')
    if (!canLogin) {
      return { statusCode: 429, body: JSON.stringify({ message: `Too many login attempts. Please try again after ${COOLDOWN_HOURS} hours.` }) }
    }
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] })
    const user = result.rows[0]
    if (!user || !bcrypt.compareSync(password, user.password_hash as string)) {
      await recordAttempt(username, ip, 'login')
      return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials' }) }
    }
    if (Number(user.is_approved) !== 1) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Your account is pending administrator approval.' }) }
    }
    const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' })
    return {
      statusCode: 200,
      headers: {
        'Set-Cookie': `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Login successful', token }),
    }
  } catch (error) {
    console.error('Login error:', error)
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) }
  }
}

export function verifyToken(event: APIGatewayProxyEvent) {
  const authHeader = event.headers['authorization'] || event.headers['Authorization']
  const token = authHeader?.split(' ')[1] || (event.headers['cookie']?.split('token=')[1]?.split(';')[0])
  if (!token) return null
  try { return jwt.verify(token, JWT_SECRET) } catch (err) { return null }
}
