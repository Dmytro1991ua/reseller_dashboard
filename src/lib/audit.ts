import { createHash } from "crypto";
import { db } from "./db";

function hashKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export async function logEvent(action: "login" | "logout", apiKey: string, ip?: string) {
  try {
    await db.auditEvent.create({
      data: { action, apiKeyHash: hashKey(apiKey), ip: ip ?? null },
    });
  } catch (err) {
    // Best-effort — don't break the auth flow if DB is unavailable
    // eslint-disable-next-line no-console
    console.error("[audit]", err);
  }
}
