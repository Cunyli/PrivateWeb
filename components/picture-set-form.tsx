// components/picture-set-form.tsx
"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, ArrowUp, Sparkles, Camera } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import imageCompression from "browser-image-compression"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ImageAnalysisComponent } from "@/components/image-analysis"
import { useImageAnalysis } from "@/hooks/use-image-analysis"
import { supabase } from "@/utils/supabase"
import { LocationPreviewMap } from "@/components/location-preview-map"

import type { PictureSet } from "@/lib/pictureSet.types"
import type { PictureFormData, PictureSetSubmitData } from "@/lib/form-types"

interface PictureSetFormProps {
  onSubmit: (pictureSet: PictureSetSubmitData, pictureSetId?: number) => void
  editingPictureSet?: PictureSet | null
  onCancel?: () => void
}

const COMPRESSION_THRESHOLD_BYTES = 10 * 1024 * 1024

type CompressionResult = {
  file: File
  didCompress: boolean
}

// 压缩图片的函数（大于 10MB 才压缩，并根据原始大小动态调整参数）
async function compressImage(file: File, quality?: number): Promise<CompressionResult> {
  if (file.size <= COMPRESSION_THRESHOLD_BYTES) {
    return { file, didCompress: false }
  }

  try {
    const sizeInMB = file.size / (1024 * 1024)
    const dynamicQuality =
      typeof quality === "number"
        ? quality
        : sizeInMB > 30
          ? 0.72
          : sizeInMB > 20
            ? 0.78
            : sizeInMB > 12
              ? 0.82
              : 0.86
    const options = {
      maxWidthOrHeight: sizeInMB > 30 ? 2048 : sizeInMB > 20 ? 2304 : 2560,
      useWebWorker: true,
      initialQuality: dynamicQuality,
      maxSizeMB: Math.max(4, sizeInMB * 0.55),
      fileType: "image/webp" as const,
    }

    const compressedFile = await imageCompression(file, options)
    const webpFile = new File(
      [compressedFile],
      file.name.replace(/\.[^/.]+$/, ".webp"),
      { type: "image/webp" },
    )

    if (webpFile.size >= file.size) {
      // 压缩结果反而更大，直接返回原图
      return { file, didCompress: false }
    }

    return { file: webpFile, didCompress: true }
  } catch (error) {
    console.error(`压缩图片 ${file.name} 失败，使用原图:`, error)
    // 压缩失败时返回原图
    return { file, didCompress: false }
  }
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
  const { t } = useI18n()
  const { analyzeImage } = useImageAnalysis()
  const looksZh = (s?: string) => /[\u4e00-\u9fff]/.test(String(s || ''))
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
  const [autoFillLocalesAll, setAutoFillLocalesAll] = useState<boolean>(true)
  const [isBulkTagsGenerating, setIsBulkTagsGenerating] = useState<boolean>(false)
  const [autoGenerateTagsForUntagged, setAutoGenerateTagsForUntagged] = useState<boolean>(true)
  const [showAITrans, setShowAITrans] = useState<boolean>(false)
  // simplified flags per your request
  const [fillMissingFromSet, setFillMissingFromSet] = useState<boolean>(true)
  const [autogenTitlesSubtitles, setAutogenTitlesSubtitles] = useState<boolean>(true)
  const [showPictureTagsEditor, setShowPictureTagsEditor] = useState<{[key:number]: boolean}>({})
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingId, setEditingId] = useState<number | undefined>(undefined)
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const [isGenerating, setIsGenerating] = useState({
    title: false,
    subtitle: false,
    description: false,
    tags: false,
  })
  const [isTranslatingAll, setIsTranslatingAll] = useState(false)
  const [isTranslatingPic, setIsTranslatingPic] = useState<{[idx:number]: boolean}>({})
  // translations
  const [en, setEn] = useState<{title: string; subtitle: string; description: string}>({ title: "", subtitle: "", description: "" })
  const [zh, setZh] = useState<{title: string; subtitle: string; description: string}>({ title: "", subtitle: "", description: "" })
  
  // simple comma-separated tags input
  const [tagsText, setTagsText] = useState<string>("")
  const [showAIAnalysis, setShowAIAnalysis] = useState(false)
  const [showPictureAIAnalysis, setShowPictureAIAnalysis] = useState<{[key: number]: boolean}>({})
  const [showPictureTranslations, setShowPictureTranslations] = useState<{[key: number]: boolean}>({})
  // 进入编辑页后，对集合执行一次“仅补齐集合的语种”
  const autoTranslatedSetOnceId = useRef<number | null>(null)
  const autoTranslateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHydratingFromEdit = useRef(false)
  const hasSyncedBaseOnce = useRef<{ title: boolean; subtitle: boolean; description: boolean }>({
    title: false,
    subtitle: false,
    description: false,
  })
  // translation autofill touching flags
  const [enTouched, setEnTouched] = useState<{title:boolean; subtitle:boolean; description:boolean}>({ title: false, subtitle: false, description: false })
  const [picEnTouched, setPicEnTouched] = useState<{[idx:number]: { title?: boolean; subtitle?: boolean; description?: boolean }}>({})
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
        const val = result.result || ''
        const looksZh = /[\u4e00-\u9fff]/
        // 更新基础字段
        if (field === 'title') setTitle(val)
        if (field === 'subtitle') setSubtitle(val)
        if (field === 'description') setDescription(val)
        // 同步到翻译区：AI 生成视为“可覆盖自动值”，忽略 touched 限制
        const isZh = looksZh.test(val)
        if (isZh) {
          setZh(prev => ({ ...prev, [field]: val }))
          // 不强行覆盖用户手动输入过的英文，但若当前英文为空则清空保持一致
          setEn(prev => ({ ...prev, [field]: prev[field] ? prev[field] : '' }))
        } else {
          setEn(prev => ({ ...prev, [field]: val }))
          if (val.trim()) {
            setEnTouched(prev => ({ ...prev, [field]: true }))
          }
          setZh(prev => ({ ...prev, [field]: '' }))
        }
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
        // 先取消该字段的 touched，允许 AI 结果覆盖自动值
        setPicEnTouched(prev => ({
          ...prev,
          [pictureIndex]: { ...(prev[pictureIndex] || {}), [field]: false },
        }))
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
    const src = picture.previewUrl || (picture.image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${picture.image_url}` : '')
    if (!src) return
    setIsGenerating(prev => ({ ...prev, tags: true }))
    try {
      const result = await analyzeImage(src, 'tags')
      if (result.success) {
        // Parse bilingual tags in format: "english-tag (中文标签), ..."
        const parts = result.result
          .replace(/\n/g, ',')
          .split(/[,，;；]/)
          .map(s => s.trim())
          .filter(Boolean)
        const generated = Array.from(new Set(parts))
        const current = Array.isArray(picture.tags) ? picture.tags.filter(Boolean) : []
        const union = Array.from(new Set([ ...current, ...generated ]))
        handlePictureChange(pictureIndex, 'tags', union)
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
        // Parse bilingual tags in format: "english-tag (中文标签), ..."
        const parts = result.result
          .replace(/\n/g, ',')
          .split(/[,，;；]/)
          .map(s => s.trim())
          .filter(Boolean)
        const uniq = Array.from(new Set(parts));
        setTagsText(uniq.join(', '))
      }
    } catch (e) {
      console.error('生成标签失败', e)
    } finally {
      setIsGenerating(prev => ({ ...prev, tags: false }))
    }
  }

  // Track the last loaded editing ID to prevent re-initialization
  const lastLoadedIdRef = useRef<number | null>(null)

  // 编辑模式初始化
  useEffect(() => {
    // preload vocab tables
    const loadVocab = async () => {
      try {
        const preferred = (typeof window !== 'undefined' ? (localStorage.getItem('locale') || 'en') : 'en')
        const res = await fetch(`/api/admin/vocab?locale=${encodeURIComponent(preferred)}`)
        const data = await res.json()
        if (res.ok) {
          setAvailableCategories((data?.categories || []).map((c:any)=>({ id: c.id, name: (preferred === 'zh' ? (c.nameCN || c.name) : c.name) })))
          setAvailableSeasons((data?.seasons || []).map((s:any)=>({ id: s.id, name: (preferred === 'zh' ? (s.nameCN || s.name) : s.name) })))
          setAvailableSections((data?.sections || []).map((s:any)=>({ id: s.id, name: (preferred === 'zh' ? (s.nameCN || s.name) : s.name) })))
        }
      } catch (e) {
        console.warn('Load vocab failed', e)
      }
    }
    loadVocab()

    if (editingPictureSet) {
      // Only hydrate if this is a new picture set ID
      if (lastLoadedIdRef.current === editingPictureSet.id) {
        return
      }
      
      lastLoadedIdRef.current = editingPictureSet.id
      isHydratingFromEdit.current = true
      // In edit mode, mark as already synced to prevent useEffect from overwriting loaded translations
      hasSyncedBaseOnce.current = { title: true, subtitle: true, description: true }
      setIsEditMode(true)
      setEditingId(editingPictureSet.id)
      setTitle(editingPictureSet.title || "")
      setSubtitle(editingPictureSet.subtitle || "")
      setDescription(editingPictureSet.description || "")
      setCoverImageUrl(editingPictureSet.cover_image_url || "")
      setCoverPreview(editingPictureSet.cover_image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL}${editingPictureSet.cover_image_url}` : null)
      setPosition(editingPictureSet.position || "up")
      // translations and tags (optional on type)
      // Prefill en from DB; if missing, fall back to base fields
      const enData = {
        title: editingPictureSet.en?.title || editingPictureSet.title || "",
        subtitle: editingPictureSet.en?.subtitle || editingPictureSet.subtitle || "",
        description: editingPictureSet.en?.description || editingPictureSet.description || "",
      }
      const zhData = {
        title: editingPictureSet.zh?.title || (looksZh(editingPictureSet.title) ? (editingPictureSet.title || "") : ""),
        subtitle: editingPictureSet.zh?.subtitle || (looksZh(editingPictureSet.subtitle) ? (editingPictureSet.subtitle || "") : ""),
        description: editingPictureSet.zh?.description || (looksZh(editingPictureSet.description) ? (editingPictureSet.description || "") : ""),
      }
      const touchedData = {
        title: !!(editingPictureSet.en?.title && editingPictureSet.en.title.trim()),
        subtitle: !!(editingPictureSet.en?.subtitle && editingPictureSet.en.subtitle.trim()),
        description: !!(editingPictureSet.en?.description && editingPictureSet.en.description.trim()),
      }
      setEn(enData)
      // Mark touched for en fields only if DB provided a non-empty translation
      setEnTouched(touchedData)
      setZh(zhData)
      setTagsText((editingPictureSet.tags || []).join(", "))
      setIsPublished(editingPictureSet.is_published ?? true)
      // 预填分类与季节：直接用后端返回字段，避免客户端读取 RLS 表
      if (Array.isArray((editingPictureSet as any).category_ids) && (editingPictureSet as any).category_ids.length) {
        setCategoryIds([...(editingPictureSet as any).category_ids])
      } else if (editingPictureSet.primary_category_id) {
        setCategoryIds([editingPictureSet.primary_category_id])
      }
      if (editingPictureSet.season_id) setSeasonIds([editingPictureSet.season_id])
      // 预填 sections（由后端详情提供）
      if (Array.isArray((editingPictureSet as any).section_ids)) {
        setSectionIds([...(editingPictureSet as any).section_ids])
      }
      // 预填主位置（由后端详情提供）
      if ((editingPictureSet as any).primary_location_name) setPrimaryLocationName((editingPictureSet as any).primary_location_name)
      if ((editingPictureSet as any).primary_location_latitude != null) setPrimaryLocationLat((editingPictureSet as any).primary_location_latitude)
      if ((editingPictureSet as any).primary_location_longitude != null) setPrimaryLocationLng((editingPictureSet as any).primary_location_longitude)

      if (editingPictureSet.pictures) {
        const initialTouched: {[idx:number]: { title?: boolean; subtitle?: boolean; description?: boolean }} = {}
        const mapped = editingPictureSet.pictures.map((pic, idx) => ({
            id: pic.id,
            title: pic.title || "",
            subtitle: pic.subtitle || "",
            description: pic.description || "",
            style: (pic as any).style ?? null,
            season_id: (pic as any).season_id ?? null,
            location_name: (pic as any).location_name || '',
            location_latitude: (pic as any).location_latitude ?? null,
            location_longitude: (pic as any).location_longitude ?? null,
            picture_category_ids: (pic as any).picture_category_ids || [],
            tags: pic.tags || [],
            en: {
              title: pic.en?.title || pic.title || "",
              subtitle: pic.en?.subtitle || pic.subtitle || "",
              description: pic.en?.description || pic.description || "",
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
        // initialize touched map: mark true if DB provided non-empty en.*
        editingPictureSet.pictures.forEach((p, i) => {
          initialTouched[i] = {
            title: !!(p.en?.title && p.en.title.trim()),
            subtitle: !!(p.en?.subtitle && p.en.subtitle.trim()),
            description: !!(p.en?.description && p.en.description.trim()),
          }
        })
        setPictures(mapped)
        setPicEnTouched(initialTouched)
      }
      // 让自动同步 useEffect 在一轮渲染后才开始生效，避免初始化时清空翻译
      setTimeout(() => {
        isHydratingFromEdit.current = false
      }, 0)

      // 自动对集合翻译进行一次补齐（每个集合只执行一次）
      try {
        if (autoTranslatedSetOnceId.current !== editingPictureSet.id) {
          const needsAutoTranslate = (['title', 'subtitle', 'description'] as const).some((key) => {
            const enVal = String(editingPictureSet.en?.[key] || '').trim()
            const zhVal = String(editingPictureSet.zh?.[key] || '').trim()
            return !(enVal && zhVal)
          })
          autoTranslatedSetOnceId.current = editingPictureSet.id
          // DON'T run auto-translate in edit mode - data is already loaded from DB
          // The auto-translate function reads from stale closure values and will overwrite loaded data
          // if (needsAutoTranslate) {
          //   setTimeout(() => { autoTranslateSetOnly().catch(() => {}) }, 0)
          // }
        }
      } catch {}
    } else if (editingPictureSet === null && (isEditMode || editingId !== undefined)) {
      lastLoadedIdRef.current = null
      isHydratingFromEdit.current = false
      hasSyncedBaseOnce.current = { title: false, subtitle: false, description: false }
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
        
        // Auto-generate tags when cover is uploaded
        if (url) {
          setTimeout(async () => {
            setIsGenerating(prev => ({ ...prev, tags: true }))
            try {
              const result = await analyzeImage(url, 'tags')
              if (result.success) {
                const parts = result.result
                  .replace(/\n/g, ',')
                  .split(/[,，;；]/)
                  .map(s => s.trim())
                  .filter(Boolean)
                const uniq = Array.from(new Set(parts));
                setTagsText(uniq.join(', '))
              }
            } catch (e) {
              console.error('自动生成标签失败', e)
            } finally {
              setIsGenerating(prev => ({ ...prev, tags: false }))
            }
          }, 100)
        }
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
        picture_category_ids: [],
        style: null,
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

        // dynamic autofill to en/zh from base fields with clear rules
        if (field === 'title' || field === 'subtitle' || field === 'description') {
          const key = field as 'title' | 'subtitle' | 'description'
          const looksZh = /[\u4e00-\u9fff]/
          const touched = picEnTouched[index] || {}
          const currentEn = { ...(pic.en || {}) }
          const currentZh = { ...(pic.zh || {}) }

          // If cleared, also clear translations (respect en touched)
          if (!String(value || '').length) {
            if (!touched[key]) currentEn[key] = ''
            currentZh[key] = ''
            return { ...pic, [field]: '', en: currentEn, zh: currentZh }
          }

          const isZh = looksZh.test(String(value))
          if (isZh) {
            // Base is Chinese: copy to zh, clear en for this key if not touched to avoid stale pinyin/english
            currentZh[key] = String(value)
            if (!touched[key]) currentEn[key] = ''
            return { ...pic, [field]: value, en: currentEn, zh: currentZh }
          } else {
            // Base is non-Chinese: copy to en (if not touched), and clear zh to avoid leftover hanzi
            if (!touched[key]) currentEn[key] = String(value)
            currentZh[key] = ''
            return { ...pic, [field]: value, en: currentEn, zh: currentZh }
          }
        }

        return { ...pic, [field]: value }
      })
    )
  }

  // --- Translation helpers ---
  const translateText = async (text: string, source: 'zh'|'en'|'auto' = 'zh', target: 'zh'|'en' = 'en'): Promise<string> => {
    try {
      if (!text || !text.trim()) return ''
      const res = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLang: source, targetLang: target })
      })
      if (!res.ok) return ''
      const data = await res.json()
      return (data.translated as string) || ''
    } catch { return '' }
  }

  const autoTranslatePicture = async (idx: number) => {
    const pic = pictures[idx]
    if (!pic) return
    setIsTranslatingPic(prev => ({ ...prev, [idx]: true }))
    try {
      const toEn: any = { ...(pic.en || {}) }
      const toZh: any = { ...(pic.zh || {}) }
      const touched = picEnTouched[idx] || {}
      
      for (const key of ['title','subtitle','description'] as const) {
        const baseVal = String((pic as any)[key] || '')
        const enVal = String((toEn as any)[key] || '')
        const zhVal = String((toZh as any)[key] || '')
        const originalEn = String(pic.en?.[key] || '')
        const originalZh = String(pic.zh?.[key] || '')
        const baseIsChinese = looksZh(baseVal)
        
        // 如果该字段的英文已被手动编辑过，跳过自动翻译
        const isEnTouched = touched[key]
        
        if (!enVal && zhVal && !isEnTouched) {
          const t = await translateText(zhVal, 'auto', 'en')
          if (t) (toEn as any)[key] = t
        } else if (!zhVal && enVal) {
          const t = await translateText(enVal, 'auto', 'zh')
          if (t) (toZh as any)[key] = t
        } else if (!enVal && !zhVal && baseVal) {
          if (baseIsChinese) {
            (toZh as any)[key] = baseVal
            if (!isEnTouched) {
              const t = await translateText(baseVal, 'auto', 'en')
              if (t) (toEn as any)[key] = t
            }
          } else {
            if (!isEnTouched) (toEn as any)[key] = baseVal
            const t = await translateText(baseVal, 'auto', 'zh')
            if (t) (toZh as any)[key] = t
          }
        }
        // 最后保障：确保两侧都不为空
        const enNow = String((toEn as any)[key] || '')
        const zhNow = String((toZh as any)[key] || '')
        if (!enNow && zhNow && !isEnTouched) {
          const t = await translateText(zhNow, 'auto', 'en')
          if (t) (toEn as any)[key] = t
        }
        if (!zhNow && enNow) {
          const t = await translateText(enNow, 'auto', 'zh')
          if (t) (toZh as any)[key] = t
        }
        const enAfter = String((toEn as any)[key] || '')
        if (!enAfter && !isEnTouched) {
          const fallback = originalEn && !looksZh(originalEn) ? originalEn : !baseIsChinese ? baseVal : ''
          if (fallback && !looksZh(fallback)) (toEn as any)[key] = fallback
        }
        const zhAfter = String((toZh as any)[key] || '')
        if (!zhAfter) {
          const fallbackZh = originalZh && looksZh(originalZh) ? originalZh : baseIsChinese ? baseVal : ''
          if (fallbackZh && looksZh(fallbackZh)) (toZh as any)[key] = fallbackZh
        }
      }
      const updatedPicTouch: { title?: boolean; subtitle?: boolean; description?: boolean } = {}
      for (const key of ['title','subtitle','description'] as const) {
        const finalVal = String((toEn as any)[key] || '')
        if (finalVal && !looksZh(finalVal)) {
          updatedPicTouch[key] = true
        }
      }
      if (Object.keys(updatedPicTouch).length) {
        setPicEnTouched(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), ...updatedPicTouch } }))
      }
      setPictures(prev => prev.map((p, i) => i === idx ? { ...p, en: toEn, zh: toZh } : p))
      // 标记已生成的英文内容为 touched，防止后续基础字段的自动同步把它们清空
    } finally {
      setIsTranslatingPic(prev => ({ ...prev, [idx]: false }))
    }
  }

  const forceCompleteSetTranslations = async (
    baseVals: { title: string; subtitle: string; description: string },
    currentEn: { title: string; subtitle: string; description: string },
    currentZh: { title: string; subtitle: string; description: string },
  ) => {
    const nextEn = { ...currentEn }
    const nextZh = { ...currentZh }
    for (const key of ['title', 'subtitle', 'description'] as const) {
      const baseVal = String(baseVals[key] || '').trim()
      let enVal = String(nextEn[key] || '').trim()
      let zhVal = String(nextZh[key] || '').trim()
      if (!enVal && !zhVal && baseVal) {
        if (looksZh(baseVal)) {
          zhVal = baseVal
          enVal = await translateText(baseVal, 'auto', 'en')
        } else {
          enVal = baseVal
          zhVal = await translateText(baseVal, 'auto', 'zh')
        }
      }
      if (!enVal && zhVal) {
        enVal = await translateText(zhVal, 'auto', 'en')
      }
      if (!zhVal && enVal) {
        zhVal = await translateText(enVal, 'auto', 'zh')
      }
      nextEn[key] = enVal
      nextZh[key] = zhVal
    }
    return { en: nextEn, zh: nextZh }
  }

  const forceCompletePictureTranslations = async (pic: PictureFormData) => {
    const base = {
      title: String(pic.title || ''),
      subtitle: String(pic.subtitle || ''),
      description: String(pic.description || ''),
    }
    const currentEn = {
      title: String(pic.en?.title || ''),
      subtitle: String(pic.en?.subtitle || ''),
      description: String(pic.en?.description || ''),
    }
    const currentZh = {
      title: String(pic.zh?.title || ''),
      subtitle: String(pic.zh?.subtitle || ''),
      description: String(pic.zh?.description || ''),
    }
    const filled = await forceCompleteSetTranslations(base, currentEn, currentZh)
    return {
      ...pic,
      en: { ...pic.en, ...filled.en },
      zh: { ...pic.zh, ...filled.zh },
    }
  }

  const autoTranslateAll = async (forceTranslate = false): Promise<{ en: typeof en; zh: typeof zh; pictures: typeof pictures }> => {
    setIsTranslatingAll(true)
    console.log('🚀 autoTranslateAll called with forceTranslate:', forceTranslate)
    try {
      const nextEn = { ...en }
      const nextZh = { ...zh }
      const updatedSetTouches: Partial<typeof enTouched> = {}
      const nextPicTouches: { [idx: number]: { title?: boolean; subtitle?: boolean; description?: boolean } } = {}
      for (const key of ['title','subtitle','description'] as const) {
        const baseVal = String((key === 'title' ? title : key === 'subtitle' ? subtitle : description) || '')
        let enVal = String(nextEn[key] || '')
        let zhVal = String(nextZh[key] || '')
        const existingEn = String((en as any)[key] || '')
        const existingZh = String((zh as any)[key] || '')
        const baseIsChinese = looksZh(baseVal)
        
        console.log(`🔍 Processing ${key}:`, { baseVal, enVal, zhVal, existingEn, existingZh })
        
        // forceTranslate=true 表示用户勾选了"自动补全"，强制翻译所有内容
        const isEnTouched = forceTranslate ? false : enTouched[key]
        console.log(`   isEnTouched for ${key}:`, isEnTouched, '(forceTranslate:', forceTranslate, ')')

        if (!enVal && zhVal && !isEnTouched) {
          console.log(`   🌐 Translating ${key} from zh to en:`, zhVal)
          const t = await translateText(zhVal, 'auto', 'en')
          console.log(`   ✅ Translation result:`, t)
          if (t) enVal = t
        } else if (!zhVal && enVal) {
          const t = await translateText(enVal, 'auto', 'zh')
          if (t) zhVal = t
        } else if (!enVal && !zhVal && baseVal) {
          if (baseIsChinese) {
            zhVal = baseVal
            if (!isEnTouched) {
              const t = await translateText(baseVal, 'auto', 'en')
              if (t) enVal = t
            }
          } else {
            if (!isEnTouched) enVal = baseVal
            const t = await translateText(baseVal, 'auto', 'zh')
            if (t) zhVal = t
          }
        }
        // 最后保障：两侧都不为空
        if (!enVal && zhVal && !isEnTouched) {
          const t = await translateText(zhVal, 'auto', 'en')
          if (t) enVal = t
        }
        if (!zhVal && enVal) {
          const t = await translateText(enVal, 'auto', 'zh')
          if (t) zhVal = t
        }
        if (!enVal && !isEnTouched) {
          if (existingEn && !looksZh(existingEn)) enVal = existingEn
          else if (!baseIsChinese) enVal = baseVal
        }
        if (!zhVal) {
          if (existingZh) zhVal = existingZh
          else if (baseIsChinese) zhVal = baseVal
        }
        nextEn[key] = enVal
        nextZh[key] = zhVal
        if (enVal && !looksZh(enVal)) {
          updatedSetTouches[key] = true
        }
        console.log(`   📝 Final values for ${key}:`, { enVal, zhVal })
      }
      setEn(nextEn)
      setZh(nextZh)
      if (Object.keys(updatedSetTouches).length) {
        setEnTouched(prev => ({ ...prev, ...updatedSetTouches }))
      }
      console.log('✅ SET translation complete - nextEn:', nextEn, 'nextZh:', nextZh)

      // 翻译所有图片并收集结果
      const nextPictures = [...pictures]
      for (let i = 0; i < nextPictures.length; i++) {
        const pic = nextPictures[i]
        if (!pic) continue
        
        const toEn: any = { ...(pic.en || {}) }
        const toZh: any = { ...(pic.zh || {}) }
  const touched = picEnTouched[i] || {}
        
        for (const key of ['title','subtitle','description'] as const) {
          const baseVal = String((pic as any)[key] || '')
          const enVal = String((toEn as any)[key] || '')
          const zhVal = String((toZh as any)[key] || '')
          const originalEn = String(pic.en?.[key] || '')
          const originalZh = String(pic.zh?.[key] || '')
          const baseIsChinese = looksZh(baseVal)
          
          const isEnTouched = forceTranslate ? false : touched[key]
          
          if (!enVal && zhVal && !isEnTouched) {
            const t = await translateText(zhVal, 'auto', 'en')
            if (t) (toEn as any)[key] = t
          } else if (!zhVal && enVal) {
            const t = await translateText(enVal, 'auto', 'zh')
            if (t) (toZh as any)[key] = t
          } else if (!enVal && !zhVal && baseVal) {
            if (baseIsChinese) {
              (toZh as any)[key] = baseVal
              if (!isEnTouched) {
                const t = await translateText(baseVal, 'auto', 'en')
                if (t) (toEn as any)[key] = t
              }
            } else {
              if (!isEnTouched) (toEn as any)[key] = baseVal
              const t = await translateText(baseVal, 'auto', 'zh')
              if (t) (toZh as any)[key] = t
            }
          }
          const enNow = String((toEn as any)[key] || '')
          const zhNow = String((toZh as any)[key] || '')
          if (!enNow && zhNow && !isEnTouched) {
            const t = await translateText(zhNow, 'auto', 'en')
            if (t) (toEn as any)[key] = t
          }
          if (!zhNow && enNow) {
            const t = await translateText(enNow, 'auto', 'zh')
            if (t) (toZh as any)[key] = t
          }
          const enAfter = String((toEn as any)[key] || '')
          if (!enAfter && !isEnTouched) {
            const fallback = originalEn && !looksZh(originalEn) ? originalEn : !baseIsChinese ? baseVal : ''
            if (fallback && !looksZh(fallback)) (toEn as any)[key] = fallback
          }
          const zhAfter = String((toZh as any)[key] || '')
          if (!zhAfter) {
            const fallbackZh = originalZh && looksZh(originalZh) ? originalZh : baseIsChinese ? baseVal : ''
            if (fallbackZh && looksZh(fallbackZh)) (toZh as any)[key] = fallbackZh
          }
        }
        const picTouch: { title?: boolean; subtitle?: boolean; description?: boolean } = {}
        for (const key of ['title','subtitle','description'] as const) {
          const finalVal = String((toEn as any)[key] || '')
          if (finalVal && !looksZh(finalVal)) {
            picTouch[key] = true
          }
        }
        if (Object.keys(picTouch).length) {
          nextPicTouches[i] = picTouch
        }
        nextPictures[i] = { ...pic, en: toEn, zh: toZh }
      }
      setPictures(nextPictures)
      if (Object.keys(nextPicTouches).length) {
        setPicEnTouched(prev => {
          const merged = { ...prev }
          for (const [idxStr, touch] of Object.entries(nextPicTouches)) {
            const idx = Number(idxStr)
            merged[idx] = { ...(merged[idx] || {}), ...touch }
          }
          return merged
        })
      }
      
      return { en: nextEn, zh: nextZh, pictures: nextPictures }
    } finally {
      setIsTranslatingAll(false)
    }
  }

  // 仅翻译集合的标题/副标题/描述
  const autoTranslateSetOnly = async () => {
    setIsTranslatingAll(true)
    try {
      const nextEn = { ...en }
      const nextZh = { ...zh }
      const updatedSetTouches: Partial<typeof enTouched> = {}
      for (const key of ['title','subtitle','description'] as const) {
        const baseVal = String((key === 'title' ? title : key === 'subtitle' ? subtitle : description) || '')
        let enVal = String(nextEn[key] || '')
        let zhVal = String(nextZh[key] || '')
        const existingEn = String((en as any)[key] || '')
        const existingZh = String((zh as any)[key] || '')
        const baseIsChinese = looksZh(baseVal)
        
        // 如果英文字段已被手动编辑过，跳过自动翻译该字段
        const isEnTouched = enTouched[key]
        
        if (!enVal && zhVal && !isEnTouched) {
          const t = await translateText(zhVal, 'auto', 'en')
          if (t) enVal = t
        } else if (!zhVal && enVal) {
          const t = await translateText(enVal, 'auto', 'zh')
          if (t) zhVal = t
        } else if (!enVal && !zhVal && baseVal) {
          if (looksZh(baseVal)) {
            zhVal = baseVal
            if (!isEnTouched) {
              const t = await translateText(baseVal, 'auto', 'en')
              if (t) enVal = t
            }
          } else {
            if (!isEnTouched) enVal = baseVal
            const t = await translateText(baseVal, 'auto', 'zh')
            if (t) zhVal = t
          }
        }
        // 最后保障：两侧都不为空
        if (!enVal && zhVal && !isEnTouched) {
          const t = await translateText(zhVal, 'auto', 'en')
          if (t) enVal = t
        }
        if (!zhVal && enVal) {
          const t = await translateText(enVal, 'auto', 'zh')
          if (t) zhVal = t
        }
        if (!enVal && !isEnTouched) {
          if (existingEn && !looksZh(existingEn)) enVal = existingEn
          else if (!baseIsChinese) enVal = baseVal
        }
        if (!zhVal) {
          if (existingZh) zhVal = existingZh
          else if (baseIsChinese) zhVal = baseVal
        }
        nextEn[key] = enVal
        nextZh[key] = zhVal
        if (enVal && !looksZh(enVal)) {
          updatedSetTouches[key] = true
        }
      }
      setEn(nextEn)
      setZh(nextZh)
      if (Object.keys(updatedSetTouches).length) {
        setEnTouched(prev => ({ ...prev, ...updatedSetTouches }))
      }
    } finally {
      setIsTranslatingAll(false)
    }
  }

  // 一键为无标签图片生成标签
  // 批量为无标签图片生成标签：返回最新 pictures 数组，避免批量生成后 setState 尚未同步导致 payload 丢失
  const generateTagsForUntaggedPictures = async (): Promise<typeof pictures> => {
    setIsBulkTagsGenerating(true)
    let next = [...pictures]
    try {
      for (let i = 0; i < next.length; i++) {
        const p = next[i]
        if (!p || (Array.isArray(p.tags) && p.tags.length > 0)) continue
        const src = p.previewUrl || (p.image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${p.image_url}` : '')
        if (!src) continue
        try {
          const result = await analyzeImage(src, 'tags')
          if (result.success) {
            const parts = result.result.replace(/\n/g, ',').split(/[,，;；]/).map(s => s.trim()).filter(Boolean)
            const generated = Array.from(new Set(parts.map(s => s.toLowerCase())))
            const current = Array.isArray(p.tags) ? p.tags.map(s => s.trim().toLowerCase()).filter(Boolean) : []
            const union = Array.from(new Set([ ...current, ...generated ]))
            next[i] = { ...p, tags: union }
          }
        } catch (e) {
          console.error('批量生成标签失败:', e)
        }
      }
      setPictures(next)
      return next
    } finally {
      setIsBulkTagsGenerating(false)
    }
  }

  // dynamic autofill for set-level translations: follow base fields until user manually edits en.*
  useEffect(() => {
    if (isHydratingFromEdit.current) return
    if (!hasSyncedBaseOnce.current.title) {
      hasSyncedBaseOnce.current.title = true
      return
    }
    const baseVal = String(title || '').trim()
    // 如果基础字段为空，清空翻译区域（如果未被手动编辑）
    if (!baseVal) {
      if (!enTouched.title) setEn((prev) => ({ ...prev, title: '' }))
      setZh((prev) => ({ ...prev, title: '' }))
      return
    }
    // 识别语言并放入对应区域
    const isChinese = looksZh(baseVal)
    if (isChinese) {
      // 中文：放入 zh，清空 en（如果未被手动编辑）
      setZh((prev) => ({ ...prev, title: baseVal }))
      if (!enTouched.title) {
        setEn((prev) => ({ ...prev, title: '' }))
      }
    } else {
      // 英文：放入 en（如果未被手动编辑），清空 zh
      if (!enTouched.title) setEn((prev) => ({ ...prev, title: baseVal }))
      setZh((prev) => ({ ...prev, title: '' }))
    }
  }, [title, enTouched.title])
  
  useEffect(() => {
    if (isHydratingFromEdit.current) return
    if (!hasSyncedBaseOnce.current.subtitle) {
      hasSyncedBaseOnce.current.subtitle = true
      return
    }
    const baseVal = String(subtitle || '').trim()
    if (!baseVal) {
      if (!enTouched.subtitle) setEn((prev) => ({ ...prev, subtitle: '' }))
      setZh((prev) => ({ ...prev, subtitle: '' }))
      return
    }
    const isChinese = looksZh(baseVal)
    if (isChinese) {
      setZh((prev) => ({ ...prev, subtitle: baseVal }))
      if (!enTouched.subtitle) setEn((prev) => ({ ...prev, subtitle: '' }))
    } else {
      if (!enTouched.subtitle) setEn((prev) => ({ ...prev, subtitle: baseVal }))
      setZh((prev) => ({ ...prev, subtitle: '' }))
    }
  }, [subtitle, enTouched.subtitle])
  
  useEffect(() => {
    if (isHydratingFromEdit.current) return
    if (!hasSyncedBaseOnce.current.description) {
      hasSyncedBaseOnce.current.description = true
      return
    }
    const baseVal = String(description || '').trim()
    if (!baseVal) {
      if (!enTouched.description) setEn((prev) => ({ ...prev, description: '' }))
      setZh((prev) => ({ ...prev, description: '' }))
      return
    }
    const isChinese = looksZh(baseVal)
    if (isChinese) {
      setZh((prev) => ({ ...prev, description: baseVal }))
      if (!enTouched.description) setEn((prev) => ({ ...prev, description: '' }))
    } else {
      if (!enTouched.description) setEn((prev) => ({ ...prev, description: baseVal }))
      setZh((prev) => ({ ...prev, description: '' }))
    }
  }, [description, enTouched.description])

  useEffect(() => {
    const cleanup = () => {
      if (autoTranslateTimeout.current) {
        clearTimeout(autoTranslateTimeout.current)
        autoTranslateTimeout.current = null
      }
    }

    const fields: Array<{ key: 'title' | 'subtitle' | 'description'; base: string }> = [
      { key: 'title', base: title },
      { key: 'subtitle', base: subtitle },
      { key: 'description', base: description },
    ]

    const needs = fields.some(({ key, base }) => {
      const baseVal = String(base || '').trim()
      if (!baseVal) return false
      const enVal = String((en as any)[key] || '').trim()
      const zhVal = String((zh as any)[key] || '').trim()
      return !enVal || !zhVal
    })

    if (!needs || isTranslatingAll) {
      cleanup()
      return cleanup
    }

    cleanup()
    autoTranslateTimeout.current = setTimeout(() => {
      autoTranslateSetOnly().catch(() => {})
    }, 600)

    return cleanup
  }, [
    title,
    subtitle,
    description,
    en.title,
    en.subtitle,
    en.description,
    zh.title,
    zh.subtitle,
    zh.description,
    isTranslatingAll,
  ])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // 根据选项，自动补齐集合与图片语种，并获取翻译后的值
      let translatedEn = en
      let translatedZh = zh
      let picturesForPayload = pictures
      
      if (autoFillLocalesAll) {
        // ✅ 提交时强制翻译，忽略 enTouched 限制
        console.log('🔄 Before translation - en:', en, 'zh:', zh)
        const result = await autoTranslateAll(true)
        translatedEn = result.en
        translatedZh = result.zh
        picturesForPayload = result.pictures
        console.log('✅ After translation - translatedEn:', translatedEn, 'translatedZh:', translatedZh)
        const forcedSet = await forceCompleteSetTranslations(
          {
            title: title ?? '',
            subtitle: subtitle ?? '',
            description: description ?? '',
          },
          translatedEn,
          translatedZh,
        )
        translatedEn = forcedSet.en
        translatedZh = forcedSet.zh
        picturesForPayload = await Promise.all(
          picturesForPayload.map(async (pic) => await forceCompletePictureTranslations(pic))
        )
      }
      
      // 为未设置标签的图片自动生成标签（与现有标签做并集），并使用返回的 next 数组继续构造 payload，避免批量生成后 state 未同步
      if (autoGenerateTagsForUntagged) {
        picturesForPayload = await generateTagsForUntaggedPictures()
      }
      // Debug: log intended picture order before upload/submit
      try {
        const debugOrder = pictures.map((p, i) => ({ idx: i, id: (p as any).id, image_url: p.image_url, title: p.title }))
        console.log('Submitting pictures order (top->bottom):', debugOrder)
      } catch {}

      // upload helper to R2 via signed URL
      const uploadFile = async (file: File, objectName: string): Promise<string> => {
        try {
          const res = await fetch("/api/upload-to-r2", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ objectName, contentType: file.type }),
          })
          if (!res.ok) throw new Error("Failed to get signed URL")
          const { uploadUrl } = await res.json()
          
          // 尝试读取文件内容，捕获 NotFoundError
          let buf: ArrayBuffer
          try {
            buf = await file.arrayBuffer()
          } catch (readError: any) {
            console.error("Failed to read file arrayBuffer:", readError)
            throw new Error(`无法读取文件 ${file.name}，文件可能已失效。请重新选择文件。`)
          }
          
          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: buf,
          })
          if (!uploadRes.ok) throw new Error("File upload failed")
          // store key path like /picture/xxx
          return `/${objectName}`
        } catch (error: any) {
          console.error(`Error uploading file ${file.name}:`, error)
          throw error
        }
      }

      // Cover upload (if provided)
      let coverKey = coverImageUrl
      if (cover) {
        const { file: preparedCover } = await compressImage(cover)
        coverKey = await uploadFile(
          preparedCover,
          `picture/cover-${Date.now()}-${preparedCover.name}`,
        )
      }

      // Pictures: upload raw and compressed if a new file provided
      const processedPictures = await Promise.all(
        picturesForPayload.map(async (pic, idx) => {
          let image_url = pic.image_url || ""
          let raw_image_url = pic.raw_image_url || ""

          if (pic.cover instanceof File) {
            // upload raw
            raw_image_url = await uploadFile(
              pic.cover,
              `picture/original-${Date.now()}-${idx}-${pic.cover.name}`,
            )
            // compress + upload
            const { file: comp, didCompress } = await compressImage(pic.cover)
            if (didCompress) {
              image_url = await uploadFile(
                comp,
                `picture/compressed-${Date.now()}-${idx}-${comp.name}`,
              )
            } else {
              image_url = raw_image_url
            }
            // update UI compressed size (non-blocking)
            setPictures((current) =>
              current.map((p, i) =>
                i === idx
                  ? { ...p, compressedSize: didCompress ? comp.size : undefined }
                  : p,
              ),
            )
          }

          return {
            id: pic.id,
            title: pic.title,
            subtitle: pic.subtitle,
            description: pic.description,
            style: (pic as any).style ?? null,
            season_id: (pic as any).season_id ?? null,
            location_name: (pic as any).location_name || undefined,
            location_latitude: (pic as any).location_latitude ?? null,
            location_longitude: (pic as any).location_longitude ?? null,
            picture_category_ids: (pic as any).picture_category_ids || [],
            tags: pic.tags,
            en: pic.en,
            zh: pic.zh,
            image_url,
            raw_image_url,
          }
        }),
      )

      // Optionally apply set-level season/location to pictures if missing
      const propagatedPictures = processedPictures.map((p, idx) => {
        // Backward flags preserved; prefer simplified flag for behavior
        const allowApply = applySetPropsToPictures || fillMissingFromSet
        if (!allowApply) return p
        let season_id = p.season_id
        if (seasonIds.length === 1) {
          if (overrideExistingPictureProps || season_id == null) season_id = seasonIds[0]
        }
        let location_name = p.location_name
        let location_latitude = p.location_latitude
        let location_longitude = p.location_longitude
        const hasPicLoc = !!(location_name) || (typeof location_latitude === 'number' && typeof location_longitude === 'number')
        const hasSetLoc = !!primaryLocationName || (typeof primaryLocationLat === 'number' && typeof primaryLocationLng === 'number')
        if (hasSetLoc) {
          if (overrideExistingPictureProps || !hasPicLoc) {
            location_name = primaryLocationName || undefined
            location_latitude = typeof primaryLocationLat === 'number' ? primaryLocationLat : null
            location_longitude = typeof primaryLocationLng === 'number' ? primaryLocationLng : null
          }
        }
        return { ...p, season_id, location_name, location_latitude, location_longitude }
      })

      // Derive position from selected sections (keeps existing layout logic working)
      const selectedSectionNames = availableSections
        .filter(s => sectionIds.includes(s.id))
        .map(s => (s.name || '').toLowerCase().trim())
      const hasDown = selectedSectionNames.some(n => /\bdown\b|bottom|下|底/.test(n))
      const hasUp = selectedSectionNames.some(n => /\bup\b|top|上|顶/.test(n))
      const derivedPosition = hasDown ? 'down' : (hasUp ? 'up' : 'up')

      console.log('📦 Building payload with translatedEn:', translatedEn, 'translatedZh:', translatedZh)

      const payload: PictureSetSubmitData = {
        title,
        subtitle,
        description,
        position: derivedPosition,
        cover_image_url: coverKey,
        pictures: propagatedPictures,
        is_published: isPublished,
        // keep single fields for backward compatibility but prefer multi
        primary_category_id: categoryIds.length ? categoryIds[0] : null,
        season_id: seasonIds.length ? seasonIds[0] : null,
        category_ids: categoryIds,
        season_ids: seasonIds,
        section_ids: sectionIds,
        primary_location_name: primaryLocationName || undefined,
        primary_location_latitude: typeof primaryLocationLat === 'number' ? primaryLocationLat : null,
        primary_location_longitude: typeof primaryLocationLng === 'number' ? primaryLocationLng : null,
        en: translatedEn,
        zh: translatedZh,
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

      await onSubmit(payload, editingId ?? editingPictureSet?.id)
      
      // 表单重置逻辑由父组件通过 editingPictureSet 的变化来触发
    } catch (error) {
      console.error("Error submitting form:", error)
      // 重新抛出错误，让父组件的 toast 能够显示
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatSize = (b: number) => {
    return b < 1024
      ? b + " B"
      : b < 1048576
      ? (b / 1024).toFixed(2) + " KB"
      : (b / 1048576).toFixed(2) + " MB"
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 relative">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">{isEditMode ? t('editSet') : t('createSet')}</h2>
        {isEditMode && onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('cancelEdit')}
          </Button>
        )}
      </div>

      {/* 顶部区域：三列布局（字段+翻译 | 封面 | 其它属性） */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 第一列：基础字段 + 翻译 */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold">{t('setDetails')}</h3>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="title">{t('title')}</Label>
              {coverPreview && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={() => generateField('title')}
                  disabled={isGenerating.title}
                  title={t('aiGenerateTitle')}
                >
                  {isGenerating.title ? <Sparkles className="h-3 w-3 animate-spin" /> : "✨"}
                </Button>
              )}
            </div>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="subtitle">{t('subtitle')}</Label>
              {coverPreview && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={() => generateField('subtitle')}
                  disabled={isGenerating.subtitle}
                  title={t('aiGenerateSubtitle')}
                >
                  {isGenerating.subtitle ? <Sparkles className="h-3 w-3 animate-spin" /> : "✨"}
                </Button>
              )}
            </div>
            <Input id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="description">{t('description')}</Label>
              {coverPreview && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={() => generateField('description')}
                  disabled={isGenerating.description}
                  title={t('aiGenerateDescription')}
                >
                  {isGenerating.description ? <Sparkles className="h-3 w-3 animate-spin" /> : "✨"}
                </Button>
              )}
            </div>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          
          {/* 翻译（常显） */}
          <div className="grid grid-cols-2 gap-4 border border-gray-200 rounded-lg p-3">
            <div className="col-span-2 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t('translations')}</h3>
              <Button type="button" size="sm" variant="outline" onClick={autoTranslateSetOnly} disabled={isTranslatingAll}>
                {isTranslatingAll ? '…' : t('autoTranslateSetOnly')}
              </Button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">{t('englishLabel')}</Label>
              </div>
              <Input placeholder="English title" value={en.title}
                    onChange={(e) => { setEnTouched((t)=>({ ...t, title: true })); setEn((prev) => ({ ...prev, title: e.target.value })) }} />
              <Input placeholder="English subtitle" value={en.subtitle}
                    onChange={(e) => { setEnTouched((t)=>({ ...t, subtitle: true })); setEn((prev) => ({ ...prev, subtitle: e.target.value })) }} />
              <Textarea placeholder="English description" value={en.description}
                        onChange={(e) => { setEnTouched((t)=>({ ...t, description: true })); setEn((prev) => ({ ...prev, description: e.target.value })) }} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">{t('chineseLabel')}</Label>
              </div>
              <Input placeholder="Chinese title" value={zh.title}
                    onChange={(e) => setZh((prev) => ({ ...prev, title: e.target.value }))} />
              <Input placeholder="Chinese subtitle" value={zh.subtitle}
                    onChange={(e) => setZh((prev) => ({ ...prev, subtitle: e.target.value }))} />
              <Textarea placeholder="Chinese description" value={zh.description}
                        onChange={(e) => setZh((prev) => ({ ...prev, description: e.target.value }))} />
            </div>
          </div>
        </div>
        {/* 第二列：封面预览 */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold">{t('coverImage')}</h3>
          {coverPreview ? (
            <div className="mt-2 mb-4">
              <div 
                className="relative w-full overflow-hidden rounded-md border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors group"
                onClick={() => document.getElementById('cover-input')?.click()}
                title="Click to change cover image"
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
                  {t('clickToChangeImage')}
                </div>
              </div>
              </div>
              {coverOriginalSize > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  {t('originalSize')} {formatSize(coverOriginalSize)}
                  {coverOriginalSize > COMPRESSION_THRESHOLD_BYTES && ` • ${t('willBeCompressed')}`}
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
                  <p className="text-gray-600 font-medium">{t('clickToUploadCover')}</p>
                  <p className="text-sm text-gray-400">{t('supportsFormats')}</p>
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
            <h4 className="text-base font-bold">{t('options')}</h4>
            <label className="flex items-center gap-2 text-sm">
              <input id="fill_missing_from_set" type="checkbox" checked={fillMissingFromSet} onChange={(e)=>setFillMissingFromSet(e.target.checked)} />
              <span>{t('optionsFillMissing')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input id="propagate_categories_to_pictures" type="checkbox" checked={propagateCategoriesToPictures} onChange={(e)=>setPropagateCategoriesToPictures(e.target.checked)} />
              <span>{t('optionsPropagateCategories')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input id="auto_fill_locales_all" type="checkbox" checked={autoFillLocalesAll} onChange={(e)=>setAutoFillLocalesAll(e.target.checked)} />
              <span>{t('autoTranslateSet')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input id="auto_generate_tags_untagged" type="checkbox" checked={autoGenerateTagsForUntagged} onChange={(e)=>setAutoGenerateTagsForUntagged(e.target.checked)} />
              <span>{t('generateTagsForUntagged')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input id="autogen_titles_subtitles" type="checkbox" checked={autogenTitlesSubtitles} onChange={(e)=>setAutogenTitlesSubtitles(e.target.checked)} />
              <span>{t('optionsAutogenTitles')}</span>
            </label>
          </div>

          {/* Cover AI tools moved here under cover */}
          {coverPreview && (
            <div className="border-t pt-3">
              <h4 className="text-base font-bold mb-2">{t('aiToolsCover')}</h4>
              <ImageAnalysisComponent
                imageUrl={coverPreview}
                onResultUpdate={(field, result) => {
                  const val = result || ''
                  const looksZh = /[\u4e00-\u9fff]/
                  if (field === 'title') setTitle(val)
                  if (field === 'subtitle') setSubtitle(val)
                  if (field === 'description') setDescription(val)
                  const isZh = looksZh.test(val)
                  if (isZh) {
                    setZh(prev => ({ ...prev, [field]: val }))
                    setEn(prev => ({ ...prev, [field]: prev[field] ? prev[field] : '' }))
                  } else {
                    setEn(prev => ({ ...prev, [field]: val }))
                    if (val.trim()) {
                      setEnTouched(prev => ({ ...prev, [field]: true }))
                    }
                    setZh(prev => ({ ...prev, [field]: '' }))
                  }
                }}
              />
            </div>
          )}
        </div>
        {/* 第三列：其它属性（AI、发布、分类、季节、区块、位置、标签、选项） */}
        <div className="space-y-4">
          {/* Publish */}
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold">{t('properties')}</h3>
          </div>
          <div className="flex items-center gap-3 border rounded-md px-3 py-2">
            <input id="is_published" type="checkbox" checked={isPublished} onChange={(e)=>setIsPublished(e.target.checked)} />
            <Label htmlFor="is_published">{t('published')}</Label>
          </div>

          {/* Categories */}
          <div className="border-t pt-3">
            <h4 className="text-base font-bold">{t('categories')}</h4>
            <p className="text-xs text-gray-500 mt-1">{t('examplesCategoriesHelp')}</p>
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
            <h4 className="text-base font-bold">{t('seasons')}</h4>
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
            <h4 className="text-base font-bold">{t('sections')}</h4>
            <p className="text-xs text-gray-500 mt-1">{t('sectionsHelp')}</p>
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
            <h4 className="text-base font-bold">{t('primaryLocation')}</h4>
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
              >{t('geocode')}</Button>
            </div>
            <Input placeholder={t('locationNamePlaceholder')} value={primaryLocationName} onChange={(e)=>setPrimaryLocationName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder={t('latitude')} value={primaryLocationLat} onChange={(e)=>setPrimaryLocationLat(e.target.value ? Number(e.target.value) : "")} />
              <Input placeholder={t('longitude')} value={primaryLocationLng} onChange={(e)=>setPrimaryLocationLng(e.target.value ? Number(e.target.value) : "")} />
            </div>
            
            {/* Location preview map */}
            {primaryLocationLat && primaryLocationLng && (
              <LocationPreviewMap 
                latitude={primaryLocationLat}
                longitude={primaryLocationLng}
                locationName={primaryLocationName}
              />
            )}
          </div>

          {/* Set tags */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold">{t('tags')} ({t('commaSeparated')})</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateTagsForSet}
                  disabled={isGenerating.tags || (!coverPreview && pictures.length === 0)}
                  title={coverPreview || pictures.length > 0 ? t('aiGenerateTags') : t('pleaseAddCoverOrImages')}
                  className="h-8 px-2"
                >
                {isGenerating.tags ? (
                  <span className="text-xs text-gray-500">{t('generating')}</span>
                ) : (
                  <span className="text-xs flex items-center gap-1"><Sparkles className="h-3 w-3" /> {t('aiGenerateTags')}</span>
                )}
              </Button>
            </div>
            <Input
              placeholder={t('tagsPlaceholder')}
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
            />
          </div>

          {/* removed: Options + AI Tools moved to cover column */}
        </div>
      </div>

      {/* Pictures list */}
      <div className="space-y-6" ref={picturesContainerRef}>
        {/* Section header */}
        {pictures.length > 0 && (
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <Label className="text-lg font-semibold text-gray-800">{t('picturesHdr')}</Label>
            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-sm font-medium">
              {pictures.length} {t('images')}
            </span>
          </div>
        )}

        {pictures.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <Plus className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-gray-500">{t('noImagesYet2')}</p>
              <p className="text-sm text-gray-400">{t('clickToAddImagesHint')}</p>
            </div>
          </div>
        )}

        {pictures.map((pic, idx) => (
          <div 
            key={(pic as any).id ?? (pic as any).tempId ?? idx} 
            className="relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
          >
            {/* Picture index badge */}
            <div className="absolute top-4 left-4 z-10">
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md">
                <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {idx + 1}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {pic.id ? `${t('saved')} #${pic.id}` : t('newItem')}
                </span>
              </div>
            </div>

            {/* Delete button */}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 第一列：表单字段 + 翻译 */}
                <div className="space-y-5 order-1 md:col-span-1">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-semibold text-gray-700">{t('title')}</Label>
                      {pic.previewUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => generatePictureField(idx, 'title')}
                          disabled={isGenerating.title}
                          title={t('aiGenerateTitle')}
                        >
                          {isGenerating.title ? <Sparkles className="h-3 w-3 animate-spin text-blue-500" /> : "✨"}
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder={t('enterImageTitle')}
                      value={pic.title}
                      onChange={(e) => handlePictureChange(idx, "title", e.target.value)}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-semibold text-gray-700">{t('subtitle')}</Label>
                      {pic.previewUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => generatePictureField(idx, 'subtitle')}
                          disabled={isGenerating.subtitle}
                          title={t('aiGenerateSubtitle')}
                        >
                          {isGenerating.subtitle ? <Sparkles className="h-3 w-3 animate-spin text-green-500" /> : "✨"}
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder={t('enterImageSubtitle')}
                      value={pic.subtitle}
                      onChange={(e) => handlePictureChange(idx, "subtitle", e.target.value)}
                      className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-semibold text-gray-700">{t('description')}</Label>
                      {pic.previewUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => generatePictureField(idx, 'description')}
                          disabled={isGenerating.description}
                          title={t('aiGenerateDescription')}
                        >
                          {isGenerating.description ? <Sparkles className="h-3 w-3 animate-spin text-purple-500" /> : "✨"}
                        </Button>
                      )}
                    </div>
                    <Textarea
                      placeholder={t('describeImagePlaceholder')}
                      value={pic.description}
                      onChange={(e) => handlePictureChange(idx, "description", e.target.value)}
                      className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 min-h-[80px]"
                    />
                  </div>
                  

                  {/* Picture translation fields (always visible) */}
                  <div className="mt-4 border border-gray-200 rounded-md p-3">
                    <div className="col-span-2 flex items-center justify-between pb-2">
                      <h4 className="text-base font-bold">{t('translations')}</h4>
                      <Button type="button" size="sm" variant="outline" onClick={() => autoTranslatePicture(idx)} disabled={!!isTranslatingPic[idx]}>
                        {isTranslatingPic[idx] ? t('generating') : t('autoTranslatePicture')}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label className="text-sm font-semibold text-gray-700">{t('englishLabel')}</Label>
                        <Input
                          placeholder={t('englishLabel') + ' ' + t('title')}
                          value={pic.en?.title || ''}
                          onChange={(e) => { setPicEnTouched(prev => ({ ...prev, [idx]: { ...(prev[idx]||{}), title: true } })); handlePictureChange(idx, 'en.title', e.target.value) }}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                        <Input
                          placeholder={t('englishLabel') + ' ' + t('subtitle')}
                          value={pic.en?.subtitle || ''}
                          onChange={(e) => { setPicEnTouched(prev => ({ ...prev, [idx]: { ...(prev[idx]||{}), subtitle: true } })); handlePictureChange(idx, 'en.subtitle', e.target.value) }}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                        <Textarea
                          placeholder={t('englishLabel') + ' ' + t('description')}
                          value={pic.en?.description || ''}
                          onChange={(e) => { setPicEnTouched(prev => ({ ...prev, [idx]: { ...(prev[idx]||{}), description: true } })); handlePictureChange(idx, 'en.description', e.target.value) }}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[60px]"
                        />
                      </div>
                      <div className="space-y-2">
                          <Label className="text-sm font-semibold text-gray-700">{t('chineseLabel')}</Label>
                        <Input
                          placeholder={t('chineseLabel') + ' ' + t('title')}
                          value={pic.zh?.title || ''}
                          onChange={(e) => handlePictureChange(idx, 'zh.title', e.target.value)}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                        <Input
                          placeholder={t('chineseLabel') + ' ' + t('subtitle')}
                          value={pic.zh?.subtitle || ''}
                          onChange={(e) => handlePictureChange(idx, 'zh.subtitle', e.target.value)}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                        <Textarea
                          placeholder={t('chineseLabel') + ' ' + t('description')}
                          value={pic.zh?.description || ''}
                          onChange={(e) => handlePictureChange(idx, 'zh.description', e.target.value)}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[60px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 第二列：图片预览（并把 AI 分析放在图片下方） */}
                <div className="space-y-4 order-2 md:col-span-1">
                  {pic.previewUrl ? (
                    <div className="space-y-3">
                      <Label className="text-base font-bold text-gray-800">{t('preview')}</Label>
                      <div className="relative bg-gray-50 rounded-lg p-3">
                        <div 
                          className="relative w-full overflow-hidden rounded-md border border-gray-200 bg-white cursor-pointer hover:border-blue-400 transition-colors group"
                          onClick={() => document.getElementById(`picture-input-${idx}`)?.click()}
                          title={t('clickToChangeImage')}
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
                              Click to change image
                            </div>
                          </div>
                        </div>
                        {pic.originalSize! > 0 && (
                          <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">{t('originalSize')}</span> {formatSize(pic.originalSize!)}
                              {pic.compressedSize && (
                                <>
                                  <br />
                                  <span className="font-medium">Compressed:</span> {formatSize(pic.compressedSize)} 
                                  <span className="text-green-600 font-medium">
                                    ({((pic.compressedSize / pic.originalSize!) * 100).toFixed(1)}%)
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                      {/* AI 分析（放在图片下方） */}
                    <div className="border-t pt-3">
                      <h4 className="text-base font-bold mb-2">{t('aiToolsPicture')}</h4>
                        <ImageAnalysisComponent
                          imageUrl={pic.previewUrl}
                          onResultUpdate={(field, result) => {
                            handlePictureChange(idx, field, result)
                          }}
                        />
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
                        <p className="text-gray-500 text-sm font-medium">{t('clickToUploadCover')}</p>
                        <p className="text-gray-400 text-xs mt-1">{t('supportsFormats')}</p>
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
                {/* 第三列：标签 + 类型 + 季节/位置 */}
                <div className="space-y-4 order-3 md:col-span-1">
                  {/* Picture tags */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold">{t('tags')}</h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => generatePictureTags(idx)}
                        disabled={isGenerating.tags || (!pic.previewUrl && !pic.image_url)}
                        className="h-7 px-2"
                        title={(pic.previewUrl || pic.image_url) ? t('aiGenerateTags') : t('pleaseAddCoverOrImages')}
                      >
                        {isGenerating.tags ? <span className="text-xs text-gray-500">{t('generating')}</span> : <span className="text-xs flex items-center gap-1"><Sparkles className="h-3 w-3" /> {t('aiGenerateTags')}</span>}
                      </Button>
                    </div>
                    <Input
                      placeholder={t('tagsPlaceholder')}
                      value={(pic.tags || []).join(', ')}
                      onChange={(e) => handlePictureChange(idx, 'tags', e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean))}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  {/* Types (categories) */}
                  <div className="space-y-2 border-t pt-3">
                    <h4 className="text-base font-bold">{t('typesCategories')}</h4>
                    <p className="text-xs text-gray-500">Examples: Portrait, Landscape, Street, Creative, Documentary, Travel, Architecture, Macro, Night</p>
                    <div className="grid grid-cols-2 gap-2">
                      {availableCategories.map(c => {
                        const checked = Array.isArray((pic as any).picture_category_ids) && ((pic as any).picture_category_ids as number[]).includes(c.id)
                        return (
                          <label key={c.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e)=>{
                                const cur = Array.isArray((pic as any).picture_category_ids) ? ([...(pic as any).picture_category_ids] as number[]) : []
                                const next = e.target.checked ? Array.from(new Set([...cur, c.id])) : cur.filter(id => id !== c.id)
                                handlePictureChange(idx, 'picture_category_ids', next)
                              }}
                            />
                            <span>{c.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* Season & Location */}
                  <div className="grid grid-cols-1 gap-3 pt-3 border-t">
                    <div>
                      <h4 className="text-base font-bold mb-1">{t('season')}</h4>
                      <Select
                        value={pic.season_id != null ? String(pic.season_id) : undefined}
                        onValueChange={(v)=>handlePictureChange(idx, 'season_id', v ? Number(v) : null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectSeason')} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSeasons.map(s => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 gap-2 border-t pt-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold">{t('location')}</h4>
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
                        >{t('geocode')}</Button>
                      </div>
                      <Input placeholder={t('locationNamePlaceholder')} value={(pic as any).location_name || ''} onChange={(e)=>handlePictureChange(idx, 'location_name', e.target.value)} />
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder={t('latitude')} value={(pic as any).location_latitude ?? ''} onChange={(e)=>handlePictureChange(idx, 'location_latitude', e.target.value ? Number(e.target.value) : null)} />
                        <Input placeholder={t('longitude')} value={(pic as any).location_longitude ?? ''} onChange={(e)=>handlePictureChange(idx, 'location_longitude', e.target.value ? Number(e.target.value) : null)} />
                      </div>
                      
                      {/* Location preview map */}
                      {(pic as any).location_latitude && (pic as any).location_longitude && (
                        <LocationPreviewMap 
                          latitude={(pic as any).location_latitude}
                          longitude={(pic as any).location_longitude}
                          locationName={(pic as any).location_name}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* moved AI analysis inside right column */}
            </div>
          </div>
        ))}
      </div>

      {/* Add pictures buttons (single and bulk) */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-6">
        <Button 
          type="button" 
          onClick={handleAddPicture} 
          variant="outline"
          className="flex items-center gap-2 px-6 py-3 border-2 border-dashed border-purple-300 text-purple-600 hover:border-purple-400 hover:bg-purple-50 transition-all duration-200"
        >
          <Plus className="h-5 w-5" /> 
          {t('addImageBtn')}
        </Button>
        <Button
          type="button"
          onClick={() => bulkInputRef.current?.click()}
          variant="outline"
          className="flex items-center gap-2 px-6 py-3 border-2 border-dashed border-blue-300 text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
        >
          <Plus className="h-5 w-5" />
          {t('addImagesBulkBtn')}
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
                style: null,
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
                console.error("Preview generation failed:", err)
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
            <h3 className="text-lg font-medium">{t('reorderPicturesHdr')}</h3>
            <span className="text-xs text-gray-500">{t('dragThumbnails')}</span>
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
                title={(pic.title || '').trim() || `${t('image')} ${idx + 1}`}
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
                  <div className="w-full h-24 bg-gray-100 flex items-center justify-center text-xs text-gray-400">{t('noPreview')}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 bg-white py-4 border-t z-[9999] space-y-2">
        <Button type="submit" disabled={isSubmitting} className="w-full relative z-[9999]">
          {isSubmitting ? t('submitting') : isEditMode ? t('updateSet') : t('submitSet')}
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
