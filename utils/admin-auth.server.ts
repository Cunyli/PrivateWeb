import { supabaseAdmin } from "@/utils/supabaseAdmin"

type AdminUser = NonNullable<Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>["data"]["user"]>
type AdminResult = { ok: true; user: AdminUser; assuranceLevel: "aal1" | "aal2" }
  | { ok: false; status: number; error: string }

// This identity-only check is reserved for the MFA bootstrap/status endpoint.
// All endpoints that read or change private data use requireAdminRequest.
export async function requireAdminIdentity(request: Request): Promise<AdminResult> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (!token) return { ok: false, status: 401, error: "Missing admin authorization token" }
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return { ok: false, status: 401, error: "Invalid or expired admin session" }
  const emails = String(process.env.ADMIN_EMAILS || process.env.SUPABASE_ADMIN_EMAILS || "")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean)
  if (!emails.length) return { ok: false, status: 500, error: "Admin access is not configured" }
  if (!data.user.email_confirmed_at || !emails.includes(String(data.user.email || "").toLowerCase())) {
    return { ok: false, status: 403, error: "Admin access denied" }
  }
  // getClaims verifies the token signature and expiry; never trust a client AAL flag.
  const claims = await supabaseAdmin.auth.getClaims(token)
  if (claims.error || !claims.data || claims.data.claims.sub !== data.user.id) {
    return { ok: false, status: 401, error: "Invalid or expired admin session" }
  }
  return { ok: true, user: data.user, assuranceLevel: claims.data.claims.aal === "aal2" ? "aal2" : "aal1" }
}

export async function requireAdminRequest(request: Request): Promise<AdminResult> {
  const auth = await requireAdminIdentity(request)
  if (!auth.ok) return auth
  if (auth.assuranceLevel !== "aal2") return { ok: false, status: 403, error: "Two-factor authentication required" }
  return auth
}
