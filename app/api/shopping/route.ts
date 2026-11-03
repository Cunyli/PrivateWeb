import { NextResponse } from "next/server"
import { requireAdminRequest } from "@/utils/admin-auth.server"
import { readShoppingCatalog } from "@/lib/shopping-watch.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await requireAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: { "Cache-Control": "private, no-store" } })
  return NextResponse.json(await readShoppingCatalog(), { headers: { "Cache-Control": "private, no-store" } })
}
