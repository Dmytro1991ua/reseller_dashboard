import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/audit";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  let email: string, password: string;
  try {
    const body = await req.json();
    email = (body?.email ?? "").trim().toLowerCase();
    password = body?.password ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !valid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.loggedInAt = new Date().toISOString();
  await session.save();

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  await logEvent("login", user.id, ip);

  return NextResponse.json({ ok: true });
}
