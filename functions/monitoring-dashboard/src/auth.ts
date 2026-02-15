import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { db } from './db'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret'

export async function login(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}')
    const { username, password } = body

    if (!username || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Username and password are required' }),
      }
    }

    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE username = ?',
      args: [username],
    })

    const user = result.rows[0]

    if (!user || !bcrypt.compareSync(password, user.password_hash as string)) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Invalid credentials' }),
      }
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    return {
      statusCode: 200,
      headers: {
        'Set-Cookie': `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': '*', // Adjust in production
      },
      body: JSON.stringify({ message: 'Login successful', token }),
    }
  } catch (error) {
    console.error('Login error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    }
  }
}

export function verifyToken(event: APIGatewayProxyEvent) {
  const authHeader = event.headers['authorization'] || event.headers['Authorization']
  const token = authHeader?.split(' ')[1] || (event.headers['cookie']?.split('token=')[1]?.split(';')[0])

  if (!token) return null

  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (err) {
    return null
  }
}
