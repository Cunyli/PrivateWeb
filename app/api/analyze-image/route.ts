import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, analysisType = 'description', customPrompt } = await request.json()

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured' },
        { status: 500 }
      )
    }

    // Choose model (you may switch to 'gemini-1.5-pro' for higher quality)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // Build prompt per analysis type; honor custom prompt if provided
    let prompt = ''
    
    if (customPrompt) {
      // 使用自定义 prompt
      prompt = customPrompt
    } else {
      // Default prompt (English)
      switch (analysisType) {
        case 'title':
          prompt = `Generate a concise and elegant title for this photograph.
Guidelines:
1) Capture the main subject and mood
2) Use refined, poetic language
3) Keep length around 8–15 characters/words
4) Suitable for a photography portfolio
Return ONLY the title text (no quotes, no extra text).`
          break
      case 'subtitle':
        prompt = `Generate a subtitle for this photograph.
Guidelines:
1) Complement the title
2) May include location, time, or style
3) Keep length around 10–25 words
4) Maintain consistent tone
Return ONLY the subtitle text (no quotes, no extra text).`
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

    // 获取图片数据
    const imageResponse = await fetch(imageUrl)
    const imageBuffer = await imageResponse.arrayBuffer()
    const imageBase64 = Buffer.from(imageBuffer).toString('base64')

    // 构建请求
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: imageResponse.headers.get('content-type') || 'image/jpeg'
        }
      }
    ])

    const response = await result.response
    const text = response.text()

    return NextResponse.json({
      success: true,
      analysisType,
      result: text.trim()
    })

  } catch (error) {
    console.error('Gemini API error:', error)
    
    // Map common errors to structured codes/messages
    if (error instanceof Error) {
      const errorMessage = error.message
      
      // 429 Too Many Requests - quota exceeded
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('Too Many Requests')) {
        return NextResponse.json(
          { 
            error: 'API quota exceeded', 
            details: 'Daily Gemini API call limit reached. Try again tomorrow or upgrade.',
            code: 'QUOTA_EXCEEDED'
          },
          { status: 429 }
        )
      }
      
      // 401 Unauthorized - API Key issue
      if (errorMessage.includes('401') || errorMessage.includes('API key')) {
        return NextResponse.json(
          { 
            error: 'Invalid API key', 
            details: 'Gemini API key is invalid or expired. Check configuration.',
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
    return NextResponse.json(
      { 
        error: 'Analysis failed', 
        details: error instanceof Error ? error.message : 'Unknown error. Please try again later.',
        code: 'UNKNOWN_ERROR'
      },
      { status: 500 }
    )
  }
}
