import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { db } from "./db";

type UserRow = {
  id: number;
  username: string;
  role: string;
  is_approved: number;
  created_at: string;
};

const commonHeaders = {
  "Content-Type": "application/json",
};

export async function getUsers(): Promise<APIGatewayProxyResultV2> {
  try {
    const result = await db.execute({
      sql: "SELECT id, username, role, is_approved, created_at FROM users ORDER BY created_at DESC",
      args: [],
    });
    const users = result.rows as unknown as UserRow[];
    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify(users),
    };
  } catch (error) {
    console.error("유저 목록 조회 오류:", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}

export async function handleUserAction(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    const pathParts = event.rawPath.split("/");
    const userId = pathParts[pathParts.length - 1];

    if (!userId) {
      return {
        statusCode: 400,
        headers: commonHeaders,
        body: JSON.stringify({ message: "User ID is required" }),
      };
    }

    if (method === "DELETE") {
      await db.execute({
        sql: "DELETE FROM users WHERE id = ?",
        args: [userId],
      });
      return {
        statusCode: 200,
        headers: commonHeaders,
        body: JSON.stringify({ message: "사용자가 삭제되었습니다." }),
      };
    }

    if (method === "PATCH") {
      const body = typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body;
      const { role, is_approved } = body;

      const updates: string[] = [];
      const args: (string | number)[] = [];

      if (role !== undefined) {
        updates.push("role = ?");
        args.push(role);
      }
      if (is_approved !== undefined) {
        updates.push("is_approved = ?");
        args.push(is_approved);
      }

      if (updates.length === 0) {
        return {
          statusCode: 400,
          headers: commonHeaders,
          body: JSON.stringify({ message: "No fields to update" }),
        };
      }

      args.push(userId);
      await db.execute({
        sql: `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
        args,
      });

      return {
        statusCode: 200,
        headers: commonHeaders,
        body: JSON.stringify({ message: "사용자 정보가 수정되었습니다." }),
      };
    }

    return {
      statusCode: 405,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Method Not Allowed" }),
    };
  } catch (error) {
    console.error("유저 작업 오류:", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}

export async function requestWithdrawal(userId: number): Promise<APIGatewayProxyResultV2> {
  try {
    // We'll use is_approved = 2 to signify withdrawal request
    await db.execute({
      sql: "UPDATE users SET is_approved = 2 WHERE id = ?",
      args: [userId],
    });
    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ message: "탈퇴 요청이 전송되었습니다. 관리자 승인을 기다려주세요." }),
    };
  } catch (error) {
    console.error("탈퇴 요청 오류:", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}
