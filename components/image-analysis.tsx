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
  const [customPrompt, setCustomPrompt] = useState('')

  const handleAnalyze = async (type: 'title' | 'subtitle' | 'complete' | 'description' | 'tags' | 'technical', customPromptText?: string) => {
    const result = await analyzeImage(imageUrl, type, customPromptText)
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
          Gemini 图片分析
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="complete" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
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
            <TabsTrigger value="custom" className="flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              自定义
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
                    Gemini 正在分析中...
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
                  placeholder="Gemini 生成的标题"
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
                  placeholder="Gemini 生成的副标题"
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
                    placeholder="Gemini 生成的图片描述将显示在这里..."
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
                  placeholder="Gemini 生成的标签将显示在这里..."
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
                  placeholder="Gemini 生成的技术分析将显示在这里..."
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="text-sm font-medium">默认 Prompt 模板：</label>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setCustomPrompt(`请为这张摄影作品生成一个简洁优雅的标题。要求：
1. 体现图片的主要内容和情感
2. 语言优美且富有诗意
3. 长度控制在8-15个字符
4. 适合摄影作品集展示
5. 可以是中文或英文

只返回标题文字，不要添加引号或其他说明。`)
                    }}
                    className="justify-start text-left h-auto p-3"
                  >
                    <div>
                      <div className="font-medium">标题生成 Prompt</div>
                      <div className="text-xs text-gray-500 mt-1">生成简洁优雅的标题，8-15字符</div>
                    </div>
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setCustomPrompt(`请为这张摄影作品生成一个副标题。要求：
1. 补充主标题的信息
2. 可以包含拍摄地点、时间、风格等信息
3. 长度控制在10-25个字符
4. 语调与主标题协调
5. 提供更多背景信息

只返回副标题文字，不要添加引号或其他说明。`)
                    }}
                    className="justify-start text-left h-auto p-3"
                  >
                    <div>
                      <div className="font-medium">副标题生成 Prompt</div>
                      <div className="text-xs text-gray-500 mt-1">生成补充信息的副标题，10-25字符</div>
                    </div>
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setCustomPrompt(`请仔细分析这张图片，为摄影作品集生成一个简洁优雅的描述。描述应该包含：
1. 主要拍摄主体和场景
2. 拍摄风格和氛围
3. 色彩和光线特点
4. 整体情感或意境

请用中文回复，保持在100字以内，语言要优美且专业。只返回描述文字，不要添加其他说明。`)
                    }}
                    className="justify-start text-left h-auto p-3"
                  >
                    <div>
                      <div className="font-medium">描述生成 Prompt</div>
                      <div className="text-xs text-gray-500 mt-1">生成详细的图片描述，100字以内</div>
                    </div>
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setCustomPrompt(`请为这张摄影作品生成相关标签。分析图片内容并生成：
1. 拍摄主题类别（如：人像、风景、建筑、静物等）
2. 风格标签（如：极简、复古、现代、艺术等）
3. 色彩标签（如：暖色调、冷色调、黑白、高对比等）
4. 情感标签（如：宁静、活力、优雅、神秘等）

请用中文回复，以逗号分隔的标签形式返回，最多10个标签。只返回标签，不要添加其他说明。`)
                    }}
                    className="justify-start text-left h-auto p-3"
                  >
                    <div>
                      <div className="font-medium">标签生成 Prompt</div>
                      <div className="text-xs text-gray-500 mt-1">生成相关标签，最多10个</div>
                    </div>
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setCustomPrompt(`请分析这张照片的技术特点，包含：
1. 拍摄技法（如：景深、构图、角度等）
2. 光线分析（如：自然光、人工光、光线方向等）
3. 后期风格（如：调色风格、对比度、饱和度等）
4. 建议的相机设置或拍摄建议

请用中文回复，保持在150字以内，专业且实用。只返回分析内容，不要添加其他说明。`)
                    }}
                    className="justify-start text-left h-auto p-3"
                  >
                    <div>
                      <div className="font-medium">技术分析 Prompt</div>
                      <div className="text-xs text-gray-500 mt-1">分析拍摄技法和技术特点，150字以内</div>
                    </div>
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setCustomPrompt(`请为这张摄影作品生成完整的标题、副标题和描述。请严格按照以下格式返回，不要添加任何其他文字：

标题：[在这里写8-15个字符的简洁标题]
副标题：[在这里写10-25个字符的补充信息]
描述：[在这里写80-120字的详细描述，包含拍摄主体、风格、氛围、色彩等]

要求：
- 标题要优美且富有诗意
- 副标题可包含地点、时间、风格等信息  
- 描述要专业且富有感染力
- 整体风格统一，适合摄影作品集

请严格按照"标题："、"副标题："、"描述："的格式开头，每行一个字段。`)
                    }}
                    className="justify-start text-left h-auto p-3"
                  >
                    <div>
                      <div className="font-medium">完整生成 Prompt</div>
                      <div className="text-xs text-gray-500 mt-1">一次性生成标题、副标题和描述</div>
                    </div>
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">自定义 Prompt：</label>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="min-h-[120px]"
                  placeholder="输入你的自定义 prompt，或点击上方模板快速填入默认 prompt..."
                />
              </div>
              
              <Button
                onClick={async () => {
                  const result = await analyzeImage(imageUrl, 'description', customPrompt)
                  if (result.success) {
                    setResults(prev => ({ ...prev, custom: result.result }))
                    onResultUpdate?.('description', result.result)
                  }
                }}
                disabled={isAnalyzing || !customPrompt.trim()}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gemini 正在分析中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    使用自定义 Prompt 分析
                  </>
                )}
              </Button>
              
              {results.custom && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">分析结果：</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(results.custom!, 'custom')}
                    >
                      {copiedStates.custom ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={results.custom}
                    onChange={(e) => {
                      setResults(prev => ({ ...prev, custom: e.target.value }))
                      onResultUpdate?.('description', e.target.value)
                    }}
                    className="min-h-[120px]"
                    placeholder="自定义分析结果将显示在这里..."
                  />
                </div>
              )}
              
              <div className="p-3 bg-amber-50 rounded-md">
                <p className="text-sm text-amber-700">
                  💡 自定义 Prompt 使用指南：
                  <br />• 点击上方模板按钮快速载入默认 prompt
                  <br />• 基于默认 prompt 进行修改和定制
                  <br />• 可以指定输出格式（诗歌、列表、专业术语等）
                  <br />• 可以要求特定角度分析（艺术性、技术性、情感等）
                  <br />• 可以指定输出语言和风格
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
