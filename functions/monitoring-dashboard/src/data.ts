import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { db } from "./db";

type TimeRange = "1h" | "24h" | "7d";

type LogRow = {
  id: number;
  level: string;
  message: string;
  metadata: string;
  timestamp: string;
};

type AlertRow = {
  id: number;
  type: string;
  message: string;
  metadata: string;
  created_at: string;
};

type MetricRow = {
  id: number;
  cpu_load: number;
  memory_usage: number;
  uptime: number;
  created_at: string;
};

const commonHeaders = {
  "Content-Type": "application/json",
  // "Access-Control-Allow-Origin": "http://localhost:3000", // 운영시는 특정 도메인으로
  // "Access-Control-Allow-Credentials": "true",
};

function getFromDateISO(range: string | undefined): string {
  const now = new Date();
  let ms = 60 * 60 * 1000; // 1h

  if (range === "24h") ms = 24 * 60 * 60 * 1000;
  else if (range === "7d") ms = 7 * 24 * 60 * 60 * 1000;

  return new Date(now.getTime() - ms).toISOString();
}

/** Handler */
export async function getLogs(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const { level, search, range, page, limit, from, to } = event.queryStringParameters || {};

    let query = "SELECT * FROM logs WHERE 1=1";
    let countQuery = "SELECT COUNT(*) as count FROM logs WHERE 1=1";
    const args: (string | number)[] = [];

    if (level) {
      query += " AND level = ?";
      countQuery += " AND level = ?";
      args.push(level);
    }
    if (search) {
      query += " AND (message LIKE ? OR metadata LIKE ?)";
      countQuery += " AND (message LIKE ? OR metadata LIKE ?)";
      args.push(`%${search}%`, `%${search}%`);
    }

    if (from) {
      query += " AND timestamp >= ?";
      countQuery += " AND timestamp >= ?";
      args.push(from);
    } else if (range) {
      query += " AND timestamp >= ?";
      countQuery += " AND timestamp >= ?";
      args.push(getFromDateISO(range));
    }

    if (to) {
      query += " AND timestamp <= ?";
      countQuery += " AND timestamp <= ?";
      args.push(to);
    }

    const totalResult = await db.execute({ sql: countQuery, args });
    const total = Number((totalResult.rows[0] as unknown as { count: number })?.count || 0);

    query += " ORDER BY timestamp DESC";

    const p = Math.max(1, parseInt(page || "1") || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || "50") || 50));
    const offset = (p - 1) * l;

    query += " LIMIT ? OFFSET ?";
    const queryArgs = [...args, l, offset];

    const result = await db.execute({ sql: query, args: queryArgs });
    const rows = result.rows as unknown as LogRow[];

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({
        data: rows,
        pagination: {
          page: p,
          limit: l,
          total,
          totalPages: Math.ceil(total / l),
        },
      }),
    };
  } catch (error) {
    console.error("로그를 가져오는데 문제가있습니다:", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}

export async function getAlerts(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const { type, range } = event.queryStringParameters || {};
    let query = "SELECT * FROM alerts WHERE 1=1";
    const args: (string | number)[] = [];
    if (type) {
      query += " AND type = ?";
      args.push(type);
    }

    query += " AND created_at >= ?";
    args.push(getFromDateISO(range));

    query += " ORDER BY created_at DESC LIMIT 100";

    const result = await db.execute({ sql: query, args });
    const rows = result.rows as unknown as AlertRow[];

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify(rows),
    };
  } catch (error) {
    console.error("알람을 가져오는데 문제가있습니다:", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}

export async function getMetrics(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const { range } = event.queryStringParameters || {};
    let query =
      "SELECT * FROM server_metrics WHERE created_at >= ? ORDER BY created_at ASC";
    const args: (string | number)[] = [getFromDateISO(range)];

    const result = await db.execute({ sql: query, args });
    const rows = result.rows as unknown as MetricRow[];

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify(rows),
    };
  } catch (error) {
    console.error("메트릭을 가져오는데 문제가있습니다:", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}
