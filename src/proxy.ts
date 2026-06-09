import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  const authenticated = !!session.userId;

  if (!authenticated && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (authenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico).*)"],
};
