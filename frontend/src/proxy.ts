import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "pepperone_session";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/images/") ||
    pathname === "/favicon.ico"
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoggedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!isLoggedIn && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/api/:path*"],
};
