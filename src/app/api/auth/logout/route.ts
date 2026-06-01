import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getSession();
  const apiKey = session.apiKey;

  session.destroy();

  if (apiKey) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    await logEvent("logout", apiKey, ip);
  }

  return NextResponse.json({ ok: true });
}
