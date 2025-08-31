import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// 初始化 Gemini AI
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

    // 获取模型 - 可选模型列表：
    // 'gemini-1.5-flash'     - 速度快，成本低，适合日常使用
    // 'gemini-1.5-pro'       - 质量高，功能强，成本较高
    // 'gemini-2.0-flash-exp' - Gemini 2.0 Flash 实验版本，最新功能
    // 'gemini-exp-1206'      - Gemini 2.0 实验版本
    // 注意: Gemini 2.5 模型目前可能需要特殊访问权限或尚未公开发布
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // 根据分析类型设置不同的提示词，如果有自定义prompt则优先使用
    let prompt = ''
    
    if (customPrompt) {
      // 使用自定义 prompt
      prompt = customPrompt
    } else {
      // 使用默认 prompt
      switch (analysisType) {
        case 'title':
          prompt = `请为这张摄影作品生成一个简洁优雅的标题。要求：
1. 体现图片的主要内容和情感
2. 语言优美且富有诗意
3. 长度控制在8-15个字符
4. 适合摄影作品集展示
5. 可以是中文或英文

只返回标题文字，不要添加引号或其他说明。`
          break
      case 'subtitle':
        prompt = `请为这张摄影作品生成一个副标题。要求：
1. 补充主标题的信息
2. 可以包含拍摄地点、时间、风格等信息
3. 长度控制在10-25个字符
4. 语调与主标题协调
5. 提供更多背景信息

只返回副标题文字，不要添加引号或其他说明。`
        break
      case 'complete':
        prompt = `请为这张摄影作品生成完整的标题、副标题和描述。请严格按照以下格式返回，不要添加任何其他文字：

标题：[在这里写8-15个字符的简洁标题]
副标题：[在这里写10-25个字符的补充信息]
描述：[在这里写80-120字的详细描述，包含拍摄主体、风格、氛围、色彩等]

要求：
- 标题要优美且富有诗意
- 副标题可包含地点、时间、风格等信息  
- 描述要专业且富有感染力
- 整体风格统一，适合摄影作品集

请严格按照"标题："、"副标题："、"描述："的格式开头，每行一个字段。`
        break
      case 'description':
        prompt = `请仔细分析这张图片，为摄影作品集生成一个简洁优雅的描述。描述应该包含：
1. 主要拍摄主体和场景
2. 拍摄风格和氛围
3. 色彩和光线特点
4. 整体情感或意境

请用中文回复，保持在100字以内，语言要优美且专业。只返回描述文字，不要添加其他说明。`
        break
      case 'tags':
        prompt = `请为这张摄影作品生成相关标签。分析图片内容并生成：
1. 拍摄主题类别（如：人像、风景、建筑、静物等）
2. 风格标签（如：极简、复古、现代、艺术等）
3. 色彩标签（如：暖色调、冷色调、黑白、高对比等）
4. 情感标签（如：宁静、活力、优雅、神秘等）

请用中文回复，以逗号分隔的标签形式返回，最多10个标签。只返回标签，不要添加其他说明。`
        break
      case 'technical':
        prompt = `请分析这张照片的技术特点，包含：
1. 拍摄技法（如：景深、构图、角度等）
2. 光线分析（如：自然光、人工光、光线方向等）
3. 后期风格（如：调色风格、对比度、饱和度等）
4. 建议的相机设置或拍摄建议

请用中文回复，保持在150字以内，专业且实用。只返回分析内容，不要添加其他说明。`
        break
      default:
        prompt = '请简单描述这张图片的内容。'
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
    
    // 检查是否是配额限制错误
    if (error instanceof Error) {
      const errorMessage = error.message
      
      // 429 Too Many Requests - 配额用完
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('Too Many Requests')) {
        return NextResponse.json(
          { 
            error: 'API 配额已用完', 
            details: '今日 Gemini API 调用次数已达上限（50次），请明天再试或升级到付费版本。',
            code: 'QUOTA_EXCEEDED'
          },
          { status: 429 }
        )
      }
      
      // 401 Unauthorized - API Key 问题
      if (errorMessage.includes('401') || errorMessage.includes('API key')) {
        return NextResponse.json(
          { 
            error: 'API Key 错误', 
            details: 'Gemini API Key 无效或已过期，请检查配置。',
            code: 'INVALID_API_KEY'
          },
          { status: 401 }
        )
      }
      
      // 400 Bad Request - 请求格式错误
      if (errorMessage.includes('400')) {
        return NextResponse.json(
          { 
            error: '请求格式错误', 
            details: '图片格式不支持或请求参数有误。',
            code: 'BAD_REQUEST'
          },
          { status: 400 }
        )
      }
    }
    
    // 其他未知错误
    return NextResponse.json(
      { 
        error: '分析失败', 
        details: error instanceof Error ? error.message : '未知错误，请稍后重试。',
        code: 'UNKNOWN_ERROR'
      },
      { status: 500 }
    )
  }
}
