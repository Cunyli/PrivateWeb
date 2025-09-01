import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Sparkles, Tag, Camera, Copy, Check, Type, FileText, AlertTriangle } from 'lucide-react'
import { useImageAnalysis } from '@/hooks/use-image-analysis'

interface ImageAnalysisComponentProps {
  imageUrl: string
  onResultUpdate?: (field: 'title' | 'subtitle' | 'description', result: string) => void
}

export function ImageAnalysisComponent({ imageUrl, onResultUpdate }: ImageAnalysisComponentProps) {
  const { analyzeImage, isAnalyzing } = useImageAnalysis()
  const [results, setResults] = useState<{
    title?: string
    subtitle?: string
    description?: string
    tags?: string
    technical?: string
    custom?: string
  }>({})
  const [errors, setErrors] = useState<{
    title?: string
    subtitle?: string
    description?: string
    complete?: string
    tags?: string
    technical?: string
    custom?: string
  }>({})
  const [copiedStates, setCopiedStates] = useState<{
    title?: boolean
    subtitle?: boolean
    description?: boolean
    tags?: boolean
    technical?: boolean
    custom?: boolean
  }>({})
  const [isLoading, setIsLoading] = useState<{
    title?: boolean
    subtitle?: boolean
    description?: boolean
    tags?: boolean
    technical?: boolean
    custom?: boolean
  }>({})
  const [customPrompt, setCustomPrompt] = useState('')

  // 一键生成所有字段
  const handleCompleteGeneration = async () => {
    console.log('开始一键生成...')
    
    try {
      // 清除错误并设置加载状态
      setErrors(prev => ({ ...prev, complete: undefined }))
      setIsLoading(prev => ({ ...prev, title: true, subtitle: true, description: true }))
      
      // 并行调用三个API
      console.log('并行调用三个生成API...')
      const [titleResult, subtitleResult, descriptionResult] = await Promise.all([
        analyzeImage(imageUrl, 'title'),
        analyzeImage(imageUrl, 'subtitle'),
        analyzeImage(imageUrl, 'description')
      ])
      
      // 检查结果并更新状态
      const updates: Record<string, string> = {}
      
      if (titleResult.success) {
        updates.title = titleResult.result
      } else {
        setErrors(prev => ({ ...prev, title: titleResult.error || '标题生成失败' }))
      }
      
      if (subtitleResult.success) {
        updates.subtitle = subtitleResult.result
      } else {
        setErrors(prev => ({ ...prev, subtitle: subtitleResult.error || '副标题生成失败' }))
      }
      
      if (descriptionResult.success) {
        updates.description = descriptionResult.result
      } else {
        setErrors(prev => ({ ...prev, description: descriptionResult.error || '描述生成失败' }))
      }
      
      // 一次性更新所有结果
      setResults(prev => ({ ...prev, ...updates }))
      
      // 延时通知父组件所有更新
      setTimeout(() => {
        Object.entries(updates).forEach(([field, value]) => {
          if (field === 'title' || field === 'subtitle' || field === 'description') {
            console.log(`通知更新${field}:`, value)
            onResultUpdate?.(field as 'title' | 'subtitle' | 'description', value)
          }
        })
      }, 25)
      
      console.log('一键生成完成！')
    } catch (error) {
      console.error('一键生成失败:', error)
      setErrors(prev => ({ ...prev, complete: '一键生成失败，请重试' }))
    } finally {
      // 清除加载状态
      setIsLoading(prev => ({ ...prev, title: false, subtitle: false, description: false }))
    }
  }

  const handleAnalyze = async (type: 'title' | 'subtitle' | 'description' | 'tags' | 'technical' | 'custom') => {
    try {
      // 清除错误
      setErrors(prev => ({ ...prev, [type]: undefined }))
      setIsLoading(prev => ({ ...prev, [type]: true }))
      
      const prompt = type === 'custom' ? customPrompt : type
      const result = await analyzeImage(imageUrl, type === 'custom' ? undefined : type)
      
      if (result.success) {
        setResults(prev => ({ ...prev, [type]: result.result }))
        
        // 如果是必填字段，通知父组件
        if (type === 'title' || type === 'subtitle' || type === 'description') {
          setTimeout(() => {
            console.log(`单独通知更新${type}:`, result.result)
            onResultUpdate?.(type, result.result)
          }, 25)
        }
      } else {
        setErrors(prev => ({ ...prev, [type]: result.error || '分析失败' }))
      }
    } catch (error) {
      console.error(`分析${type}失败:`, error)
      setErrors(prev => ({ ...prev, [type]: '分析失败，请重试' }))
    } finally {
      setIsLoading(prev => ({ ...prev, [type]: false }))
    }
  }

  const copyToClipboard = async (type: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedStates(prev => ({ ...prev, [type]: true }))
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [type]: false }))
      }, 2000)
    } catch (error) {
      console.error('复制失败:', error)
    }
  }

  return (
    <div className="w-full space-y-3">
      {/* 一键生成 - 精简版 */}
      <div className="space-y-2">
        <Button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleCompleteGeneration()
          }}
          disabled={!imageUrl || isLoading.title || isLoading.subtitle || isLoading.description}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-2 text-sm"
          size="sm"
        >
          {isLoading.title || isLoading.subtitle || isLoading.description ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-3 w-3" />
              一键生成所有字段
            </>
          )}
        </Button>
        
        {errors.complete && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {errors.complete}
          </div>
        )}
      </div>

      {/* 单独生成按钮 - 精简版 */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleAnalyze('title')
          }}
          disabled={!imageUrl || isLoading.title}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          {isLoading.title ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Type className="h-3 w-3 mr-1" />
              标题
            </>
          )}
        </Button>
        
        <Button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleAnalyze('subtitle')
          }}
          disabled={!imageUrl || isLoading.subtitle}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          {isLoading.subtitle ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Type className="h-3 w-3 mr-1" />
              副标题
            </>
          )}
        </Button>
        
        <Button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleAnalyze('description')
          }}
          disabled={!imageUrl || isLoading.description}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          {isLoading.description ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <FileText className="h-3 w-3 mr-1" />
              描述
            </>
          )}
        </Button>
      </div>

      {/* 高级分析功能 - 折叠式 */}
      <details className="border border-gray-200 rounded">
        <summary className="cursor-pointer p-2 text-sm font-medium bg-gray-50 rounded hover:bg-gray-100">
          🔧 高级分析工具
        </summary>
        <div className="p-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAnalyze('tags')
              }}
              disabled={!imageUrl || isLoading.tags}
              variant="ghost"
              size="sm"
              className="text-xs"
            >
              {isLoading.tags ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Tag className="h-3 w-3 mr-1" />
                  标签
                </>
              )}
            </Button>
            
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAnalyze('technical')
              }}
              disabled={!imageUrl || isLoading.technical}
              variant="ghost"
              size="sm"
              className="text-xs"
            >
              {isLoading.technical ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Camera className="h-3 w-3 mr-1" />
                  技术
                </>
              )}
            </Button>
          </div>
          
          {/* 自定义分析 */}
          <div className="space-y-1">
            <Input
              placeholder="自定义分析提示词..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="text-xs h-8"
            />
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAnalyze('custom')
              }}
              disabled={!imageUrl || !customPrompt.trim() || isLoading.custom}
              size="sm"
              className="w-full text-xs"
            >
              {isLoading.custom ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1" />
                  自定义分析
                </>
              )}
            </Button>
          </div>
        </div>
      </details>

      {/* 错误显示 */}
      {(errors.title || errors.subtitle || errors.description || errors.tags || errors.technical || errors.custom) && (
        <div className="space-y-1">
          {errors.title && <div className="text-xs text-red-600 bg-red-50 p-1 rounded">标题: {errors.title}</div>}
          {errors.subtitle && <div className="text-xs text-red-600 bg-red-50 p-1 rounded">副标题: {errors.subtitle}</div>}
          {errors.description && <div className="text-xs text-red-600 bg-red-50 p-1 rounded">描述: {errors.description}</div>}
          {errors.tags && <div className="text-xs text-red-600 bg-red-50 p-1 rounded">标签: {errors.tags}</div>}
          {errors.technical && <div className="text-xs text-red-600 bg-red-50 p-1 rounded">技术: {errors.technical}</div>}
          {errors.custom && <div className="text-xs text-red-600 bg-red-50 p-1 rounded">自定义: {errors.custom}</div>}
        </div>
      )}

      {/* 结果显示 - 精简版 */}
      {(results.title || results.subtitle || results.description || results.tags || results.technical || results.custom) && (
        <details className="border border-green-200 rounded">
          <summary className="cursor-pointer p-2 text-sm font-medium bg-green-50 rounded hover:bg-green-100">
            ✅ 生成结果 ({Object.values(results).filter(Boolean).length} 项)
          </summary>
          <div className="p-2 space-y-2 max-h-40 overflow-y-auto">
            {results.title && (
              <div className="text-xs">
                <span className="font-medium text-blue-600">标题:</span> {results.title}
              </div>
            )}
            {results.subtitle && (
              <div className="text-xs">
                <span className="font-medium text-green-600">副标题:</span> {results.subtitle}
              </div>
            )}
            {results.description && (
              <div className="text-xs">
                <span className="font-medium text-purple-600">描述:</span> {results.description}
              </div>
            )}
            {results.tags && (
              <div className="text-xs">
                <span className="font-medium text-orange-600">标签:</span> {results.tags}
              </div>
            )}
            {results.technical && (
              <div className="text-xs">
                <span className="font-medium text-red-600">技术:</span> {results.technical}
              </div>
            )}
            {results.custom && (
              <div className="text-xs">
                <span className="font-medium text-gray-600">自定义:</span> {results.custom}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  )
}
