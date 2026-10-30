import { NextResponse } from "next/server"
import { requireAdminIdentity } from "@/utils/admin-auth.server"

export async function GET(request: Request) {
  const auth = await requireAdminIdentity(request)
  const headers = { "Cache-Control": "private, no-store" }
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers })
  return NextResponse.json({ assuranceLevel: auth.assuranceLevel }, { headers })
}
