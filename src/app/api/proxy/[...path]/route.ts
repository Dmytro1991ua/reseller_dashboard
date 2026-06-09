import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/audit";
import { routeRequest } from "@/lib/router";

const MUTATION_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { path } = await params;
  const segments = path;
  const search = new URLSearchParams(req.nextUrl.search);
  const method = req.method.toUpperCase();

  let body: unknown;
  if (method !== "GET" && method !== "HEAD") {
    const text = await req.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = undefined;
      }
    }
  }

  const result = await routeRequest({ method, segments, search, body });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (MUTATION_METHODS.has(method)) {
    await logEvent("api_call", session.userId, ip, {
      method,
      path: "/" + segments.join("/"),
      statusCode: result.status,
    });
  }

  return NextResponse.json(result.body, { status: result.status });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
