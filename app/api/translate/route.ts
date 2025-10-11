import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

function createOpenAI(kind: 'vision' | 'text') {
  const isAzure = !!process.env.AZURE_OPENAI_ENDPOINT
  if (isAzure) {
    const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, '')
    const apiKey = process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || ''
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || (kind === 'vision' ? process.env.OPENAI_VISION_MODEL : process.env.OPENAI_TRANSLATION_MODEL) || 'gpt-4o-mini'
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview'
    const client = new OpenAI({
      apiKey,
      baseURL: `${endpoint}/openai/deployments/${deployment}`,
      defaultHeaders: { 'api-key': apiKey },
      defaultQuery: { 'api-version': apiVersion },
    } as any)
    return { client, model: deployment }
  }
  const apiKey = process.env.OPENAI_API_KEY || ''
  const client = new OpenAI({ apiKey })
  const model = (kind === 'vision' ? process.env.OPENAI_VISION_MODEL : process.env.OPENAI_TRANSLATION_MODEL) || 'gpt-4o-mini'
  return { client, model }
}

export async function POST(req: NextRequest) {
  try {
    const { text, sourceLang = "en", targetLang = "zh", context } = await req.json()
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 })
    }
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY || !!process.env.AZURE_OPENAI_API_KEY
    if (!hasOpenAIKey) {
      return NextResponse.json({ error: "OPENAI/Azure API key not configured" }, { status: 500 })
    }

    const { client: openai, model } = createOpenAI('text')
    const fromLabel = sourceLang === 'auto' ? 'auto-detected language' : sourceLang

    const hasCJK = (value: string) => /[\u4e00-\u9fff]/.test(value)
    const normalize = (value: string) => value.trim().replace(/\s+/g, ' ')
    const sourceTrim = String(text || '').trim()
    const sourceNormalized = normalize(sourceTrim)
    const sourceHasCJK = hasCJK(sourceTrim)

    const baseSystem = `You are a professional translator. Preserve meaning, tone, and style. Return ONLY the translated text, with no quotes or extra commentary.`
    const baseUser = `Translate the following ${context ? `(${context}) ` : ''}text from ${fromLabel} to ${targetLang}:
${text}`

    const forceSystem = targetLang === 'zh'
      ? 'You are a strict translation engine. Respond ONLY with the Simplified Chinese translation, using natural, poetic but concise language. NO English words, no commentary.'
      : 'You are a strict translation engine. Respond ONLY with the English translation, natural and fluid. NO Chinese characters, no commentary.'
    const forceUser = `Source text:
${text}

Return only the translation in ${targetLang === 'zh' ? 'Simplified Chinese' : 'English'}.`

    const evaluateCandidate = (candidate: string): string => {
      const trimmed = String(candidate || '').trim()
      if (!trimmed) return ''
      const normalized = normalize(trimmed)
      const identical = normalized.localeCompare(sourceNormalized, undefined, { sensitivity: 'base' }) === 0
      const candidateHasCJK = hasCJK(trimmed)

      if (targetLang === 'zh') {
        if (!candidateHasCJK) return ''
        if (!sourceHasCJK && identical) return ''
      } else if (targetLang === 'en') {
        if (candidateHasCJK) return ''
        if (sourceHasCJK && identical) return ''
      }
      return trimmed
    }

    const runChatPrompt = async (systemPrompt: string, userPrompt: string): Promise<string> => {
      let out = ''
      try {
        const completion = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
        })
        out = (completion.choices?.[0]?.message?.content || '').trim()
      } catch (err: any) {
        const msg = String(err?.message || '')
        if (/unsupported\s*parameter|moved to 'input'|responses api/i.test(msg)) {
          const combined = `${systemPrompt}\n\n${userPrompt}`
          const resp = await openai.responses.create({
            model,
            input: [
              { role: 'user', content: [ { type: 'input_text', text: combined } ] },
            ] as any,
          } as any)
          // @ts-ignore - SDK exposes output_text helper when available
          out = String((resp as any).output_text || '').trim()
          if (!out) {
            try {
              // @ts-ignore
              const content = (resp as any).output?.[0]?.content?.[0]
              out = String(content?.text?.value || content?.input_text?.text || '')
            } catch {}
          }
        } else {
          throw err
        }
      }
      return out
    }

    let candidate = evaluateCandidate(await runChatPrompt(baseSystem, baseUser))
    if (!candidate) {
      candidate = evaluateCandidate(await runChatPrompt(forceSystem, forceUser))
    }

    if (!candidate) {
      console.warn('translate.runPrompt produced no valid translation', { targetLang, context })
      return NextResponse.json({ success: true, translated: '' })
    }

    return NextResponse.json({ success: true, translated: candidate })
  } catch (err) {
    console.error("/api/translate error", err)
    return NextResponse.json({ error: "Translation failed", debug: String((err as any)?.message || err) }, { status: 500 })
  }
}
