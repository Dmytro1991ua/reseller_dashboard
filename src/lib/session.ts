import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  apiKey?: string;
  loggedInAt?: string;
}

export const sessionOptions: SessionOptions = {
  cookieName: "fp-session",
  password: process.env.SESSION_SECRET!,
  ttl: 60 * 60 * 24 * 7, // 7 days
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
