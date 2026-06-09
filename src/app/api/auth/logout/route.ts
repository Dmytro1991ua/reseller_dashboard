import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getSession();
  const userId = session.userId;

  session.destroy();

  if (userId) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    await logEvent("logout", userId, ip);
  }

  return NextResponse.json({ ok: true });
}
