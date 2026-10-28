import { NextResponse } from "next/server"
import { requireAdminRequest } from "@/utils/admin-auth.server"

export async function GET(request: Request) {
  const auth = await requireAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: { "Cache-Control": "private, no-store" } })
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } })
}
