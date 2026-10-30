import "server-only"
import { checkBotId } from "botid/server"
import { NextResponse } from "next/server"

export async function enforceBotProtection() {
  if (process.env.VERCEL !== "1") return null
  try {
    const result = await checkBotId({ advancedOptions: { checkLevel: "basic" } })
    if (!result.isHuman || result.isBot) return NextResponse.json({ error: "Please open the website in your browser and try again." }, { status: 403, headers: { "Cache-Control": "no-store" } })
    return null
  } catch {
    return NextResponse.json({ error: "Verification temporarily unavailable. Please try again shortly." }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } })
  }
}
