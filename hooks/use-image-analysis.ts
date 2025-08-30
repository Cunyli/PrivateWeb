import { useState } from 'react'

export interface AnalysisResult {
  success: boolean
  analysisType: 'title' | 'subtitle' | 'complete' | 'description' | 'tags' | 'technical'
  result: string
  error?: string
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
        throw new Error(data.error || 'Analysis failed')
      }

      setLastResult(data)
      return data
    } catch (error) {
      const errorResult: AnalysisResult = {
        success: false,
        analysisType,
        result: '',
        error: error instanceof Error ? error.message : 'Unknown error'
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
