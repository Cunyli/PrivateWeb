import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { contentSecurityPolicy } from "@/lib/security-policy"

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const privatePage = path === "/login" || path === "/admin" || path.startsWith("/admin/") || (path.startsWith("/ai-feed") && !path.startsWith("/ai-feed/public"))
  const nonce = privatePage ? btoa(crypto.randomUUID()) : undefined
  const policy = contentSecurityPolicy(nonce)
  const headers = new Headers(request.headers)
  headers.set("Content-Security-Policy", policy)
  if (nonce) headers.set("x-nonce", nonce)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set("Content-Security-Policy", policy)
  if (privatePage) response.headers.set("Cache-Control", "private, no-store")
  return response
}

export const config = { matcher: ["/((?!api|_next|149e9513-01fa-4fb0-aad4-566afd725d1b|.well-known/vercel/security|.*\\.[a-zA-Z0-9]+$).*)"] }
