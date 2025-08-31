import { useState } from 'react'

export interface AnalysisResult {
  success: boolean
  analysisType: 'title' | 'subtitle' | 'complete' | 'description' | 'tags' | 'technical'
  result: string
  error?: string
  code?: string // 错误代码
}

export function useImageAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [lastResult, setLastResult] = useState<AnalysisResult | null>(null)

  const analyzeImage = async (
    imageUrl: string, 
    analysisType: 'title' | 'subtitle' | 'complete' | 'description' | 'tags' | 'technical' = 'description',
    customPrompt?: string
  ): Promise<AnalysisResult> => {
    setIsAnalyzing(true)
    
    try {
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          analysisType,
          ...(customPrompt && { customPrompt })
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // 根据错误代码提供更友好的错误信息
        let userFriendlyMessage = data.details || data.error || 'Analysis failed'
        
        if (data.code === 'QUOTA_EXCEEDED') {
          userFriendlyMessage = 'AI 分析功能今日配额已用完，请明天再试'
        } else if (data.code === 'INVALID_API_KEY') {
          userFriendlyMessage = 'AI 服务配置错误，请联系管理员'
        } else if (data.code === 'BAD_REQUEST') {
          userFriendlyMessage = '图片格式不支持，请更换图片'
        }
        
        throw new Error(userFriendlyMessage)
      }

      setLastResult(data)
      return data
    } catch (error) {
      const errorResult: AnalysisResult = {
        success: false,
        analysisType,
        result: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'FETCH_ERROR'
      }
      setLastResult(errorResult)
      return errorResult
    } finally {
      setIsAnalyzing(false)
    }
  }

  return {
    analyzeImage,
    isAnalyzing,
    lastResult
  }
}
