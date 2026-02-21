import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

/** 환경설정 */
const JWT_SECRET = process.env.JWT_SECRET || "super-secret";
const MAX_ATTEMPTS = 3;
const COOLDOWN_HOURS = 2;

type AttemptType = "login" | "register";

type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  is_approved: number;
};

const commonHeaders = {
  "Content-Type": "application/json",
  // "Access-Control-Allow-Credentials": "true",
  // "Access-Control-Allow-Origin": "http://localhost:3000", // 운영 시 도메인으로 제한 권장
};

async function checkRateLimit(
  username: string | null,
  ip: string,
  type: AttemptType,
): Promise<boolean> {
  const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
  const startTime = new Date(Date.now() - cooldownMs).toISOString();
  // 회원가입 시도 3번 넘으면 2시간 잠금 (ip + 도메인 차단)
  let query =
    "SELECT COUNT(*) as count FROM login_attempts WHERE ip = ? AND attempt_type = ? AND created_at > ?";
  let args: (string | number)[] = [ip, type, startTime];

  if (type === "login" && username) {
    query =
      "SELECT COUNT(*) as count FROM login_attempts WHERE (username = ? OR ip = ?) AND attempt_type = ? AND created_at > ?";
    args = [username, ip, type, startTime];
  }

  const result = await db.execute({ sql: query, args });
  const count = Number(result.rows[0]?.count || 0);
  return count < MAX_ATTEMPTS;
}

async function recordAttempt(
  username: string | null,
  ip: string,
  type: AttemptType,
) {
  await db.execute({
    sql: "INSERT INTO login_attempts (username, ip, attempt_type) VALUES (?, ?, ?)",
    args: [username || "unknown", ip, type],
  });
}

export async function register(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const ip = event.requestContext?.identity?.sourceIp || "unknown";
    const body = typeof event.body === "string" 
      ? JSON.parse(event.body || "{}") 
      : (event.body && typeof event.body === "object") ? event.body : {};
    const { username, password } = body;

    if (!username || !password) {
      return {
        statusCode: 400,
        headers: commonHeaders,
        body: JSON.stringify({ message: "아이디 혹은 비밀번호가 필요합니다." }),
      };
    }

    const canRegister = await checkRateLimit(null, ip, "register");
    if (!canRegister) {
      return {
        statusCode: 429,
        headers: commonHeaders,
        body: JSON.stringify({
          message: `너무 많은 요청을 보냈습니다. 나중에 다시 시도하십시오.`,
        }),
      };
    }
    const existingUser = await db.execute({
      sql: "SELECT id FROM users WHERE username = ?",
      args: [username],
    });

    if (existingUser.rows.length > 0) {
      await recordAttempt(username, ip, "register");
      return {
        statusCode: 409,
        headers: commonHeaders,
        body: JSON.stringify({ message: "해당 유저는 이미 존재합니다." }),
      };
    }
    const passwordHash = await bcrypt.hash(password, 10);

    // Default role is 'member', is_approved is 0
    await db.execute({
      sql: "INSERT INTO users (username, password_hash, role, is_approved) VALUES (?, ?, 'member', 0)",
      args: [username, passwordHash],
    });

    return {
      statusCode: 201,
      headers: commonHeaders,
      body: JSON.stringify({
        message: "가입 요청이 등록되었습니다. 관리자의 승인을 기다리십시오.",
      }),
    };
  } catch (error) {
    console.error("회원가입 오류:", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}

export async function login(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const ip = event.requestContext?.identity?.sourceIp || "unknown";
    const { username, password } = JSON.parse(event.body || "{}");

    if (!username || !password) {
      return {
        statusCode: 400,
        headers: commonHeaders,
        body: JSON.stringify({ message: "아이디 혹은 비밀번호가 필요합니다." }),
      };
    }

    const canLogin = await checkRateLimit(username, ip, "login");
    if (!canLogin) {
      return {
        statusCode: 429,
        headers: commonHeaders,
        body: JSON.stringify({
          message: `너무 많은 요청을 보냈습니다. 나중에 다시시도하십시오.`,
        }),
      };
    }

    const result = await db.execute({
      sql: "SELECT * FROM users WHERE username = ?",
      args: [username],
    });

    const user = result.rows[0] as unknown as UserRow | undefined;

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      await recordAttempt(username, ip, "login");
      return {
        statusCode: 401,
        headers: commonHeaders,
        body: JSON.stringify({ message: "올바르지 않은 인증" }),
      };
    }
    if (Number(user.is_approved) !== 1) {
      return {
        statusCode: 403,
        headers: commonHeaders,
        body: JSON.stringify({
          message:
            "해당 계정은 관리자의 승인이 필요합니다. 잠시만 기다려주세요",
        }),
      };
    }
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    return {
      statusCode: 200,
      headers: {
        ...commonHeaders,
        "Set-Cookie": `token=${token}; HttpOnly; Secure; SameSite=None; Max-Age=86400; Path=/`,
      },
      body: JSON.stringify({ message: "로그인을 성공하였습니다.", token }),
    };
  } catch (error) {
    console.error("로그인 오류", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}

export function verifyToken(event: APIGatewayProxyEvent) {
  const authHeader =
    event.headers["authorization"] || event.headers["Authorization"];

  const token =
    authHeader?.split(" ")[1] ||
    event.queryStringParameters?.token ||
    event.headers["cookie"]?.split("token=")[1]?.split(";")[0];

  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}
