import { NextRequest, NextResponse } from "next/server";

const TOKEN_KEY = "rrhh_token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // La página de login siempre es accesible
  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(TOKEN_KEY)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.jpg).*)"],
};
