import { createHash } from "node:crypto";
import { db } from "./db";

function hashKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

interface ActionMeta {
  method?: string;
  path?: string;
  statusCode?: number;
}

export async function logEvent(
  action: "login" | "logout" | "api_call",
  apiKey: string,
  ip?: string | null,
  // meta is only provided for api_call events — login/logout callers omit it
  meta?: ActionMeta,
) {
  try {
    await db.auditEvent.create({
      data: {
        action,
        apiKeyHash: hashKey(apiKey),
        ip: ip ?? null,
        method: meta?.method ?? null,
        path: meta?.path ?? null,
        statusCode: meta?.statusCode ?? null,
      },
    });
  } catch (err) {
    // Best-effort — don't break the request flow if DB is unavailable
    // eslint-disable-next-line no-console
    console.error("[audit]", err);
  }
}
