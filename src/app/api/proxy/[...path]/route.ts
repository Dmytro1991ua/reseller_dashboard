/**
 * Universal API proxy route.
 * Reads the reseller's API key from the encrypted session cookie — key never
 * reaches the browser and is never stored in plain text anywhere on disk.
 *
 * Side effects:
 *  - Mutating requests (POST/PUT/DELETE/PATCH) are written to the audit log.
 *  - A 401 from upstream means the API key was revoked — session is destroyed
 *    and the client receives a 401 telling it to re-login.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/audit";
import { apiConfig } from "@/lib/apiConfig";

// Reads are noise; writes change state and are worth recording
const MUTATION_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await getSession();
  if (!session.apiKey) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Capture key before any potential session.destroy() call
  const apiKey = session.apiKey;

  const { path } = await params;
  const apiPath = "/" + path.join("/");
  const search = req.nextUrl.search;
  const url = `${apiConfig.baseUrl}${apiPath}${search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const idempotencyKey = req.headers.get("x-idempotency-key");
  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const text = await req.text();
    if (text) body = text;
  }

  const upstream = await fetch(url, { method: req.method, headers, body });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  // FlashProxy returns 401 when the API key is invalid or revoked.
  // Destroy the session so the next navigation redirects to /login.
  if (upstream.status === 401) {
    session.destroy();
    await logEvent("logout", apiKey, ip);
    return NextResponse.json({ error: "Session expired — please log in again." }, { status: 401 });
  }

  // Write every mutation to the audit trail so we know who did what and when
  if (MUTATION_METHODS.has(req.method)) {
    await logEvent("api_call", apiKey, ip, {
      method: req.method,
      path: apiPath,
      statusCode: upstream.status,
    });
  }

  const json = await upstream.json();
  return NextResponse.json(json, { status: upstream.status });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
