import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Sparkles, Tag, Camera, Copy, Check, Type, FileText } from 'lucide-react'
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
  }>({})
  const [copiedStates, setCopiedStates] = useState<{
    title?: boolean
    subtitle?: boolean
    description?: boolean
    tags?: boolean
    technical?: boolean
  }>({})

  const handleAnalyze = async (type: 'title' | 'subtitle' | 'complete' | 'description' | 'tags' | 'technical') => {
    const result = await analyzeImage(imageUrl, type)
    if (result.success) {
      if (type === 'complete') {
        // 解析完整分析结果 - 更健壮的解析逻辑
        const text = result.result.trim()
        const parsedResults: any = {}
        
        console.log('AI 返回的完整结果:', text)
        
        // 使用正则表达式更精确地提取内容（修复兼容性问题）
        const titleMatch = text.match(/标题[：:][\s]*([^\n]+)/i)
        const subtitleMatch = text.match(/副标题[：:][\s]*([^\n]+)/i)
        const descriptionMatch = text.match(/描述[：:][\s]*([\s\S]*?)$/i)
        
        if (titleMatch) {
          parsedResults.title = titleMatch[1].trim()
          console.log('提取到标题:', parsedResults.title)
        }
        
        if (subtitleMatch) {
          parsedResults.subtitle = subtitleMatch[1].trim()
          console.log('提取到副标题:', parsedResults.subtitle)
        }
        
        if (descriptionMatch) {
          parsedResults.description = descriptionMatch[1].trim()
          console.log('提取到描述:', parsedResults.description)
        }
        
        // 如果正则匹配失败，尝试按行解析
        if (!titleMatch && !subtitleMatch && !descriptionMatch) {
          console.log('正则匹配失败，尝试按行解析')
          const lines = text.split('\n').filter(line => line.trim())
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            if (line.match(/^标题/)) {
              parsedResults.title = line.replace(/^标题[：:]/, '').trim()
            } else if (line.match(/^副标题/)) {
              parsedResults.subtitle = line.replace(/^副标题[：:]/, '').trim()
            } else if (line.match(/^描述/)) {
              parsedResults.description = line.replace(/^描述[：:]/, '').trim()
            }
          }
        }
        
        console.log('最终解析结果:', parsedResults)
        
        // 更新本地状态
        setResults(prev => ({
          ...prev,
          ...parsedResults
        }))
        
        // 分别通知父组件更新每个字段
        setTimeout(() => {
          if (parsedResults.title) {
            console.log('通知更新标题:', parsedResults.title)
            onResultUpdate?.('title', parsedResults.title)
          }
        }, 100)
        
        setTimeout(() => {
          if (parsedResults.subtitle) {
            console.log('通知更新副标题:', parsedResults.subtitle)
            onResultUpdate?.('subtitle', parsedResults.subtitle)
          }
        }, 200)
        
        setTimeout(() => {
          if (parsedResults.description) {
            console.log('通知更新描述:', parsedResults.description)
            onResultUpdate?.('description', parsedResults.description)
          }
        }, 300)
      } else {
        setResults(prev => ({
          ...prev,
          [type]: result.result
        }))
        
        // 通知父组件更新对应字段
        if (type === 'title' || type === 'subtitle' || type === 'description') {
          onResultUpdate?.(type, result.result)
        }
      }
    }
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedStates(prev => ({ ...prev, [type]: true }))
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [type]: false }))
      }, 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const parseTags = (tagsString: string): string[] => {
    return tagsString.split(/[,，、]/).map(tag => tag.trim()).filter(tag => tag.length > 0)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          AI 图片分析
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="complete" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="complete" className="flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              一键生成
            </TabsTrigger>
            <TabsTrigger value="title" className="flex items-center gap-1">
              <Type className="w-4 h-4" />
              标题
            </TabsTrigger>
            <TabsTrigger value="description" className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              描述
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-1">
              <Camera className="w-4 h-4" />
              高级
            </TabsTrigger>
          </TabsList>

          <TabsContent value="complete" className="space-y-4">
            <div className="flex flex-col gap-4">
              <Button
                onClick={() => handleAnalyze('complete')}
                disabled={isAnalyzing}
                className="w-full"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    AI 正在分析中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    一键生成标题、副标题和描述
                  </>
                )}
              </Button>
              
              {(results.title || results.subtitle || results.description) && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  {results.title && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">生成的标题：</label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(results.title!, 'title')}
                        >
                          {copiedStates.title ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <Input
                        value={results.title}
                        onChange={(e) => {
                          setResults(prev => ({ ...prev, title: e.target.value }))
                          onResultUpdate?.('title', e.target.value)
                        }}
                        placeholder="标题"
                      />
                    </div>
                  )}
                  
                  {results.subtitle && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">生成的副标题：</label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(results.subtitle!, 'subtitle')}
                        >
                          {copiedStates.subtitle ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <Input
                        value={results.subtitle}
                        onChange={(e) => {
                          setResults(prev => ({ ...prev, subtitle: e.target.value }))
                          onResultUpdate?.('subtitle', e.target.value)
                        }}
                        placeholder="副标题"
                      />
                    </div>
                  )}
                  
                  {results.description && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">生成的描述：</label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(results.description!, 'description')}
                        >
                          {copiedStates.description ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <Textarea
                        value={results.description}
                        onChange={(e) => {
                          setResults(prev => ({ ...prev, description: e.target.value }))
                          onResultUpdate?.('description', e.target.value)
                        }}
                        className="min-h-[100px]"
                        placeholder="描述"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="title" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => handleAnalyze('title')}
                disabled={isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Type className="w-4 h-4 mr-2" />
                    生成标题
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => handleAnalyze('subtitle')}
                disabled={isAnalyzing}
                variant="outline"
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Type className="w-4 h-4 mr-2" />
                    生成副标题
                  </>
                )}
              </Button>
            </div>
            
            {results.title && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">标题：</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(results.title!, 'title')}
                  >
                    {copiedStates.title ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <Input
                  value={results.title}
                  onChange={(e) => {
                    setResults(prev => ({ ...prev, title: e.target.value }))
                    onResultUpdate?.('title', e.target.value)
                  }}
                  placeholder="AI 生成的标题"
                />
              </div>
            )}
            
            {results.subtitle && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">副标题：</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(results.subtitle!, 'subtitle')}
                  >
                    {copiedStates.subtitle ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <Input
                  value={results.subtitle}
                  onChange={(e) => {
                    setResults(prev => ({ ...prev, subtitle: e.target.value }))
                    onResultUpdate?.('subtitle', e.target.value)
                  }}
                  placeholder="AI 生成的副标题"
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="description" className="space-y-4">
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => handleAnalyze('description')}
                disabled={isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    生成图片描述
                  </>
                )}
              </Button>
              {results.description && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">生成的描述：</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(results.description!, 'description')}
                    >
                      {copiedStates.description ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={results.description}
                    onChange={(e) => {
                      setResults(prev => ({ ...prev, description: e.target.value }))
                      onResultUpdate?.('description', e.target.value)
                    }}
                    className="min-h-[100px]"
                    placeholder="AI 生成的图片描述将显示在这里..."
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => handleAnalyze('tags')}
                disabled={isAnalyzing}
                variant="outline"
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Tag className="w-4 h-4 mr-2" />
                    生成标签
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => handleAnalyze('technical')}
                disabled={isAnalyzing}
                variant="outline"
                className="w-full"
              >
                {isAnalyzing ? (
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
            </div>
            
            {results.tags && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">生成的标签：</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(results.tags!, 'tags')}
                  >
                    {copiedStates.tags ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-md">
                  {parseTags(results.tags).map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Textarea
                  value={results.tags}
                  onChange={(e) => setResults(prev => ({ ...prev, tags: e.target.value }))}
                  className="min-h-[80px]"
                  placeholder="AI 生成的标签将显示在这里..."
                />
              </div>
            )}
            
            {results.technical && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">技术分析：</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(results.technical!, 'technical')}
                  >
                    {copiedStates.technical ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <Textarea
                  value={results.technical}
                  onChange={(e) => setResults(prev => ({ ...prev, technical: e.target.value }))}
                  className="min-h-[120px]"
                  placeholder="AI 生成的技术分析将显示在这里..."
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-4 p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-700">
            💡 提示：AI 分析结果仅供参考，你可以根据需要修改生成的内容。生成的内容会自动填入相应的表单字段。
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
