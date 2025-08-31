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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          Gemini 图片分析
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 一键生成 */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200 mb-6">
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleCompleteGeneration()
            }}
            disabled={!imageUrl || isLoading.title || isLoading.subtitle || isLoading.description}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-3"
          >
            {isLoading.title || isLoading.subtitle || isLoading.description ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                一键生成所有字段
              </>
            )}
          </Button>
          
          {errors.complete && (
            <Alert className="mt-3 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                {errors.complete}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* 单独生成按钮 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* 标题生成 */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Type className="w-4 h-4 text-blue-500" />
                标题生成
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleAnalyze('title')
                }}
                disabled={!imageUrl || isLoading.title}
                className="w-full"
                size="sm"
              >
                {isLoading.title ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Tag className="w-4 h-4 mr-2" />
                    生成标题
                  </>
                )}
              </Button>
              
              {errors.title && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                  {errors.title}
                </div>
              )}
              
              {results.title && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">生成结果：</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        copyToClipboard('title', results.title!)
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      {copiedStates.title ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" />
                          复制
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                    {results.title}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 副标题生成 */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Type className="w-4 h-4 text-green-500" />
                副标题生成
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleAnalyze('subtitle')
                }}
                disabled={!imageUrl || isLoading.subtitle}
                className="w-full"
                size="sm"
              >
                {isLoading.subtitle ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Tag className="w-4 h-4 mr-2" />
                    生成副标题
                  </>
                )}
              </Button>
              
              {errors.subtitle && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                  {errors.subtitle}
                </div>
              )}
              
              {results.subtitle && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">生成结果：</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        copyToClipboard('subtitle', results.subtitle!)
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      {copiedStates.subtitle ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" />
                          复制
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="p-2 bg-green-50 border border-green-200 rounded text-sm">
                    {results.subtitle}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 描述生成 */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-purple-500" />
                描述生成
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleAnalyze('description')
                }}
                disabled={!imageUrl || isLoading.description}
                className="w-full"
                size="sm"
              >
                {isLoading.description ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    生成描述
                  </>
                )}
              </Button>
              
              {errors.description && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                  {errors.description}
                </div>
              )}
              
              {results.description && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">生成结果：</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        copyToClipboard('description', results.description!)
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      {copiedStates.description ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" />
                          复制
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="p-2 bg-purple-50 border border-purple-200 rounded text-sm">
                    {results.description}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 高级分析功能 */}
        <Tabs defaultValue="tags" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tags">标签提取</TabsTrigger>
            <TabsTrigger value="technical">技术分析</TabsTrigger>
            <TabsTrigger value="custom">自定义分析</TabsTrigger>
          </TabsList>

          <TabsContent value="tags" className="space-y-4">
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAnalyze('tags')
              }}
              disabled={!imageUrl || isLoading.tags}
              className="w-full"
            >
              {isLoading.tags ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Tag className="w-4 h-4 mr-2" />
                  提取图片标签
                </>
              )}
            </Button>
            
            {errors.tags && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  {errors.tags}
                </AlertDescription>
              </Alert>
            )}
            
            {results.tags && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">标签结果：</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      copyToClipboard('tags', results.tags!)
                    }}
                  >
                    {copiedStates.tags ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        复制
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  value={results.tags}
                  readOnly
                  className="min-h-[100px] bg-gray-50"
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="technical" className="space-y-4">
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAnalyze('technical')
              }}
              disabled={!imageUrl || isLoading.technical}
              className="w-full"
            >
              {isLoading.technical ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  技术分析
                </>
              )}
            </Button>
            
            {errors.technical && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  {errors.technical}
                </AlertDescription>
              </Alert>
            )}
            
            {results.technical && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">技术分析：</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      copyToClipboard('technical', results.technical!)
                    }}
                  >
                    {copiedStates.technical ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        复制
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  value={results.technical}
                  readOnly
                  className="min-h-[150px] bg-gray-50"
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">自定义分析提示词：</label>
              <Textarea
                placeholder="输入你想要的分析内容，例如：分析这张图片的色彩搭配..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAnalyze('custom')
              }}
              disabled={!imageUrl || !customPrompt.trim() || isLoading.custom}
              className="w-full"
            >
              {isLoading.custom ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  开始自定义分析
                </>
              )}
            </Button>
            
            {errors.custom && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  {errors.custom}
                </AlertDescription>
              </Alert>
            )}
            
            {results.custom && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">分析结果：</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      copyToClipboard('custom', results.custom!)
                    }}
                  >
                    {copiedStates.custom ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        复制
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  value={results.custom}
                  readOnly
                  className="min-h-[150px] bg-gray-50"
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
