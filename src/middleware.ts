import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isBillingCheckoutDisabled } from "./lib/billing-flags";

const protectedMatchers = ["/", "/chat", "/favorites", "/profile", "/setup", "/stats"];
const billingCheckoutMatchers = ["/pricing"];

function isProtectedPath(pathname: string): boolean {
  return protectedMatchers.some((path) =>
    pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isBillingCheckoutPath(pathname: string): boolean {
  return billingCheckoutMatchers.some((path) =>
    pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function middleware(request: NextRequest) {
  if (
    isBillingCheckoutDisabled() &&
    isBillingCheckoutPath(request.nextUrl.pathname)
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

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
  matcher: ["/", "/chat/:path*", "/favorites", "/profile", "/setup", "/stats", "/pricing"],
};
