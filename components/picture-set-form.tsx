// components/picture-set-form.tsx
"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, ArrowUp, Sparkles, Camera } from "lucide-react"
import imageCompression from "browser-image-compression"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ImageAnalysisComponent } from "@/components/image-analysis"
import { useImageAnalysis } from "@/hooks/use-image-analysis"
import { supabase } from "@/utils/supabase"

import type { PictureSet } from "@/lib/pictureSet.types"
import type { PictureFormData, PictureSetSubmitData } from "@/lib/form-types"

interface PictureSetFormProps {
  onSubmit: (pictureSet: PictureSetSubmitData, pictureSetId?: number) => void
  editingPictureSet?: PictureSet | null
  onCancel?: () => void
}

// 压缩图片的函数
async function compressImage(file: File, quality = 0.9): Promise<File> {
  const options = {
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: quality,
    fileType: "image/webp",
  }
  const compressedFile = await imageCompression(file, options)
  return new File([compressedFile], file.name.replace(/\.[^/.]+$/, ".webp"), { type: "image/webp" })
}

// 生成预览 URL
async function getImagePreview(file: File): Promise<{ url: string; size: number }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) =>
      resolve({
        url: e.target?.result as string,
        size: file.size,
      })
    reader.readAsDataURL(file)
  })
}

export function PictureSetForm({ onSubmit, editingPictureSet, onCancel }: PictureSetFormProps) {
  const { analyzeImage } = useImageAnalysis()
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [description, setDescription] = useState("")
  const [cover, setCover] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverOriginalSize, setCoverOriginalSize] = useState<number>(0)
  const [coverImageUrl, setCoverImageUrl] = useState<string>("")
  const [pictures, setPictures] = useState<PictureFormData[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [position, setPosition] = useState<string>("up")
  const [isPublished, setIsPublished] = useState<boolean>(true)
  const [categoryIds, setCategoryIds] = useState<number[]>([])
  const [seasonIds, setSeasonIds] = useState<number[]>([])
  const [sectionIds, setSectionIds] = useState<number[]>([])
  const [availableCategories, setAvailableCategories] = useState<Array<{id:number; name:string}>>([])
  const [availableSeasons, setAvailableSeasons] = useState<Array<{id:number; name:string}>>([])
  const [availableSections, setAvailableSections] = useState<Array<{id:number; name:string}>>([])
  const [primaryLocationName, setPrimaryLocationName] = useState<string>("")
  const [primaryLocationLat, setPrimaryLocationLat] = useState<number | "">("")
  const [primaryLocationLng, setPrimaryLocationLng] = useState<number | "">("")
  const [applySetPropsToPictures, setApplySetPropsToPictures] = useState<boolean>(true)
  const [overrideExistingPictureProps, setOverrideExistingPictureProps] = useState<boolean>(false)
  const [propagateCategoriesToPictures, setPropagateCategoriesToPictures] = useState<boolean>(true)
  const [fillMissingFromSet, setFillMissingFromSet] = useState<boolean>(true)
  const [autogenTitlesSubtitles, setAutogenTitlesSubtitles] = useState<boolean>(true)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingId, setEditingId] = useState<number | undefined>(undefined)
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const [isGenerating, setIsGenerating] = useState({
    title: false,
    subtitle: false,
    description: false,
    tags: false,
  })
  // translations
  const [en, setEn] = useState<{title: string; subtitle: string; description: string}>({ title: "", subtitle: "", description: "" })
  const [zh, setZh] = useState<{title: string; subtitle: string; description: string}>({ title: "", subtitle: "", description: "" })
  // simple comma-separated tags input
  const [tagsText, setTagsText] = useState<string>("")
  const [showAIAnalysis, setShowAIAnalysis] = useState(false)
  const [showPictureAIAnalysis, setShowPictureAIAnalysis] = useState<{[key: number]: boolean}>({})
  const [showPictureTranslations, setShowPictureTranslations] = useState<{[key: number]: boolean}>({})
  const formRef = useRef<HTMLFormElement>(null)
  const picturesContainerRef = useRef<HTMLDivElement>(null)
  const bulkInputRef = useRef<HTMLInputElement>(null)
  // drag-n-drop reorder refs
  const dragItem = useRef<number | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  const movePicture = (from: number, to: number) => {
    if (from === to) return
    setPictures((prev) => {
      const updated = [...prev]
      const [moved] = updated.splice(from, 1)
      updated.splice(to, 0, moved)
      return updated
    })
  }

  const handleDragStartThumb = (index: number) => {
    dragItem.current = index
    setDraggingIndex(index)
  }

  const handleDragEnterThumb = (index: number) => {
    if (dragItem.current === null) return
    if (dragItem.current === index) return
    // reorder live while dragging
    movePicture(dragItem.current, index)
    dragItem.current = index
    setDraggingIndex(index)
  }

  const handleDragEndThumb = () => {
    dragItem.current = null
    setDraggingIndex(null)
  }

  // AI生成函数
  const generateField = async (field: 'title' | 'subtitle' | 'description') => {
    if (!coverPreview) return
    
    setIsGenerating(prev => ({ ...prev, [field]: true }))
    try {
      const result = await analyzeImage(coverPreview, field)
      if (result.success) {
        if (field === 'title') setTitle(result.result)
        if (field === 'subtitle') setSubtitle(result.result)
        if (field === 'description') setDescription(result.result)
      }
    } catch (error) {
      console.error(`生成${field}失败:`, error)
    } finally {
      setIsGenerating(prev => ({ ...prev, [field]: false }))
    }
  }

  // 为图片生成字段
  const generatePictureField = async (pictureIndex: number, field: 'title' | 'subtitle' | 'description') => {
    const picture = pictures[pictureIndex]
    if (!picture.previewUrl) return
    
    setIsGenerating(prev => ({ ...prev, [field]: true }))
    try {
      const result = await analyzeImage(picture.previewUrl, field)
      if (result.success) {
        handlePictureChange(pictureIndex, field, result.result)
      }
    } catch (error) {
      console.error(`生成图片${pictureIndex + 1}的${field}失败:`, error)
    } finally {
      setIsGenerating(prev => ({ ...prev, [field]: false }))
    }
  }

  const generatePictureTags = async (pictureIndex: number) => {
    const picture = pictures[pictureIndex]
    const src = picture.previewUrl
    if (!src) return
    setIsGenerating(prev => ({ ...prev, tags: true }))
    try {
      const result = await analyzeImage(src, 'tags')
      if (result.success) {
        const parts = result.result
          .replace(/\n/g, ',')
          .split(/[,，;；]/)
          .map(s => s.trim())
          .filter(Boolean)
        const uniq = Array.from(new Set(parts.map(s => s.toLowerCase())))
        handlePictureChange(pictureIndex, 'tags', uniq)
      }
    } catch (e) {
      console.error('生成图片标签失败:', e)
    } finally {
      setIsGenerating(prev => ({ ...prev, tags: false }))
    }
  }

  // 生成集合标签（优先使用封面图；没有则用第一张图片）
  const generateTagsForSet = async () => {
    const sourceImage = coverPreview || pictures.find(p => p.previewUrl)?.previewUrl
    if (!sourceImage) return
    setIsGenerating(prev => ({ ...prev, tags: true }))
    try {
      const result = await analyzeImage(sourceImage, 'tags')
      if (result.success) {
        // 解析标签，支持中文逗号、英文逗号、分号和换行
        const parts = result.result
          .replace(/\n/g, ',')
          .split(/[,，;；]/)
          .map(s => s.trim())
          .filter(Boolean)
        const uniq = Array.from(new Set(parts.map(s => s.toLowerCase())));
        setTagsText(uniq.join(', '))
      }
    } catch (e) {
      console.error('生成标签失败', e)
    } finally {
      setIsGenerating(prev => ({ ...prev, tags: false }))
    }
  }

  // 编辑模式初始化
  useEffect(() => {
    // preload vocab tables
    const loadVocab = async () => {
      try {
        const [{ data: cats }, { data: seas }, { data: sects }] = await Promise.all([
          supabase.from('categories').select('id,name').order('name'),
          supabase.from('seasons').select('id,name').order('id'),
          supabase.from('sections').select('id,name,display_order').order('display_order', { ascending: true }),
        ])
        setAvailableCategories((cats || []).map((c:any)=>({ id: c.id, name: c.name })))
        setAvailableSeasons((seas || []).map((s:any)=>({ id: s.id, name: s.name })))
        setAvailableSections((sects || []).map((s:any)=>({ id: s.id, name: s.name })))
      } catch (e) {
        console.warn('Load vocab failed', e)
      }
    }
    loadVocab()

    if (editingPictureSet) {
      setIsEditMode(true)
      setEditingId(editingPictureSet.id)
      setTitle(editingPictureSet.title || "")
      setSubtitle(editingPictureSet.subtitle || "")
      setDescription(editingPictureSet.description || "")
      setCoverImageUrl(editingPictureSet.cover_image_url || "")
      setCoverPreview(editingPictureSet.cover_image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL}${editingPictureSet.cover_image_url}` : null)
      setPosition(editingPictureSet.position || "up")
      // translations and tags (optional on type)
      setEn({
        title: editingPictureSet.en?.title || "",
        subtitle: editingPictureSet.en?.subtitle || "",
        description: editingPictureSet.en?.description || "",
      })
      setZh({
        title: editingPictureSet.zh?.title || "",
        subtitle: editingPictureSet.zh?.subtitle || "",
        description: editingPictureSet.zh?.description || "",
      })
      setTagsText((editingPictureSet.tags || []).join(", "))
      setIsPublished(editingPictureSet.is_published ?? true)
      setCategoryIds((editingPictureSet as any).category_ids || (editingPictureSet.primary_category_id ? [editingPictureSet.primary_category_id] : []))
      setSeasonIds((editingPictureSet as any).season_ids || (editingPictureSet.season_id ? [editingPictureSet.season_id] : []))
      // fetch section assignments
      ;(async () => {
        try {
          const { data: assigns } = await supabase
            .from('picture_set_section_assignments')
            .select('section_id')
            .eq('picture_set_id', editingPictureSet.id)
          setSectionIds((assigns || []).map((r:any)=>r.section_id))
        } catch (e) { console.warn('Load sections failed', e) }
      })()
      // fetch primary location
      ;(async () => {
        try {
          const { data: rows } = await supabase
            .from('picture_set_locations')
            .select('is_primary, locations(id,name,latitude,longitude)')
            .eq('picture_set_id', editingPictureSet.id)
          const locRow = (rows || []).sort((a:any,b:any)=> (b.is_primary?1:0)-(a.is_primary?1:0))[0]
          const loc = locRow?.locations
          if (loc) {
            setPrimaryLocationName(loc.name || '')
            setPrimaryLocationLat(loc.latitude ?? '')
            setPrimaryLocationLng(loc.longitude ?? '')
          }
        } catch (e) { console.warn('Load primary location failed', e) }
      })()

      if (editingPictureSet.pictures) {
        setPictures(
          editingPictureSet.pictures.map((pic) => ({
            id: pic.id,
            title: pic.title || "",
            subtitle: pic.subtitle || "",
            description: pic.description || "",
            season_id: (pic as any).season_id ?? null,
            location_name: (pic as any).location_name || '',
            location_latitude: (pic as any).location_latitude ?? null,
            location_longitude: (pic as any).location_longitude ?? null,
            tags: pic.tags || [],
            en: {
              title: pic.en?.title || "",
              subtitle: pic.en?.subtitle || "",
              description: pic.en?.description || "",
            },
            zh: {
              title: pic.zh?.title || "",
              subtitle: pic.zh?.subtitle || "",
              description: pic.zh?.description || "",
            },
            cover: null,
            previewUrl: pic.image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL}${pic.image_url}` : undefined,
            originalSize: 0,
            compressedSize: undefined,
            image_url: pic.image_url || "",
          }))
        )
      }
    } else if (editingPictureSet === null && (isEditMode || editingId !== undefined)) {
      // 只有当明确从编辑模式切换到非编辑模式时才重置表单
      setIsEditMode(false)
      setEditingId(undefined)
      setTitle("")
      setSubtitle("")
      setDescription("")
      setCover(null)
      setCoverPreview(null)
      setCoverOriginalSize(0)
      setCoverImageUrl("")
      setPictures([])
      setPosition("up")
      setIsPublished(true)
      setCategoryIds([])
      setSeasonIds([])
      setSectionIds([])
      setPrimaryLocationName("")
      setPrimaryLocationLat("")
      setPrimaryLocationLng("")
      setEn({ title: "", subtitle: "", description: "" })
      setZh({ title: "", subtitle: "", description: "" })
      setTagsText("")
    }
  }, [editingPictureSet])

  // 滚动监听
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollToTop(true)
      } else {
        setShowScrollToTop(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const { url, size } = await getImagePreview(file)
        setCoverPreview(url)
        setCoverOriginalSize(size)
        setCover(file)
      } catch (error) {
        console.error("Error loading cover image:", error)
      }
    }
  }

  const handleAddPicture = () => {
    setPictures([
      ...pictures,
      {
        tempId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        title: "",
        subtitle: "",
        description: "",
        season_id: null,
        location_name: '',
        location_latitude: null,
        location_longitude: null,
        tags: [],
        en: { title: "", subtitle: "", description: "" },
        zh: { title: "", subtitle: "", description: "" },
        cover: null,
        previewUrl: undefined,
        originalSize: 0,
        compressedSize: undefined,
        image_url: "",
      },
    ])
  }

  const handleRemovePicture = (index: number) => {
    setPictures(pictures.filter((_, i) => i !== index))
  }

  const handlePictureChange = (index: number, field: string, value: any) => {
    setPictures((prevPictures) =>
      prevPictures.map((pic, i) => {
        if (i !== index) return pic

        if (field === "cover" && value instanceof File) {
          getImagePreview(value).then(({ url, size }) => {
            setPictures((current) =>
              current.map((p, idx) => (idx === index ? { ...p, previewUrl: url, originalSize: size } : p))
            )
          })
          return { ...pic, cover: value }
        }

        // support nested updates like 'en.title' or 'zh.description'
        if (field.includes('.')) {
          const [root, key] = field.split('.')
          if (root === 'en') {
            return { ...pic, en: { ...(pic.en || {}), [key]: value } }
          }
          if (root === 'zh') {
            return { ...pic, zh: { ...(pic.zh || {}), [key]: value } }
          }
        }

        return { ...pic, [field]: value }
      })
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Debug: log intended picture order before upload/submit
      try {
        const debugOrder = pictures.map((p, i) => ({ idx: i, id: (p as any).id, image_url: p.image_url, title: p.title }))
        console.log('Submitting pictures order (top->bottom):', debugOrder)
      } catch {}

      // upload helper to R2 via signed URL
      const uploadFile = async (file: File, objectName: string): Promise<string> => {
        const res = await fetch("/api/upload-to-r2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectName, contentType: file.type }),
        })
        if (!res.ok) throw new Error("Failed to get signed URL")
        const { uploadUrl } = await res.json()
        const buf = await file.arrayBuffer()
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: buf,
        })
        if (!uploadRes.ok) throw new Error("File upload failed")
        // store key path like /picture/xxx
        return `/${objectName}`
      }

      // Cover upload (if provided)
      let coverKey = coverImageUrl
      if (cover) {
        const compressedCover = await compressImage(cover)
        coverKey = await uploadFile(
          compressedCover,
          `picture/cover-${Date.now()}-${compressedCover.name}`,
        )
      }

      // Pictures: upload raw and compressed if a new file provided
      const processedPictures = await Promise.all(
        pictures.map(async (pic, idx) => {
          let image_url = pic.image_url || ""
          let raw_image_url = pic.raw_image_url || ""

          if (pic.cover instanceof File) {
            // upload raw
            raw_image_url = await uploadFile(
              pic.cover,
              `picture/original-${Date.now()}-${idx}-${pic.cover.name}`,
            )
            // compress + upload
            const comp = await compressImage(pic.cover)
            image_url = await uploadFile(
              comp,
              `picture/compressed-${Date.now()}-${idx}-${comp.name}`,
            )
            // update UI compressed size (non-blocking)
            const compressedSize = comp.size
            setPictures((current) =>
              current.map((p, i) => (i === idx ? { ...p, compressedSize } : p)),
            )
          }

          return {
            id: pic.id,
            title: pic.title,
            subtitle: pic.subtitle,
            description: pic.description,
            season_id: (pic as any).season_id ?? null,
            location_name: (pic as any).location_name || undefined,
            location_latitude: (pic as any).location_latitude ?? null,
            location_longitude: (pic as any).location_longitude ?? null,
            tags: pic.tags,
            en: pic.en,
            zh: pic.zh,
            image_url,
            raw_image_url,
          }
        }),
      )

      // Derive position from selected sections
      const selectedSectionNames = availableSections
        .filter(s => sectionIds.includes(s.id))
        .map(s => (s.name || '').toLowerCase().trim())
      const hasDown = selectedSectionNames.some(n => /\bdown\b|bottom|下|底/.test(n))
      const hasUp = selectedSectionNames.some(n => /\bup\b|top|上|顶/.test(n))
      const derivedPosition = hasDown ? 'down' : (hasUp ? 'up' : 'up')

      const payload: PictureSetSubmitData = {
        title,
        subtitle,
        description,
        position: derivedPosition,
        cover_image_url: coverKey,
        pictures: processedPictures,
        is_published: isPublished,
        primary_category_id: categoryIds.length ? categoryIds[0] : null,
        season_id: seasonIds.length ? seasonIds[0] : null,
        category_ids: categoryIds,
        season_ids: seasonIds,
        section_ids: sectionIds,
        primary_location_name: primaryLocationName || undefined,
        primary_location_latitude: typeof primaryLocationLat === 'number' ? primaryLocationLat : null,
        primary_location_longitude: typeof primaryLocationLng === 'number' ? primaryLocationLng : null,
        en,
        zh,
        tags: tagsText
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
        apply_set_props_to_pictures: applySetPropsToPictures,
        override_existing_picture_props: overrideExistingPictureProps,
        propagate_categories_to_pictures: propagateCategoriesToPictures,
        fill_missing_from_set: fillMissingFromSet,
        autogen_titles_subtitles: autogenTitlesSubtitles,
      }

      await onSubmit(payload, editingId)
      
      // 表单重置逻辑由父组件通过 editingPictureSet 的变化来触发
    } catch (error) {
      console.error("Error submitting form:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatSize = (b: number) =>
    b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(2) + " KB" : (b / 1048576).toFixed(2) + " MB"

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 relative">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">{isEditMode ? "Edit Picture Set" : "Create New Picture Set"}</h2>
        {isEditMode && onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel Edit
          </Button>
        )}
      </div>

      {/* 三列布局：基础字段 | 封面 | 其他属性 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 第一列：基础字段 */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="title">Title</Label>
              {coverPreview && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => generateField('title')}
                  disabled={isGenerating.title}
                  title="AI生成标题"
                >
                  {isGenerating.title ? <Sparkles className="h-3 w-3 animate-spin" /> : "✨"}
                </Button>
              )}
            </div>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="subtitle">Subtitle</Label>
              {coverPreview && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => generateField('subtitle')}
                  disabled={isGenerating.subtitle}
                  title="AI生成副标题"
                >
                  {isGenerating.subtitle ? <Sparkles className="h-3 w-3 animate-spin" /> : "✨"}
                </Button>
              )}
            </div>
            <Input id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="description">Description</Label>
              {coverPreview && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => generateField('description')}
                  disabled={isGenerating.description}
                  title="AI生成描述"
                >
                  {isGenerating.description ? <Sparkles className="h-3 w-3 animate-spin" /> : "✨"}
                </Button>
              )}
            </div>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          
          {/* 翻译区域（嵌入在第一列） */}
          <div className="grid grid-cols-2 gap-4 border border-gray-200 rounded-lg p-3">
            <div className="col-span-2 flex items-center justify-between">
              <h3 className="text-base font-bold">翻译 Translations</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">English (en)</Label>
              </div>
              <Input placeholder="English title" value={en.title}
                     onChange={(e) => setEn((prev) => ({ ...prev, title: e.target.value }))} />
              <Input placeholder="English subtitle" value={en.subtitle}
                     onChange={(e) => setEn((prev) => ({ ...prev, subtitle: e.target.value }))} />
              <Textarea placeholder="English description" value={en.description}
                        onChange={(e) => setEn((prev) => ({ ...prev, description: e.target.value }))} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">中文 (zh)</Label>
              </div>
              <Input placeholder="中文标题" value={zh.title}
                     onChange={(e) => setZh((prev) => ({ ...prev, title: e.target.value }))} />
              <Input placeholder="中文副标题" value={zh.subtitle}
                     onChange={(e) => setZh((prev) => ({ ...prev, subtitle: e.target.value }))} />
              <Textarea placeholder="中文描述" value={zh.description}
                        onChange={(e) => setZh((prev) => ({ ...prev, description: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* 第二列：封面预览 */}
        <div className="space-y-2">
          <Label htmlFor="cover">Cover Image</Label>
          {coverPreview ? (
            <div className="mt-2 mb-4">
              <div 
                className="relative w-full overflow-hidden rounded-md border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors group"
                onClick={() => document.getElementById('cover-input')?.click()}
                title="点击更换封面图片"
              >
                <img
                  src={coverPreview || "/placeholder.svg"}
                  alt="Cover preview"
                  className="w-full max-h-80 object-contain group-hover:opacity-90 transition-opacity"
                  style={{
                    aspectRatio: 'auto'
                  }}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-90 px-3 py-1 rounded-md text-sm font-medium text-gray-700">
                    点击更换图片
                  </div>
                </div>
              </div>
              {coverOriginalSize > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  Original size: {formatSize(coverOriginalSize)} • Will be compressed to WebP at 90% quality
                </p>
              )}
            </div>
          ) : (
            <div 
              className="mt-2 mb-4 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors group"
              onClick={() => document.getElementById('cover-input')?.click()}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 group-hover:bg-blue-100 rounded-full flex items-center justify-center transition-colors">
                  <Camera className="h-6 w-6 text-gray-400 group-hover:text-blue-500" />
                </div>
                <div>
                  <p className="text-gray-600 font-medium">点击上传封面图片</p>
                  <p className="text-sm text-gray-400">支持 JPG、PNG、WebP 格式</p>
                </div>
              </div>
            </div>
          )}
          <input 
            id="cover-input"
            type="file" 
            accept="image/*" 
            onChange={handleCoverChange}
            className="hidden"
          />
          
          {/* Options moved under cover */}
          <div className="flex flex-col gap-2 pt-3 border-t">
            <h4 className="text-base font-bold">选项 Options</h4>
            <label className="flex items-center gap-2 text-sm">
              <input id="fill_missing_from_set" type="checkbox" checked={fillMissingFromSet} onChange={(e)=>setFillMissingFromSet(e.target.checked)} />
              <span>自动填充图片属性（从集合继承）</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input id="autogen_titles_subtitles" type="checkbox" checked={autogenTitlesSubtitles} onChange={(e)=>setAutogenTitlesSubtitles(e.target.checked)} />
              <span>自动生成图片标题和副标题</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input id="apply_set_props_to_pictures" type="checkbox" checked={applySetPropsToPictures} onChange={(e)=>setApplySetPropsToPictures(e.target.checked)} />
              <span>应用集合属性到图片</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input id="override_existing_picture_props" type="checkbox" checked={overrideExistingPictureProps} onChange={(e)=>setOverrideExistingPictureProps(e.target.checked)} />
              <span>覆盖现有图片属性</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input id="propagate_categories_to_pictures" type="checkbox" checked={propagateCategoriesToPictures} onChange={(e)=>setPropagateCategoriesToPictures(e.target.checked)} />
              <span>传播分类到图片</span>
            </label>
          </div>
          
          {/* AI分析功能区域 - 折叠式设计 */}
          {coverPreview && (
            <div className="border border-gray-200 rounded-lg mt-3">
              <Button
                type="button"
                variant="ghost"
                className="w-full p-3 flex items-center justify-between text-left"
                onClick={() => setShowAIAnalysis(!showAIAnalysis)}
              >
                <div className="flex items-center gap-2">
                  <span>🤖</span>
                  <span className="font-medium">AI 智能分析</span>
                </div>
                <span className={`transform transition-transform ${showAIAnalysis ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </Button>
              
              {showAIAnalysis && (
                <div className="px-3 pb-3 border-t border-gray-100">
                  <ImageAnalysisComponent
                    imageUrl={coverPreview}
                    onResultUpdate={(field, result) => {
                      if (field === 'title') setTitle(result)
                      if (field === 'subtitle') setSubtitle(result)
                      if (field === 'description') setDescription(result)
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 第三列：其他属性 */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold">属性设置</h3>
          </div>

          {/* Publish toggle */}
          <div className="flex items-center gap-3 border rounded-md px-3 py-2">
            <input id="is_published" type="checkbox" checked={isPublished} onChange={(e)=>setIsPublished(e.target.checked)} />
            <Label htmlFor="is_published">Published 发布</Label>
          </div>

          {/* Categories */}
          <div className="border-t pt-3">
            <h4 className="text-base font-bold">Categories 分类</h4>
            <p className="text-xs text-gray-500 mt-1">可多选。例如：Portrait, Landscape, Street, Creative 等</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {availableCategories.map(c => {
                const checked = categoryIds.includes(c.id)
                return (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e)=>{
                        setCategoryIds(prev => e.target.checked ? Array.from(new Set([...prev, c.id])) : prev.filter(id=>id!==c.id))
                      }}
                    />
                    <span>{c.name}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Seasons */}
          <div className="border-t pt-3">
            <h4 className="text-base font-bold">Seasons 季节</h4>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {availableSeasons.map(s => {
                const checked = seasonIds.includes(s.id)
                return (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e)=>{
                        setSeasonIds(prev => e.target.checked ? Array.from(new Set([...prev, s.id])) : prev.filter(id=>id!==s.id))
                      }}
                    />
                    <span>{s.name}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Sections */}
          <div className="border-t pt-3">
            <h4 className="text-base font-bold">Sections 展示区块</h4>
            <p className="text-xs text-gray-500 mt-1">选择在哪些页面区块显示此集合</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {availableSections.map(s => {
                const checked = sectionIds.includes(s.id)
                return (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e)=>{
                        setSectionIds(prev => e.target.checked ? Array.from(new Set([...prev, s.id])) : prev.filter(id=>id!==s.id))
                      }}
                    />
                    <span>{s.name}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Primary location inputs */}
          <div className="grid grid-cols-1 gap-2 border-t pt-3">
            <h4 className="text-base font-bold">Primary Location 主要地点</h4>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async ()=>{
                  if (!primaryLocationName.trim()) return
                  try {
                    const res = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: primaryLocationName, limit: 1 }) })
                    const data = await res.json()
                    const g = data?.results?.[0]
                    if (g) {
                      setPrimaryLocationLat(g.lat)
                      setPrimaryLocationLng(g.lon)
                    }
                  } catch (e) { console.warn('Geocode failed', e) }
                }}
              >地理编码 Geocode</Button>
            </div>
            <Input placeholder="地点名称 (e.g., 外滩, 上海)" value={primaryLocationName} onChange={(e)=>setPrimaryLocationName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="纬度 Latitude" value={primaryLocationLat} onChange={(e)=>setPrimaryLocationLat(e.target.value ? Number(e.target.value) : "")} />
              <Input placeholder="经度 Longitude" value={primaryLocationLng} onChange={(e)=>setPrimaryLocationLng(e.target.value ? Number(e.target.value) : "")} />
            </div>
          </div>

          {/* Set tags */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold">标签 Tags</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateTagsForSet}
                disabled={isGenerating.tags || (!coverPreview && pictures.length === 0)}
                title={coverPreview || pictures.length > 0 ? 'AI 生成标签' : '请先添加封面或图片'}
                className="h-8 px-2"
              >
                {isGenerating.tags ? (
                  <span className="text-xs text-gray-500">生成中…</span>
                ) : (
                  <span className="text-xs flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI 生成</span>
                )}
              </Button>
            </div>
            <Input
              placeholder="用逗号分隔，例如：portrait, street, night"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 多张图片列表 */}
      <div className="space-y-6" ref={picturesContainerRef}>
        {/* 简化的标题 */}
        {pictures.length > 0 && (
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <Label className="text-lg font-semibold text-gray-800">图片集合</Label>
            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-sm font-medium">
              {pictures.length} 张图片
            </span>
          </div>
        )}

        {pictures.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <Plus className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-gray-500">还没有添加图片</p>
              <p className="text-sm text-gray-400">点击下方按钮开始添加图片到集合中</p>
            </div>
          </div>
        )}

        {pictures.map((pic, idx) => (
          <div 
            key={(pic as any).id ?? (pic as any).tempId ?? idx} 
            className="relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
          >
            {/* 图片序号标识 */}
            <div className="absolute top-4 left-4 z-10">
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md">
                <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {idx + 1}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {pic.id ? `已保存 #${pic.id}` : "新图片"}
                </span>
              </div>
            </div>

            {/* 删除按钮 */}
            <div className="absolute top-4 right-4 z-10">
              <Button 
                type="button" 
                variant="destructive" 
                size="sm" 
                onClick={() => handleRemovePicture(idx)}
                className="rounded-full w-8 h-8 p-0 shadow-md hover:shadow-lg"
              >
                ×
              </Button>
            </div>

            <div className="p-4 pt-14">
              <div className="grid grid-cols-2 gap-6">
                {/* 左侧：表单字段 */}
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-semibold text-gray-700">标题</Label>
                      {pic.previewUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-blue-100"
                          onClick={() => generatePictureField(idx, 'title')}
                          disabled={isGenerating.title}
                          title="AI生成标题"
                        >
                          {isGenerating.title ? <Sparkles className="h-3 w-3 animate-spin text-blue-500" /> : "✨"}
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="为这张图片输入标题..."
                      value={pic.title}
                      onChange={(e) => handlePictureChange(idx, "title", e.target.value)}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-semibold text-gray-700">副标题</Label>
                      {pic.previewUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-green-100"
                          onClick={() => generatePictureField(idx, 'subtitle')}
                          disabled={isGenerating.subtitle}
                          title="AI生成副标题"
                        >
                          {isGenerating.subtitle ? <Sparkles className="h-3 w-3 animate-spin text-green-500" /> : "✨"}
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="为这张图片输入副标题..."
                      value={pic.subtitle}
                      onChange={(e) => handlePictureChange(idx, "subtitle", e.target.value)}
                      className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-semibold text-gray-700">描述</Label>
                      {pic.previewUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-purple-100"
                          onClick={() => generatePictureField(idx, 'description')}
                          disabled={isGenerating.description}
                          title="AI生成描述"
                        >
                          {isGenerating.description ? <Sparkles className="h-3 w-3 animate-spin text-purple-500" /> : "✨"}
                        </Button>
                      )}
                    </div>
                    <Textarea
                      placeholder="描述这张图片的内容和特点..."
                      value={pic.description}
                      onChange={(e) => handlePictureChange(idx, "description", e.target.value)}
                      className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 min-h-[80px]"
                    />
                  </div>

                  {/* 图片标签 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-gray-700">标签（逗号分隔）</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => generatePictureTags(idx)}
                        disabled={isGenerating.tags || !pic.previewUrl}
                        className="h-7 px-2"
                        title={pic.previewUrl ? 'AI 生成图片标签' : '请先选择图片'}
                      >
                        {isGenerating.tags ? <span className="text-xs text-gray-500">生成中…</span> : <span className="text-xs flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI 生成</span>}
                      </Button>
                    </div>
                    <Input
                      placeholder="如 portrait, night, bokeh"
                      value={(pic.tags || []).join(', ')}
                      onChange={(e) => handlePictureChange(idx, 'tags', e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean))}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  {/* 每张图片的季节与位置 */}
                  <div className="grid grid-cols-1 gap-3 pt-2 border-t">
                    <div>
                      <Label className="text-sm font-semibold text-gray-700">季节</Label>
                      <Select
                        value={pic.season_id != null ? String(pic.season_id) : undefined}
                        onValueChange={(v)=>handlePictureChange(idx, 'season_id', v ? Number(v) : null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择季节" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSeasons.map(s => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-semibold text-gray-700">地点</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={async ()=>{
                            const nm = (pic as any).location_name as string | undefined
                            if (!nm || !nm.trim()) return
                            try {
                              const res = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: nm, limit: 1 }) })
                              const data = await res.json()
                              const g = data?.results?.[0]
                              if (g) {
                                handlePictureChange(idx, 'location_latitude', g.lat)
                                handlePictureChange(idx, 'location_longitude', g.lon)
                              }
                            } catch (e) { console.warn('Geocode failed', e) }
                          }}
                        >地名转坐标</Button>
                      </div>
                      <Input placeholder="地点名称（如：外滩）" value={(pic as any).location_name || ''} onChange={(e)=>handlePictureChange(idx, 'location_name', e.target.value)} />
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Latitude" value={(pic as any).location_latitude ?? ''} onChange={(e)=>handlePictureChange(idx, 'location_latitude', e.target.value ? Number(e.target.value) : null)} />
                        <Input placeholder="Longitude" value={(pic as any).location_longitude ?? ''} onChange={(e)=>handlePictureChange(idx, 'location_longitude', e.target.value ? Number(e.target.value) : null)} />
                      </div>
                    </div>
                  </div>

                  {/* 图片翻译字段 */}
                  {/* 图片翻译字段（默认收起，提升紧凑性） */}
                  <div className="mt-4 border border-gray-200 rounded-md">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full p-2 flex items-center justify-between text-left"
                      onClick={() => setShowPictureTranslations(prev => ({ ...prev, [idx]: !prev[idx] }))}
                    >
                      <span className="text-sm font-medium">翻译字段</span>
                      <span className={`transform transition-transform ${showPictureTranslations[idx] ? 'rotate-180' : ''}`}>▼</span>
                    </Button>
                    {showPictureTranslations[idx] && (
                      <div className="grid grid-cols-2 gap-4 px-3 pb-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-gray-700">English (en)</Label>
                          <Input
                            placeholder="English title"
                            value={pic.en?.title || ''}
                            onChange={(e) => handlePictureChange(idx, 'en.title', e.target.value)}
                            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                          <Input
                            placeholder="English subtitle"
                            value={pic.en?.subtitle || ''}
                            onChange={(e) => handlePictureChange(idx, 'en.subtitle', e.target.value)}
                            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                          <Textarea
                            placeholder="English description"
                            value={pic.en?.description || ''}
                            onChange={(e) => handlePictureChange(idx, 'en.description', e.target.value)}
                            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[60px]"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-gray-700">中文 (zh)</Label>
                          <Input
                            placeholder="中文标题"
                            value={pic.zh?.title || ''}
                            onChange={(e) => handlePictureChange(idx, 'zh.title', e.target.value)}
                            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                          <Input
                            placeholder="中文副标题"
                            value={pic.zh?.subtitle || ''}
                            onChange={(e) => handlePictureChange(idx, 'zh.subtitle', e.target.value)}
                            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                          <Textarea
                            placeholder="中文描述"
                            value={pic.zh?.description || ''}
                            onChange={(e) => handlePictureChange(idx, 'zh.description', e.target.value)}
                            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[60px]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 右侧：图片预览 */}
                <div className="space-y-4">
                  {pic.previewUrl ? (
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-gray-700">图片预览</Label>
                      <div className="relative bg-gray-50 rounded-lg p-3">
                        <div 
                          className="relative w-full overflow-hidden rounded-md border border-gray-200 bg-white cursor-pointer hover:border-blue-400 transition-colors group"
                          onClick={() => document.getElementById(`picture-input-${idx}`)?.click()}
                          title="点击更换图片"
                        >
                          <img
                            src={pic.previewUrl || "/placeholder.svg"}
                            alt={`Picture ${idx + 1}`}
                            className="w-full max-h-80 object-contain group-hover:opacity-90 transition-opacity"
                            style={{
                              aspectRatio: 'auto'
                            }}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-90 px-3 py-1 rounded-md text-sm font-medium text-gray-700">
                              点击更换图片
                            </div>
                          </div>
                        </div>
                        {pic.originalSize! > 0 && (
                          <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">原始大小:</span> {formatSize(pic.originalSize!)}
                              {pic.compressedSize && (
                                <>
                                  <br />
                                  <span className="font-medium">压缩后:</span> {formatSize(pic.compressedSize)} 
                                  <span className="text-green-600 font-medium">
                                    ({((pic.compressedSize / pic.originalSize!) * 100).toFixed(1)}%)
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48">
                      <div 
                        className="flex flex-col items-center justify-center h-full w-full border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                        onClick={() => document.getElementById(`picture-input-${idx}`)?.click()}
                      >
                        <div className="w-12 h-12 bg-gray-200 group-hover:bg-blue-100 rounded-full flex items-center justify-center mb-3 transition-colors">
                          <Camera className="h-6 w-6 text-gray-400 group-hover:text-blue-500" />
                        </div>
                        <p className="text-gray-500 text-sm font-medium">点击上传图片</p>
                        <p className="text-gray-400 text-xs mt-1">支持 JPG、PNG、WebP 格式</p>
                      </div>
                    </div>
                  )}
                  
                  {/* 隐藏的文件输入 */}
                  <input
                    id={`picture-input-${idx}`}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePictureChange(idx, "cover", e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </div>
              </div>

              {/* AI 分析组件 - 折叠式设计 */}
              {pic.previewUrl && (
                <div className="mt-4 border border-gray-200 rounded-lg">
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full p-3 flex items-center justify-between text-left"
                    onClick={() => setShowPictureAIAnalysis(prev => ({
                      ...prev,
                      [idx]: !prev[idx]
                    }))}
                  >
                    <div className="flex items-center gap-2">
                      <span>🤖</span>
                      <span className="font-medium">AI 分析 - Picture {idx + 1}</span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        智能生成
                      </span>
                    </div>
                    <span className={`transform transition-transform ${showPictureAIAnalysis[idx] ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </Button>
                  
                  {showPictureAIAnalysis[idx] && (
                    <div className="px-3 pb-3 border-t border-gray-100">
                      <ImageAnalysisComponent
                        imageUrl={pic.previewUrl}
                        onResultUpdate={(field, result) => {
                          handlePictureChange(idx, field, result)
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 添加图片按钮 - 支持单个与批量 */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-6">
        <Button 
          type="button" 
          onClick={handleAddPicture} 
          variant="outline"
          className="flex items-center gap-2 px-6 py-3 border-2 border-dashed border-purple-300 text-purple-600 hover:border-purple-400 hover:bg-purple-50 transition-all duration-200"
        >
          <Plus className="h-5 w-5" /> 
          添加新图片
        </Button>
        <Button
          type="button"
          onClick={() => bulkInputRef.current?.click()}
          variant="outline"
          className="flex items-center gap-2 px-6 py-3 border-2 border-dashed border-blue-300 text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
        >
          <Plus className="h-5 w-5" />
          批量添加图片
        </Button>
        <input
          ref={bulkInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files || [])
            if (files.length === 0) return

            // For each file, create a picture entry with preview
            const toAdd: PictureFormData[] = []
            for (const f of files) {
              try {
                const { url, size } = await getImagePreview(f)
              toAdd.push({
                tempId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
                title: "",
                subtitle: "",
                description: "",
                season_id: null,
                location_name: '',
                location_latitude: null,
                location_longitude: null,
                cover: f,
                previewUrl: url,
                originalSize: size,
                compressedSize: undefined,
                image_url: "",
                })
              } catch (err) {
                console.error("预览生成失败:", err)
              }
            }
            if (toAdd.length > 0) setPictures((prev) => [...prev, ...toAdd])
            // reset input value to allow re-selecting the same files
            if (e.target) e.target.value = ""
          }}
        />
      </div>

      {/* Submit button */}
      {/* Reorder thumbnails */}
      {pictures.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium">图片顺序调整</h3>
            <span className="text-xs text-gray-500">拖拽缩略图以改变顺序</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {pictures.map((pic, idx) => (
              <div
                key={(pic as any).id ?? (pic as any).tempId ?? idx}
                draggable
                onDragStart={() => handleDragStartThumb(idx)}
                onDragEnter={() => handleDragEnterThumb(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={handleDragEndThumb}
                className={`relative select-none rounded-md overflow-hidden border bg-white transition-shadow ${draggingIndex === idx ? 'ring-2 ring-blue-400 shadow-lg' : 'hover:shadow'} `}
                title={(pic.title || '').trim() || `图片 ${idx + 1}`}
              >
                <div className="absolute top-1 left-1 z-10">
                  <div className="px-2 py-0.5 text-[11px] rounded-full bg-black/70 text-white">#{idx + 1}</div>
                </div>
                {pic.previewUrl || pic.image_url ? (
                  <img
                    src={pic.previewUrl || `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${pic.image_url}`}
                    alt={`thumb-${idx + 1}`}
                    className="w-full h-24 object-cover"
                  />
                ) : (
                  <div className="w-full h-24 bg-gray-100 flex items-center justify-center text-xs text-gray-400">无预览</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 bg-white py-4 border-t z-10 space-y-2">
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Submitting..." : isEditMode ? "Update Picture Set" : "Submit Picture Set"}
        </Button>
      </div>

      {/* Scroll to top button */}
      {showScrollToTop && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="fixed bottom-8 left-8 z-20 rounded-full shadow-lg"
          onClick={scrollToTop}
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </form>
  )
}
