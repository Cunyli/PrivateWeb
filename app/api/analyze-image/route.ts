import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

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

export async function POST(request: NextRequest) {
  try {
    // Robust JSON parse with friendly error for invalid/missing body
    let payload: any
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON', details: 'Request body must be valid JSON', code: 'BAD_JSON' },
        { status: 400 }
      )
    }
    const { imageUrl, analysisType = 'description', customPrompt } = payload || {}

    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      )
    }

    const hasOpenAIKey = !!process.env.OPENAI_API_KEY || !!process.env.AZURE_OPENAI_API_KEY
    if (!hasOpenAIKey) {
      return NextResponse.json(
        { error: 'OpenAI/Azure OpenAI API key is not configured' },
        { status: 500 }
      )
    }

    // Choose model (vision-enabled) and client
    const isAzure = !!process.env.AZURE_OPENAI_ENDPOINT
    const { client: openai, model } = createOpenAI('vision')

    // Build prompt per analysis type; honor custom prompt if provided
    let prompt = ''
    
    if (customPrompt) {
      // 使用自定义 prompt
      prompt = customPrompt
    } else {
      // Default prompt (English)
      switch (analysisType) {
        case 'title':
          prompt = `Generate a concise, evocative, and lyrical title for this photograph.
Guidelines:
1) Capture the core subject and atmosphere with imagery
2) Prefer refined, poetic language; avoid clichés and generic words
3) Keep it short: ~2–7 words (EN) or 4–10字（ZH）
4) No punctuation, no quotes, no extra commentary
Return ONLY the title text.`
          break
      case 'subtitle':
        prompt = `Generate a poetic, atmospheric subtitle that complements the title.
Guidelines:
1) Add context: setting, time, style, or mood—evoke a scene
2) Refined and lyrical, avoid clichés; natural rhythm
3) Keep length around 12–24 words（英文）或 12–20字（中文）
4) No punctuation-heavy phrasing; no quotes
Return ONLY the subtitle text.`
        break
      case 'complete':
        prompt = `Generate title, subtitle, and description for this photograph.
Return EXACTLY in this format (no extra text):

Title: [8–15 words, concise and elegant]
Subtitle: [10–25 words, complementary info]
Description: [80–120 words, include subject, style, mood, light/color]

Keep tone refined and suitable for a photography portfolio.`
        break
      case 'description':
        prompt = `Analyze the photo and write a concise, elegant description for a photography portfolio (≤ 120 words).
Include: main subject and scene, style and mood, color and light qualities, overall feeling.
Return ONLY the description text (no extra text).`
        break
      case 'tags':
        prompt = `Generate tags for this photograph.
Cover: subject category, style, color, and mood.
Return a single comma-separated line with up to 10 English tags. No extra text.`
        break
      case 'technical':
        prompt = `Provide a concise technical analysis (≤ 150 words):
shooting techniques (depth of field, composition, angle), lighting (type/direction), post-processing style, and suggested camera settings.`
        break
      default:
        prompt = 'Briefly describe the content of this image.'
      }
    }

    // Prefer passing public URL directly to OpenAI vision
    let text: string = ''
    const runResponsesWith = async (useImageData: boolean) => {
      // If useImageData, download and attach base64
      let imageContent: any
      if (useImageData) {
        const r = await fetch(imageUrl)
        if (!r.ok) throw new Error(`fetch image failed: ${r.status}`)
        const buf = Buffer.from(await r.arrayBuffer())
        const mime = r.headers.get('content-type') || 'image/jpeg'
        imageContent = { type: 'input_image', image_data: { data: buf.toString('base64'), mime_type: mime } }
      } else {
        // Azure Responses API often accepts plain string for image_url
        imageContent = { type: 'input_image', image_url: imageUrl as any }
      }
      const resp = await openai.responses.create({
        model,
        instructions: 'You are a professional photography curator and copywriter. Keep outputs concise and usable.',
        input: [ { role: 'user', content: [ { type: 'input_text', text: prompt }, imageContent ] } ] as any,
      } as any)
      // @ts-ignore
      let out = String((resp as any).output_text || '').trim()
      if (!out) {
        try {
          // @ts-ignore
          const content = (resp as any).output?.[0]?.content?.[0]
          out = String(content?.text?.value || '')
        } catch {}
      }
      return out
    }

    if (isAzure) {
      // Prefer Responses API first on Azure
      try {
        text = await runResponsesWith(false)
      } catch (e) {
        // fallback to image_data
        text = await runResponsesWith(true)
      }
    } else {
      // OpenAI public: try chat first, then responses
      try {
        const completion = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'You are a professional photography curator and copywriter. Keep outputs concise and usable.' },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl } },
              ] as any,
            },
          ],
          temperature: 0.7,
        })
        text = (completion.choices?.[0]?.message?.content || '').trim()
      } catch (err: any) {
        const msg = String(err?.message || '')
        if (/unsupported\s*parameter|moved to 'input'|responses api/i.test(msg)) {
          try { text = await runResponsesWith(false) } catch { text = await runResponsesWith(true) }
        } else {
          throw err
        }
      }
    }

    return NextResponse.json({
      success: true,
      analysisType,
      result: text.trim()
    })

  } catch (error) {
    console.error('OpenAI/Azure Vision API error:', error)
    
    // Map common errors to structured codes/messages
    if (error instanceof Error) {
      const errorMessage = error.message
      
      // 429 Too Many Requests - quota exceeded
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate') || errorMessage.toLowerCase().includes('quota')) {
        return NextResponse.json(
          { 
            error: 'API quota exceeded', 
            details: 'OpenAI rate limit or quota reached. Try again later or adjust plan.',
            code: 'QUOTA_EXCEEDED'
          },
          { status: 429 }
        )
      }
      
      // 401 Unauthorized - API Key issue
      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('api key')) {
        return NextResponse.json(
          { 
            error: 'Invalid API key', 
            details: 'OpenAI API key is invalid or expired. Check configuration.',
            code: 'INVALID_API_KEY'
          },
          { status: 401 }
        )
      }
      
      // 400 Bad Request - invalid request
      if (errorMessage.includes('400')) {
        return NextResponse.json(
          { 
            error: 'Bad request', 
            details: 'Unsupported image format or invalid parameters.',
            code: 'BAD_REQUEST'
          },
          { status: 400 }
        )
      }
    }
    
    // Unknown error
    return NextResponse.json({ error: 'Analysis failed', details: error instanceof Error ? error.message : 'Unknown error. Please try again later.', code: 'UNKNOWN_ERROR' }, { status: 500 })
  }
}
