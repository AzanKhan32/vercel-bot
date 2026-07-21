import { NextResponse, type NextRequest } from "next/server"
import { isValidSession, SESSION_COOKIE } from "@/lib/auth"

export async function proxy(request: NextRequest) {
  const isAuthenticated = await isValidSession(request.cookies.get(SESSION_COOKIE)?.value)

  if (request.nextUrl.pathname === "/login") {
    return isAuthenticated
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next()
  }

  if (!isAuthenticated) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-light-32x32.png|icon-dark-32x32.png|apple-icon.png|api/bot/tick).*)",
  ],
}
