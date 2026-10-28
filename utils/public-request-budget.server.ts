import "server-only"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

// The database counter is shared by all server instances. It records only an
// operation and a time window, with no IP addresses or customer information.
export async function enforcePublicRequestBudget(route: "booking" | "semantic-search") {
  const { data, error } = await supabaseAdmin.rpc("consume_portfolio_request_budget", { route_name: route })
  const result = data?.[0]
  if (error || !result) {
    console.error("[public request budget] unavailable", error?.code || "missing-result")
    return NextResponse.json({ error: "Service temporarily unavailable. Please try again shortly." }, { status: 503, headers: { "Retry-After": "60", "Cache-Control": "no-store" } })
  }
  if (!result.allowed) {
    const retryAfter = Math.max(1, Number(result.retry_after) || 60)
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } })
  }
  return null
}
