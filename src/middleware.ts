import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const protectedMatchers = ["/", "/chat", "/favorites", "/profile", "/setup", "/billing"];

function isProtectedPath(pathname: string): boolean {
  return protectedMatchers.some((path) =>
    pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function middleware(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/chat/:path*", "/favorites", "/profile", "/setup", "/billing"],
};
