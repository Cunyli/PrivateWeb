import { NextResponse } from "next/server"
import { requireAdminRequest } from "@/utils/admin-auth.server"
import { readShoppingCatalog, saveShoppingDismissal, saveShoppingMemo } from "@/lib/shopping-watch.server"
import { readJsonObject, RequestBodyError } from "@/utils/request-json.server"
import { ShoppingMemoError } from "@/lib/shopping-memo.mjs"
import { ShoppingDismissalError } from "@/lib/shopping-dismissal.mjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await requireAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: { "Cache-Control": "private, no-store" } })
  return NextResponse.json(await readShoppingCatalog(), { headers: { "Cache-Control": "private, no-store" } })
}

export async function PATCH(request: Request) {
  const auth = await requireAdminRequest(request)
  const headers = { "Cache-Control": "private, no-store" }
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers })
  let body: Record<string, unknown>
  try { body = await readJsonObject(request) } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: "提交内容过大或格式不正确。" }, { status: error.status, headers })
    throw error
  }
  try {
    const catalog = Object.hasOwn(body, "dismissal")
      ? await saveShoppingDismissal(body.dismissal)
      : await saveShoppingMemo(body.memo, body.expectedUpdatedAt)
    return NextResponse.json({ catalog, persisted: true, storage: "r2" }, { headers })
  } catch (error) {
    if (error instanceof ShoppingMemoError || error instanceof ShoppingDismissalError) return NextResponse.json({ error: error.message }, { status: error.status, headers })
    console.error("Shopping write failed", error instanceof Error ? error.name : "unknown")
    return NextResponse.json({ error: Object.hasOwn(body, "dismissal") ? "隐藏状态保存未确认，请读取最新清单后重试。" : "暂时无法保存，请稍后重试；当前草稿仍保留。" }, { status: 503, headers })
  }
}
