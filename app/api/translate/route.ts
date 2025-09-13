import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

export async function POST(req: NextRequest) {
  try {
    const { text, sourceLang = "en", targetLang = "zh" } = await req.json()
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 })
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 })
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
    const fromLabel = sourceLang === 'auto' ? 'auto-detected language' : sourceLang
    const prompt = `Translate the following text from ${fromLabel} to ${targetLang}.
- Preserve meaning and tone.
- Return only the translated text with no quotes or extra commentary.
Text:
${text}`

    const result = await model.generateContent([prompt])
    const response = await result.response
    const out = (response.text() || "").trim()
    return NextResponse.json({ success: true, translated: out })
  } catch (err) {
    console.error("/api/translate error", err)
    return NextResponse.json({ error: "Translation failed" }, { status: 500 })
  }
}
