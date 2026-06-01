/**
 * Universal API proxy route.
 * Reads the reseller's API key from the encrypted session cookie — key never
 * reaches the browser and is never stored in plain text anywhere on disk.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { apiConfig } from "@/lib/apiConfig";

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await getSession();
  if (!session.apiKey) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { path } = await params;
  const apiPath = "/" + path.join("/");
  const search = req.nextUrl.search;
  const url = `${apiConfig.baseUrl}${apiPath}${search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.apiKey}`,
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
  const json = await upstream.json();
  return NextResponse.json(json, { status: upstream.status });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
