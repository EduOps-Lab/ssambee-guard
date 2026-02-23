import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { db } from "./db";
import { z } from "zod";

const BiometricSchema = z.object({
  device_id: z.string(),
  heart_rate: z.number().optional(),
  systolic_bp: z.number().optional(),
  diastolic_bp: z.number().optional(),
});

const LogSchema = z.object({
  level: z.string(),
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const IngestSchema = z.object({
  biometrics: z.array(BiometricSchema).optional(),
  logs: z.array(LogSchema).optional(),
});

const commonHeaders = {
  "Content-Type": "application/json",
};

export async function ingest(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const parsed = IngestSchema.safeParse(body || {});

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: commonHeaders,
        body: JSON.stringify({
          message: "Invalid input",
          errors: parsed.error.issues,
        }),
      };
    }

    const { biometrics, logs } = parsed.data;

    /** 생체 데이터 저장 */
    if (biometrics && biometrics.length > 0) {
      const placeholders = biometrics.map(() => "(?, ?, ?, ?)").join(", ");
      const values = biometrics.flatMap((bio) => [
        bio.device_id,
        bio.heart_rate ?? null,
        bio.systolic_bp ?? null,
        bio.diastolic_bp ?? null,
      ]);

      await db.execute({
        sql: `INSERT INTO biometrics (device_id, heart_rate, systolic_bp, diastolic_bp) VALUES ${placeholders}`,
        args: values,
      });
    }

    /** 로그 데이터 저장 */
    if (logs && logs.length > 0) {
      const placeholders = logs.map(() => "(?, ?, ?)").join(", ");
      const values = logs.flatMap((log) => [
        log.level,
        log.message,
        log.metadata ? JSON.stringify(log.metadata) : "{}",
      ]);
      await db.execute({
        sql: `INSERT INTO logs (level, message, metadata) VALUES ${placeholders}`,
        args: values
      });
    }

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({
        message: "데이터 수집이 성공적으로 완료되었습니다.",
      }),
    };
  } catch (error) {
    console.error("수집 오류:", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}
