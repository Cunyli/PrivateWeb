import "server-only"
import { createHmac } from "node:crypto"
import { isIP } from "node:net"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

export function requestClientKey(request: Request) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) return null
  // Vercel supplies this header; never trust arbitrary forwarded headers on a local server.
  const ip = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() : "development"
  if (!ip || (ip !== "development" && !isIP(ip))) return null
  return createHmac("sha256", secret).update(`portfolio-rate-limit:v1:${ip}`).digest("hex")
}

export async function enforcePublicRequestBudget(route: "booking" | "semantic-search", request: Request) {
  const key = requestClientKey(request)
  if (!key) return NextResponse.json({ error: "Service temporarily unavailable. Please try again shortly." }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } })
  const { data, error } = await supabaseAdmin.rpc("consume_portfolio_request_budget", { route_name: route, client_key: key })
  const result = data?.[0]
  if (error || !result) {
    console.error("[public request budget] unavailable", error?.code || "missing-result")
    return NextResponse.json({ error: "Service temporarily unavailable. Please try again shortly." }, { status: 503, headers: { "Retry-After": "60", "Cache-Control": "no-store" } })
  }
  if (!result.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(Math.max(1, Number(result.retry_after) || 60)), "Cache-Control": "no-store" } })
  return null
}
