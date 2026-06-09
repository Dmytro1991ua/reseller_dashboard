import { db } from "./db";

interface ActionMeta {
  method?: string;
  path?: string;
  statusCode?: number;
}

export async function logEvent(
  action: "login" | "logout" | "api_call",
  userId: string,
  ip?: string | null,
  meta?: ActionMeta,
) {
  try {
    await db.auditEvent.create({
      data: {
        action,
        userId,
        ip: ip ?? null,
        method: meta?.method ?? null,
        path: meta?.path ?? null,
        statusCode: meta?.statusCode ?? null,
      },
    });
  } catch (err) {
    console.error("[audit]", err);
  }
}
