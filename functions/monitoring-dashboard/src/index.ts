import { login, register, verifyToken } from "./auth";
import { ingest } from "./ingest";
import { db } from "./db";
import { getLogs, getAlerts, getMetrics } from "./data";
import { getUsers, handleUserAction, requestWithdrawal } from "./user-management";
import { APIGatewayProxyEventV2, APIGatewayProxyEvent } from "aws-lambda";

type MaxIdRow = {
  maxId: number;
};

export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEventV2, responseStream: any, context: any) => {
    const path = event.rawPath || "";
    const method = event.requestContext?.http?.method;

    // 경로 정규화
    const normalizedPath = path.replace(/\/$/, "") || "/";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    /** 헬퍼: 상충하는 CORS 헤더 제거 (인프라 레벨 CORS와 충돌 방지) */
    const getSafeHeaders = (resHeaders?: any) => {
      const merged = { ...headers, ...resHeaders };
      const filtered: Record<string, string> = {};
      for (const key in merged) {
        if (!key.toLowerCase().startsWith("access-control-")) {
          filtered[key] = merged[key];
        }
      }
      return filtered;
    };

    /** 연결 불필요 라우트: Login / Register */
    if (normalizedPath === "/login" && method === "POST") {
      const res = await login(event as unknown as APIGatewayProxyEvent);
      const response = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: res.statusCode,
        headers: getSafeHeaders(res.headers),
      });
      response.write(res.body);
      response.end();
      return;
    }

    if (normalizedPath === "/register" && method === "POST") {
      const res = await register(event as unknown as APIGatewayProxyEvent);
      const response = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: res.statusCode,
        headers: getSafeHeaders(res.headers),
      });
      response.write(res.body);
      response.end();
      return;
    }

    /** 인가 확인 라우트 */
    if (normalizedPath === "/ingest" && method === "POST") {
      const ingestSecret = process.env.INTERNAL_INGEST_SECRET;
      const providedSecret = event.headers["x-internal-secret"];
      if (ingestSecret && providedSecret !== ingestSecret) {
        const response = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: 403,
          headers: getSafeHeaders(),
        });
        response.write(JSON.stringify({ message: "Forbidden" }));
        response.end();
        return;
      }
      const res = await ingest(event as unknown as APIGatewayProxyEvent);
      const response = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: res.statusCode,
        headers: getSafeHeaders(res.headers),
      });
      response.write(res.body);
      response.end();
      return;
    }

    /** 인증 필수 대시보드 API 및 SSE - 정교한 경로 매칭 */
    const authRoutes = ["/logs", "/alerts", "/metrics", "/stream", "/users"];
    const isAuthRequired = authRoutes.some(r => normalizedPath === r || normalizedPath.startsWith(r + "/"));

    if (isAuthRequired) {
      const user = verifyToken(event as APIGatewayProxyEventV2);
      if (!user) {
        const response = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: 401,
          headers: getSafeHeaders(),
        });
        response.write(JSON.stringify({ message: "Unauthorized" }));
        response.end();
        return;
      }

      const decodedUser = user as { userId: number; username: string; role: string };

      /** 사용자 관리 API (Admin Only) */
      if (normalizedPath === "/users" && method === "GET") {
        if (decodedUser.role !== "admin") {
          const response = awslambda.HttpResponseStream.from(responseStream, { statusCode: 403, headers: getSafeHeaders() });
          response.write(JSON.stringify({ message: "Forbidden" }));
          response.end();
          return;
        }
        const res: any = await getUsers();
        const response = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: res.statusCode,
          headers: getSafeHeaders(res.headers),
        });
        response.write(res.body);
        response.end();
        return;
      }

      if (normalizedPath.startsWith("/users/") && (method === "PATCH" || method === "DELETE")) {
        if (decodedUser.role !== "admin") {
          const response = awslambda.HttpResponseStream.from(responseStream, { statusCode: 403, headers: getSafeHeaders() });
          response.write(JSON.stringify({ message: "Forbidden" }));
          response.end();
          return;
        }
        const res: any = await handleUserAction(event as APIGatewayProxyEventV2);
        const response = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: res.statusCode,
          headers: getSafeHeaders(res.headers),
        });
        response.write(res.body);
        response.end();
        return;
      }

      if (normalizedPath === "/users/withdraw" && method === "POST") {
        const res: any = await requestWithdrawal(decodedUser.userId);
        const response = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: res.statusCode,
          headers: getSafeHeaders(res.headers),
        });
        response.write(res.body);
        response.end();
        return;
      }

      /** 일반 데이터 조회 */
      if (normalizedPath === "/logs") {
        const res: any = await getLogs(event as any);
        const response = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: res.statusCode,
          headers: getSafeHeaders(res.headers),
        });
        response.write(res.body);
        response.end();
        return;
      }

      if (normalizedPath === "/alerts") {
        const res: any = await getAlerts(event as any);
        const response = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: res.statusCode,
          headers: getSafeHeaders(res.headers),
        });
        response.write(res.body);
        response.end();
        return;
      }

      if (normalizedPath === "/metrics") {
        const res: any = await getMetrics(event as any);
        const response = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: res.statusCode,
          headers: getSafeHeaders(res.headers),
        });
        response.write(res.body);
        response.end();
        return;
      }

      if (normalizedPath === "/stream") {
        /** SSE 스트리밍 시작 */
        const response = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: 200,
          headers: getSafeHeaders({
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          }),
        });

        let lastBioId = 0;
        let lastLogId = 0;
        let lastAlertId = 0;
        let lastMetricId = 0;

        try {
          const initialBio = await db.execute({
            sql: "SELECT MAX(id) as maxId FROM biometrics",
            args: [],
          });
          lastBioId = (initialBio.rows[0] as unknown as MaxIdRow)?.maxId || 0;
          const initialLog = await db.execute({
            sql: "SELECT MAX(id) as maxId FROM logs",
            args: [],
          });
          lastLogId = (initialLog.rows[0] as unknown as MaxIdRow)?.maxId || 0;
          const initialAlert = await db.execute({
            sql: "SELECT MAX(id) as maxId FROM alerts",
            args: [],
          });
          lastAlertId = (initialAlert.rows[0] as unknown as MaxIdRow)?.maxId || 0;
          const initialMetric = await db.execute({
            sql: "SELECT MAX(id) as maxId FROM server_metrics",
            args: [],
          });
          lastMetricId = (initialMetric.rows[0] as unknown as MaxIdRow)?.maxId || 0;
        } catch (err) {
          console.error("패치 오류:", err);
        }

        const sendSSE = (data: object) => {
          response.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        const interval = setInterval(async () => {
          try {
            const bios = await db.execute({
              sql: "SELECT * FROM biometrics WHERE id > ? ORDER BY id ASC LIMIT 50",
              args: [lastBioId],
            });
            bios.rows.forEach((row) => {
              sendSSE({ type: "biometric", data: row });
              lastBioId = Math.max(lastBioId, Number(row.id));
            });

            const logs = await db.execute({
              sql: "SELECT * FROM logs WHERE id > ? ORDER BY id ASC LIMIT 50",
              args: [lastLogId],
            });
            logs.rows.forEach((row) => {
              sendSSE({ type: "log", data: row });
              lastLogId = Math.max(lastLogId, Number(row.id));
            });

            const alerts = await db.execute({
              sql: "SELECT * FROM alerts WHERE id > ? ORDER BY id ASC LIMIT 50",
              args: [lastAlertId],
            });
            alerts.rows.forEach((row) => {
              sendSSE({ type: "alert", data: row });
              lastAlertId = Math.max(lastAlertId, Number(row.id));
            });

            const metrics = await db.execute({
              sql: "SELECT * FROM server_metrics WHERE id > ? ORDER BY id ASC LIMIT 50",
              args: [lastMetricId],
            });
            metrics.rows.forEach((row) => {
              sendSSE({ type: "metric", data: row });
              lastMetricId = Math.max(lastMetricId, Number(row.id));
            });

            response.write(": keep-alive\n\n"); // 연결 유지를 위한 핑
          } catch (err) {
            console.error("Polling error:", err);
          }
        }, 2000);

        /** 스트림 종료 시 인터벌 클리어 */
        responseStream.on("close", () => {
          clearInterval(interval);
        });

        /** 람다 최대 실행 시간 직전에 종료 */
        setTimeout(
          () => {
            clearInterval(interval);
            response.end();
          },
          14 * 60 * 1000,
        );
        return;
      }
    }

    const response = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 404,
      headers: getSafeHeaders(),
    });
    response.write(JSON.stringify({ message: "Not Found" }));
    response.end();
  },
);
