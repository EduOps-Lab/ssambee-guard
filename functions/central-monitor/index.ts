import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import axios from "axios";
import { createClient } from "@libsql/client/web";

interface SystemMetricPayload {
  type: "SYSTEM_METRIC";
  cpuLoad: number;
  memoryUsage: string;
  uptime: number;
  timestamp: string;
  isAlert?: boolean;
}

interface RedisErrorPayload {
  type: "REDIS_ERROR";
  service: string;
  server: string;
  timestamp: string;
  message: string;
  guide: string;
}

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

function createSystemAlertPayload(body: SystemMetricPayload) {
  const usage = parseFloat(body.memoryUsage);
  const color = usage >= 90 ? 0xff0000 : 0xffaa00;

  return {
    username: "응급실 (System Monitor)",
    avatar_url: "https://cdn-icons-png.flaticon.com/512/2702/2702871.png",
    embeds: [
      {
        title: usage >= 90 ? "🚨 [위험] 서버 자원 고갈" : "⚠️ [주의] 서버 자원 압박",
        color: color,
        fields: [
          { name: "메모리 사용량", value: `**${body.memoryUsage}%**`, inline: true },
          { name: "CPU Load", value: `\`${body.cpuLoad.toFixed(2)}\``, inline: true },
          { name: "서버 가동 시간", value: `${(body.uptime / 3600).toFixed(1)}시간`, inline: false },
        ],
        timestamp: body.timestamp,
      },
    ],
  };
}

function createRedisErrorPayload(body: RedisErrorPayload) {
  return {
    username: "인메모리DB 관리자",
    avatar_url: "https://cdn-icons-png.flaticon.com/512/6897/6897039.png",
    embeds: [
      {
        title: `🚨 [장애] ${body.service}`,
        color: 15158332,
        fields: [
          { name: "서버 환경", value: `\`${body.server}\``, inline: true },
          { name: "발생 시각", value: body.timestamp, inline: true },
          { name: "에러 메시지", value: `\`\`\`${body.message}\`\`\``, inline: false },
          { name: "💡 조치 가이드", value: `**${body.guide}**`, inline: false },
        ],
        footer: { text: "우리 프로젝트 인프라 관제팀" },
      },
    ],
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) return { statusCode: 400, body: "No body" };
    const body = JSON.parse(event.body);
    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

    if (!DISCORD_WEBHOOK_URL) {
      console.error("Missing DISCORD_WEBHOOK_URL");
      return { statusCode: 500, body: "Webhook configuration missing" };
    }

    if (body.type === "SYSTEM_METRIC") {
      const payload = body as SystemMetricPayload;
      try {
        await turso.execute({
          sql: "INSERT INTO server_metrics (cpu_load, memory_usage, uptime, created_at) VALUES (?, ?, ?, ?)",
          args: [payload.cpuLoad, parseFloat(payload.memoryUsage), payload.uptime, payload.timestamp],
        });
      } catch (dbError) {
        console.error("Database Insert Error", dbError);
      }

      if (payload.isAlert) {
        const discordPayload = createSystemAlertPayload(payload);
        await axios.post(DISCORD_WEBHOOK_URL, discordPayload);
        try {
          await turso.execute({
            sql: "INSERT INTO alerts (type, message, metadata, created_at) VALUES (?, ?, ?, ?)",
            args: ["MEMORY_HIGH", `Memory usage at ${payload.memoryUsage}%`, JSON.stringify(payload), payload.timestamp],
          });
        } catch (dbError) {
          console.error("Alert Database Insert Error", dbError);
        }
      }
    } else if (body.type === "REDIS_ERROR") {
      const payload = body as RedisErrorPayload;
      if (DISCORD_WEBHOOK_URL) {
        const discordPayload = createRedisErrorPayload(payload);
        await axios.post(DISCORD_WEBHOOK_URL, discordPayload);
        try {
          await turso.execute({
            sql: "INSERT INTO alerts (type, message, metadata, created_at) VALUES (?, ?, ?, ?)",
            args: ["REDIS_ERROR", payload.message, JSON.stringify(payload), payload.timestamp],
          });
        } catch (dbError) {
          console.error("Alert Database Insert Error", dbError);
        }
      }
    }

    return { statusCode: 200, body: JSON.stringify({ message: "Success" }) };
  } catch (error) {
    console.error("Lambda Error", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};
