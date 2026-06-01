import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/audit";
import { apiConfig } from "@/lib/apiConfig";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const apiKey: string = (body?.apiKey ?? "").trim();

  if (!apiKey.startsWith("fp_live_") && !apiKey.startsWith("fp_test_")) {
    return NextResponse.json(
      { error: "Invalid key format. Must start with fp_live_ or fp_test_." },
      { status: 400 },
    );
  }

  // Validate key with a read-only GET /balance — zero cost, no side effects
  let ok = false;
  try {
    const upstream = await fetch(`${apiConfig.baseUrl}/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    ok = upstream.ok;
  } catch {
    return NextResponse.json({ error: "Could not reach FlashProxy API." }, { status: 503 });
  }

  if (!ok) {
    return NextResponse.json({ error: "API key rejected by FlashProxy." }, { status: 401 });
  }

  const session = await getSession();
  session.apiKey = apiKey;
  session.loggedInAt = new Date().toISOString();
  await session.save();

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  await logEvent("login", apiKey, ip);

  return NextResponse.json({ ok: true });
}
