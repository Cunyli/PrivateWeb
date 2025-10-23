"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import clsx from "clsx"
import { PHOTOGRAPHY_STYLES, PHOTOGRAPHY_STYLE_BY_ID } from "@/lib/photography-styles"
import { useI18n } from "@/lib/i18n"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowUpRight } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSearchParams, useRouter } from "next/navigation"

type PictureTranslation = {
  title?: string | null
  subtitle?: string | null
  description?: string | null
}

type StylePicture = {
  id: number
  pictureSetId: number
  imageUrl: string
  rawImageUrl: string | null
  orderIndex: number | null
  createdAt: string
  tags: string[]
  categories: string[]
  set: {
    id: number
    title: string
    subtitle: string
    coverImageUrl: string | null
    translations: {
      en: PictureTranslation
      zh: PictureTranslation
    }
  }
  translations: {
    en: PictureTranslation
    zh: PictureTranslation
  }
}

type StyleApiResponse = {
  id: string
  tagName: string
  pictures: StylePicture[]
}

const FALLBACK_DELAY_MS = 15_000
const DELAY_VARIANCE_MS = 6_000
const HOVER_INTENT_DELAY_MS = 90

export function PhotographyStyleShowcase() {
  const { t, locale } = useI18n()
  const searchParams = useSearchParams()
  const router = useRouter()
  const bucketUrl = useMemo(() => process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top", [])

  const [stylesData, setStylesData] = useState<Record<string, StyleApiResponse>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeStyle, setActiveStyle] = useState<string | null>(null)
  const [visibleIndex, setVisibleIndex] = useState<Record<string, number>>({})
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null)
  const [modalIndex, setModalIndex] = useState(0)
  const [styleLoading, setStyleLoading] = useState<string | null>(null)
  const rotationTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [landscapeMap, setLandscapeMap] = useState<Record<string, Record<number, boolean>>>({})
  const [, startHighlightTransition] = useTransition()
  const hoverTimerRef = useRef<number | null>(null)
  const prefetchedImagesRef = useRef<Set<string>>(new Set())
  const [hoveredMobileIndex, setHoveredMobileIndex] = useState<number | null>(null)
  const modalIndexInitialized = useRef(false) // 用于标记 modalIndex 是否已初始化
  const [activeMobileStyleId, setActiveMobileStyleId] = useState<string | null>(null) // 追踪手机端当前激活的风格
  const scrollThrottleTimer = useRef<number | null>(null) // 滚动节流定时器
  const lastVibrateStyleId = useRef<string | null>(null) // 记录上次触发震动的风格ID

  const updateOrientation = useCallback((styleId: string | null, pictureId: number, width?: number, height?: number) => {
    if (!styleId) return
    if (!Number.isFinite(pictureId)) return
    if (!width || !height) return
    const isLandscape = width >= height
    setLandscapeMap((prev) => {
      const styleEntry = prev[styleId] || {}
      if (styleEntry[pictureId] === isLandscape) return prev
      return {
        ...prev,
        [styleId]: {
          ...styleEntry,
          [pictureId]: isLandscape,
        },
      }
    })
  }, [])

  const hasMasterTag = useCallback((picture: StylePicture) => {
    const pool = [...(picture.tags || []), ...(picture.categories || [])]
    return pool.some((value) => {
      const lower = value.toLowerCase()
      return lower.includes('大师') || lower.includes('master')
    })
  }, [])

  const eligibleCache = useMemo(() => {
    const cache: Record<string, number[]> = {}
    for (const style of PHOTOGRAPHY_STYLES) {
      const pictures = stylesData[style.id]?.pictures || []
      if (!pictures.length) {
        cache[style.id] = []
        continue
      }
      const orientationMap = landscapeMap[style.id] || {}
      const tierPreferred: number[] = []
      const tierFallback: number[] = []
      pictures.forEach((picture, idx) => {
        if (!hasMasterTag(picture)) return
        const orientationValue = orientationMap[picture.id]
        if (orientationValue === true) {
          tierPreferred.push(idx)
        } else if (orientationValue === undefined) {
          tierFallback.push(idx)
        }
      })
      if (tierPreferred.length > 0) {
        cache[style.id] = tierPreferred
      } else if (tierFallback.length > 0) {
        cache[style.id] = tierFallback
      } else {
        cache[style.id] = []
      }
    }
    return cache
  }, [hasMasterTag, landscapeMap, stylesData])

  const getEligibleIndices = useCallback((styleId: string) => eligibleCache[styleId] || [], [eligibleCache])

  const pickNextEligibleIndex = useCallback(
    (styleId: string, eligible: number[], current: number, usedPictureIds: Set<number>) => {
      if (eligible.length === 0) return -1
      const pictures = stylesData[styleId]?.pictures || []
      const pickWithCheck = (indices: number[], fallback?: number) => {
        for (const idx of indices) {
          const picture = pictures[idx]
          if (!picture) continue
          if (!usedPictureIds.has(picture.id)) return idx
        }
        return fallback ?? -1
      }

      const shuffled = [...eligible]
      if (!eligible.includes(current)) {
        const preferred = pickWithCheck(shuffled)
        return preferred !== -1 ? preferred : eligible[0]
      }

      const withoutCurrent = shuffled.filter((idx) => idx !== current)
      const preferred = pickWithCheck(withoutCurrent)
      if (preferred !== -1) return preferred

      const allowCurrent = pickWithCheck([current], current)
      if (allowCurrent !== -1) return allowCurrent

      return pickWithCheck(shuffled, eligible[0])
    },
    [stylesData],
  )

  const fetchStyles = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/picture-styles")
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`)
      }
      const data = await res.json()
      const payload = (data?.styles || {}) as Record<string, StyleApiResponse>
      const normalized: Record<string, StyleApiResponse> = {}
      for (const [key, value] of Object.entries(payload)) {
        normalized[key] = {
          ...value,
          pictures: (value?.pictures || []).map((picture) => ({
            ...picture,
            tags: Array.isArray(picture.tags) ? picture.tags : [],
            categories: Array.isArray(picture.categories) ? picture.categories : [],
          })),
        }
      }
      setStylesData(normalized)
      const nextVisible: Record<string, number> = {}
      for (const style of PHOTOGRAPHY_STYLES) {
        const pictures = normalized[style.id]?.pictures || []
        nextVisible[style.id] = pictures.length ? 0 : -1
      }
      setVisibleIndex(nextVisible)
      setError(null)
    } catch (err: any) {
      console.error("Failed to load photography styles", err)
      setError(err?.message || "Failed to load styles")
    } finally {
      setLoading(false)
    }
  }, [])

  const ensureStylePictures = useCallback(async (styleId: string) => {
    if (styleLoading === styleId) return
    try {
      setStyleLoading(styleId)
      const res = await fetch(`/api/picture-styles?style=${styleId}`)
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`)
      }
      const data = await res.json()
      const payload = (data?.styles || {}) as Record<string, StyleApiResponse>
      if (!payload[styleId]) return
      const normalizedStyle: StyleApiResponse = {
        ...payload[styleId],
        pictures: (payload[styleId]?.pictures || []).map((picture) => ({
          ...picture,
          tags: Array.isArray(picture.tags) ? picture.tags : [],
          categories: Array.isArray(picture.categories) ? picture.categories : [],
        })),
      }
      setStylesData((prev) => {
        const next = { ...prev }
        next[styleId] = normalizedStyle
        return next
      })
      setVisibleIndex((prev) => {
        const next = { ...prev }
        const pictures = normalizedStyle.pictures || []
        if (pictures.length) {
          const baseIndex = prev[styleId] ?? 0
          next[styleId] = Math.min(Math.max(baseIndex, 0), pictures.length - 1)
        } else {
          next[styleId] = -1
        }
        return next
      })
    } catch (err) {
      console.error("Failed to refresh style pictures", err)
    } finally {
      setStyleLoading((current) => (current === styleId ? null : current))
    }
  }, [styleLoading])

  useEffect(() => {
    fetchStyles().catch(() => {})
  }, [fetchStyles])

  useEffect(() => {
    // Clear existing timers before scheduling new ones
    Object.values(rotationTimers.current).forEach((timer) => clearTimeout(timer))
    rotationTimers.current = {}

    for (const style of PHOTOGRAPHY_STYLES) {
      const schedule = () => {
        const eligibleIndices = getEligibleIndices(style.id)
        if (eligibleIndices.length <= 1) return
        const delay = FALLBACK_DELAY_MS + Math.random() * DELAY_VARIANCE_MS
        rotationTimers.current[style.id] = setTimeout(() => {
          setVisibleIndex((prev) => {
            const currentEligible = getEligibleIndices(style.id)
            if (currentEligible.length === 0) return prev
            const current = prev[style.id] ?? currentEligible[0]
            const usedPictureIds = new Set<number>()
            for (const otherStyle of PHOTOGRAPHY_STYLES) {
              if (otherStyle.id === style.id) continue
              const idx = prev[otherStyle.id]
              if (idx == null || idx < 0) continue
              const picture = stylesData[otherStyle.id]?.pictures?.[idx]
              if (picture) usedPictureIds.add(picture.id)
            }
            const next = pickNextEligibleIndex(style.id, currentEligible, current, usedPictureIds)
            if (next === -1 || next === current) return prev
            return { ...prev, [style.id]: next }
          })
          schedule()
        }, delay)
      }
      schedule()
    }

    return () => {
      Object.values(rotationTimers.current).forEach((timer) => clearTimeout(timer))
      rotationTimers.current = {}
    }
  }, [getEligibleIndices, pickNextEligibleIndex, stylesData])

  const handleOpenStyle = useCallback((styleId: string) => {
    void ensureStylePictures(styleId)
    const pictures = stylesData[styleId]?.pictures || []
    const eligible = getEligibleIndices(styleId)
    const currentIdx = visibleIndex[styleId] ?? 0
    const safeIdx = eligible.length
      ? eligible.includes(currentIdx) ? currentIdx : eligible[0]
      : (pictures.length ? Math.max(0, Math.min(pictures.length - 1, currentIdx)) : 0)
    setSelectedStyleId(styleId)
    setModalIndex(safeIdx)
    modalIndexInitialized.current = true // 标记已初始化
  }, [ensureStylePictures, getEligibleIndices, stylesData, visibleIndex])
  
  // 检查 URL 参数中是否有风格参数，自动打开对应的风格弹窗
  useEffect(() => {
    const styleFromUrl = searchParams.get('style')
    if (styleFromUrl && stylesData[styleFromUrl] && !loading) {
      // 自动打开对应的风格弹窗
      handleOpenStyle(styleFromUrl)
      // 清除 URL 参数，避免页面刷新时再次打开
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.delete('style')
        router.replace(url.pathname + url.search, { scroll: false })
      }
    }
  }, [searchParams, stylesData, loading, handleOpenStyle, router])

  const prefetchPreview = useCallback((styleId: string | null) => {
    if (typeof window === 'undefined') return
    if (!styleId) return
    const pictures = stylesData[styleId]?.pictures || []
    if (!pictures.length) return
    const eligible = getEligibleIndices(styleId)
    const candidateIdx = eligible.length ? eligible[0] : 0
    const candidate = pictures[candidateIdx]
    if (!candidate) return
    const src = candidate.imageUrl?.startsWith("http")
      ? candidate.imageUrl
      : `${bucketUrl}${candidate.imageUrl}`
    if (!src || prefetchedImagesRef.current.has(src)) return
    const img = new window.Image()
    img.src = src
    prefetchedImagesRef.current.add(src)
  }, [bucketUrl, getEligibleIndices, stylesData])

  const handleHighlightChange = useCallback((next: string | null) => {
    if (hoverTimerRef.current != null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    if (next === null) {
      startHighlightTransition(() => {
        setActiveStyle((prev) => (prev === null ? prev : null))
      })
      return
    }

    if (typeof window !== 'undefined') {
      prefetchPreview(next)
    }

    hoverTimerRef.current = window.setTimeout(() => {
      startHighlightTransition(() => {
        setActiveStyle((prev) => (prev === next ? prev : next))
      })
    }, HOVER_INTENT_DELAY_MS)
  }, [prefetchPreview, startHighlightTransition])

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current != null) {
        window.clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
      // 清理滚动节流定时器
      if (scrollThrottleTimer.current != null) {
        window.cancelAnimationFrame(scrollThrottleTimer.current)
        scrollThrottleTimer.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!selectedStyleId) {
      modalIndexInitialized.current = false // 重置标记
      return
    }
    // 只在弹窗刚打开且 modalIndex 未初始化时设置一次
    if (modalIndexInitialized.current) return
    
    const pictures = stylesData[selectedStyleId]?.pictures || []
    if (!pictures.length) return
    const idx = visibleIndex[selectedStyleId] ?? 0
    setModalIndex(Math.max(0, Math.min(pictures.length - 1, idx)))
    modalIndexInitialized.current = true
  }, [selectedStyleId, stylesData, visibleIndex])

  useEffect(() => {
    setVisibleIndex((prev) => {
      let changed = false
      const next = { ...prev }
      const usedPictureIds = new Set<number>()
      for (const style of PHOTOGRAPHY_STYLES) {
        const idx = prev[style.id]
        if (idx == null || idx < 0) continue
        const picture = stylesData[style.id]?.pictures?.[idx]
        if (picture) usedPictureIds.add(picture.id)
      }

      for (const style of PHOTOGRAPHY_STYLES) {
        const pictures = stylesData[style.id]?.pictures || []
        const eligible = getEligibleIndices(style.id)
        if (!eligible.length) {
          if ((prev[style.id] ?? 0) !== -1) {
            next[style.id] = -1
            changed = true
          }
          continue
        }
        const current = prev[style.id]
        let candidate = eligible.find((idx) => {
          const picture = pictures[idx]
          if (!picture) return false
          return !usedPictureIds.has(picture.id)
        })
        if (candidate == null) {
          candidate = eligible[0]
        }
        const picture = pictures[candidate]
        if (picture) usedPictureIds.add(picture.id)
        if (current !== candidate) {
          next[style.id] = candidate
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [getEligibleIndices, stylesData])

  const selectedStyleConfig = selectedStyleId ? PHOTOGRAPHY_STYLE_BY_ID[selectedStyleId as keyof typeof PHOTOGRAPHY_STYLE_BY_ID] : undefined
  const modalPictures = selectedStyleId ? stylesData[selectedStyleId]?.pictures || [] : []
  const currentModalPicture = modalPictures[modalIndex]
  const isModalLoading = !!selectedStyleId && styleLoading === selectedStyleId && modalPictures.length === 0
  const highlightStyleId = activeStyle ?? selectedStyleId ?? null

  useEffect(() => {
    if (typeof window === 'undefined') return
    prefetchPreview(highlightStyleId)
  }, [highlightStyleId, prefetchPreview])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const primaryStyle = PHOTOGRAPHY_STYLES[0]?.id
    if (primaryStyle) prefetchPreview(primaryStyle)
  }, [prefetchPreview, stylesData])

  const loadingState = loading && Object.keys(stylesData).length === 0
  const styleCards = PHOTOGRAPHY_STYLES.map((style, idx) => {
    const pictures = stylesData[style.id]?.pictures || []
    const eligible = getEligibleIndices(style.id)
    const activeIndex = visibleIndex[style.id] ?? (eligible[0] ?? -1)
    const preview = activeIndex >= 0 ? pictures[activeIndex] : undefined
    const orientationMap = landscapeMap[style.id] || {}
    const previewOrientation = preview ? orientationMap[preview.id] : undefined
  const isActive = highlightStyleId === style.id
  const isSelected = selectedStyleId === style.id
    const flexGrow = activeStyle ? (isActive ? 2.2 : 0.78) : 1
    const flexBasis = activeStyle ? (isActive ? "50%" : "16%") : "auto"
    const translateY = isActive ? "-8px" : "0px"
    const hasContent = eligible.length > 0
    const badge = locale === "zh" ? "风格" : "Style"
    const tagline = style.tagline?.[locale] || style.tagline?.en || ""
    const isFirst = idx === 0
    const isLast = idx === PHOTOGRAPHY_STYLES.length - 1

    return {
      style,
      idx,
      pictures,
      eligible,
      activeIndex,
      preview,
      isActive,
      flexGrow,
      flexBasis,
      translateY,
      hasContent,
      badge,
      tagline,
      isFirst,
      isLast,
      previewOrientation,
      isSelected,
    }
  })

  return (
    <section className="mt-16 sm:mt-24">
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div className="text-center md:text-left">
            <h2 className="text-lg md:text-2xl font-medium tracking-[0.08em] md:tracking-[0.1em] uppercase text-slate-900/95">
              {t("styleShowcaseTitle")}
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground/70 max-w-2xl mx-auto md:mx-0">
              {t("styleShowcaseSubtitle")}
            </p>
          </div>
          <div className="hidden md:block text-xs text-muted-foreground/70 uppercase tracking-[0.4em]">
            {t("styleShowcaseInstruction")}
          </div>
        </div>

        {loadingState && (
          <div className="grid gap-2.5 md:grid-cols-4">
            {PHOTOGRAPHY_STYLES.map((style) => (
              <div
                key={style.id}
                className="h-64 rounded-[2.5rem] bg-gradient-to-br from-gray-200 via-gray-100 to-white animate-pulse"
              />
            ))}
          </div>
        )}

        {!loadingState && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loadingState && !error && (
          <>
            <div className="md:hidden -mx-4 relative">
              {/* 边缘渐隐遮罩 */}
              <div className="absolute inset-0 pointer-events-none z-10" style={{
                maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
                WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)'
              }} />
              
              <div
                data-style-scroll-container
                className="flex gap-0 overflow-x-auto pb-6 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                style={{ WebkitOverflowScrolling: "touch", paddingLeft: "1rem", paddingRight: "1rem" }}
                onScroll={(e) => {
                  // 滚动节流优化 - 使用 requestAnimationFrame
                  if (scrollThrottleTimer.current !== null) {
                    return
                  }
                  
                  // 保存 container 引用，避免在异步回调中丢失
                  const container = e.currentTarget
                  
                  scrollThrottleTimer.current = window.requestAnimationFrame(() => {
                    scrollThrottleTimer.current = null
                    
                    // 检查 container 是否仍然存在
                    if (!container || !container.scrollLeft === undefined) {
                      return
                    }
                    
                    // 检测当前中心位置的卡片
                    const scrollLeft = container.scrollLeft
                    const containerWidth = container.clientWidth
                    const centerPos = scrollLeft + containerWidth / 2
                    
                    let closestStyleId: string | null = null
                    let minDistance = Infinity
                    
                    Array.from(container.children).forEach((child, idx) => {
                      const element = child as HTMLElement
                      const rect = element.getBoundingClientRect()
                      const containerRect = container.getBoundingClientRect()
                      const childCenter = rect.left - containerRect.left + scrollLeft + rect.width / 2
                      const distance = Math.abs(childCenter - centerPos)
                      
                      if (distance < minDistance) {
                        minDistance = distance
                        closestStyleId = PHOTOGRAPHY_STYLES[idx]?.id || null
                      }
                    })
                    
                    if (closestStyleId !== activeMobileStyleId) {
                      setActiveMobileStyleId(closestStyleId)
                      
                      // 触觉反馈 - 当切换到新卡片时振动
                      if (closestStyleId && closestStyleId !== lastVibrateStyleId.current) {
                        lastVibrateStyleId.current = closestStyleId
                        // 检查设备是否支持振动API
                        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                          try {
                            navigator.vibrate(50) // 轻微振动50毫秒
                          } catch (error) {
                            // 忽略振动错误
                          }
                        }
                      }
                    }
                  })
                }}
              >
                {styleCards.map(({ style, preview, hasContent, pictures, badge, tagline, previewOrientation, isSelected, isActive, isFirst, isLast }, cardIdx) => {
                  const shouldContain = previewOrientation === false && (isSelected || isActive)
                  const clipPath = isFirst
                    ? "polygon(0% 0, 100% 0, 94% 100%, 0% 100%)"
                    : isLast
                      ? "polygon(6% 0, 100% 0, 100% 100%, 0% 100%)"
                      : "polygon(6% 0, 100% 0, 94% 100%, 0% 100%)"
                  
                  const isMobileActive = activeMobileStyleId === style.id
                  
                  return (
                  <button
                    key={`${style.id}-mobile`}
                    type="button"
                    onClick={() => handleOpenStyle(style.id)}
                    onTouchStart={() => setActiveMobileStyleId(style.id)}
                    className="snap-center relative inline-flex min-h-[420px] flex-shrink-0 overflow-hidden bg-slate-900 text-left shadow-[0_30px_90px_-45px_rgba(15,23,42,0.85)] transition-all duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:scale-[0.96]"
                    style={{
                      clipPath,
                      width: 'calc(100vw - 3rem)',
                      maxWidth: '360px',
                      marginRight: isLast ? '0' : '-12%',
                      marginLeft: isFirst ? '0' : '-12%',
                      transform: isMobileActive ? 'scale(1.02) translateY(-8px)' : 'scale(1) translateY(0)',
                      zIndex: isMobileActive ? 20 : 10 - cardIdx,
                      filter: isMobileActive ? 'brightness(1.1)' : 'brightness(0.95)',
                    }}
                  >
                    <div className="absolute inset-0">
                      {preview ? (
                        <Image
                          key={`${style.id}-mobile-${preview.id}`}
                          src={preview.imageUrl ? `${bucketUrl}${preview.imageUrl}` : "/placeholder.svg"}
                          alt={preview.translations[locale as "zh" | "en"]?.title || preview.translations.en?.title || t(style.i18nKey)}
                          fill
                          // 图片优先级优化：第一张优先加载，第二张预加载，其余懒加载
                          priority={cardIdx === 0}
                          loading={cardIdx === 0 ? undefined : cardIdx === 1 ? 'eager' : 'lazy'}
                          className={clsx(
                            "transition-all ease-out object-center",
                            shouldContain ? "object-contain" : "object-cover",
                            isMobileActive 
                              ? shouldContain ? "scale-100 duration-700" : "scale-[1.08] duration-700"
                              : shouldContain ? "scale-100 duration-1000" : "scale-[1.02] duration-1000"
                          )}
                          onLoadingComplete={(img) => updateOrientation(style.id, preview.id, img.naturalWidth, img.naturalHeight)}
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-slate-300 via-slate-200 to-white" />
                      )}
                      <div 
                        className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/85 transition-opacity duration-500"
                        style={{ opacity: isMobileActive ? 0.6 : 0.8 }}
                      />
                      <div 
                        className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(148,163,184,0.3),transparent_55%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.28),transparent_60%)] opacity-70 mix-blend-screen transition-opacity duration-500"
                        style={{ opacity: isMobileActive ? 0.9 : 0.6 }}
                      />
                    </div>

                    <div className="relative z-10 flex h-full flex-col justify-between p-6 transition-all duration-500">
                      <div 
                        className="flex items-center gap-3 text-white/70 transition-all duration-500"
                        style={{ 
                          opacity: isMobileActive ? 1 : 0.8,
                          transform: isMobileActive ? 'translateY(0)' : 'translateY(4px)'
                        }}
                      >
                        <span className="text-[10px] uppercase tracking-[0.5em]">
                          {badge}
                        </span>
                        {hasContent && (
                          <span className="text-[10px] uppercase tracking-[0.4em] text-white/55">
                            {pictures.length} {locale === "zh" ? "张" : "photos"}
                          </span>
                        )}
                      </div>
                      <div 
                        className="space-y-2 transition-all duration-500"
                        style={{ 
                          transform: isMobileActive ? 'translateY(0)' : 'translateY(8px)',
                          opacity: isMobileActive ? 1 : 0.9
                        }}
                      >
                        <h3 className="text-[2rem] font-extralight text-white drop-shadow-xl">
                          {t(style.i18nKey)}
                        </h3>
                        {tagline && (
                          <p className="max-w-[26ch] text-[0.95rem] leading-relaxed text-white/85">
                            {tagline}
                          </p>
                        )}
                      </div>
                      <div 
                        className="flex items-center gap-2 transition-all duration-500"
                        style={{ 
                          opacity: isMobileActive ? 1 : 0.8,
                          transform: isMobileActive ? 'translateX(0)' : 'translateX(-4px)'
                        }}
                      >
                        <span className="text-[11px] uppercase tracking-[0.45em] text-white/80">
                          {hasContent ? t("styleViewGallery") : t("styleEmpty")}
                        </span>
                        <ArrowUpRight 
                          className="h-4 w-4 text-white/85 transition-all duration-500" 
                          style={{
                            transform: isMobileActive ? 'translate(4px, -4px)' : 'translate(0, 0)'
                          }}
                        />
                      </div>
                    </div>
                  </button>
                )})}
              </div>
              
              {/* 滚动指示器 */}
              <div className="flex justify-center items-center gap-2 mt-4">
                {PHOTOGRAPHY_STYLES.map((style, idx) => {
                  const isActive = activeMobileStyleId === style.id
                  return (
                    <button
                      key={`indicator-${style.id}`}
                      type="button"
                      onClick={() => {
                        // 点击指示器滚动到对应卡片
                        const container = document.querySelector('[data-style-scroll-container]') as HTMLElement
                        if (container) {
                          const cardWidth = container.clientWidth - 32 // 减去padding
                          const scrollTo = idx * (cardWidth * 0.88) // 考虑12%重叠
                          container.scrollTo({ left: scrollTo, behavior: 'smooth' })
                        }
                      }}
                      className="transition-all duration-300 rounded-full"
                      style={{
                        width: isActive ? '32px' : '8px',
                        height: '8px',
                        backgroundColor: isActive ? 'rgba(59, 130, 246, 0.8)' : 'rgba(148, 163, 184, 0.3)',
                      }}
                      aria-label={`${t(style.i18nKey)} ${idx + 1}/${PHOTOGRAPHY_STYLES.length}`}
                    />
                  )
                })}
              </div>
            </div>

            <div className="hidden md:flex md:flex-row [clip-path:polygon(0_0,100%_0,100%_100%,0_100%)] overflow-hidden">
              {styleCards.map(({ style, preview, hasContent, pictures, badge, tagline, isFirst, isLast, isActive, isSelected, flexGrow, flexBasis, translateY, previewOrientation }) => {
                const clipPath = isFirst
                  ? "polygon(0% 0, 100% 0, 94% 100%, 0% 100%)"
                  : isLast
                    ? "polygon(6% 0, 100% 0, 100% 100%, 0% 100%)"
                    : "polygon(6% 0, 100% 0, 94% 100%, 0% 100%)"
                const shouldContain = previewOrientation === false && (isActive || isSelected)

                return (
                  <button
                    key={style.id}
                    type="button"
                    onMouseEnter={() => handleHighlightChange(style.id)}
                    onMouseLeave={() => handleHighlightChange(null)}
                    onFocus={() => handleHighlightChange(style.id)}
                    onBlur={() => handleHighlightChange(null)}
                    onClick={() => handleOpenStyle(style.id)}
                    className="group relative min-h-[320px] flex-1 bg-black/70 text-left transition-transform duration-500 transform-gpu"
                    style={{
                      clipPath,
                      marginRight: isLast ? undefined : "-5%",
                      marginLeft: isFirst ? undefined : "-5%",
                      zIndex: isActive ? 25 : 10,
                      flexGrow,
                      flexBasis,
                      transform: `translateY(${translateY})`,
                      transition: "flex-grow 480ms cubic-bezier(0.27,0.8,0.25,1), flex-basis 480ms cubic-bezier(0.27,0.8,0.25,1), transform 360ms cubic-bezier(0.24,1,0.32,1)",
                      willChange: "transform, flex-basis, flex-grow",
                    }}
                  >
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute inset-0 origin-center overflow-hidden">
                        {preview ? (
                          <Image
                            key={`${style.id}-${preview.id}`}
                            src={preview.imageUrl ? `${bucketUrl}${preview.imageUrl}` : "/placeholder.svg"}
                            alt={preview.translations[locale as "zh" | "en"]?.title || preview.translations.en?.title || t(style.i18nKey)}
                            fill
                            className={clsx(
                              "image-fade-soft transform-gpu transition-transform ease-out object-center",
                              shouldContain ? "object-contain" : "object-cover",
                              shouldContain ? "scale-100 group-hover:scale-100" : "scale-[1.02] group-hover:scale-[1.08]"
                            )}
                            style={{ willChange: "transform, opacity", transitionDuration: '1200ms' }}
                            priority={isActive}
                            loading={isActive ? "eager" : "lazy"}
                            onLoadingComplete={(img) => updateOrientation(style.id, preview.id, img.naturalWidth, img.naturalHeight)}
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-slate-300 via-slate-200 to-white" />
                        )}
                        <div
                          className={`absolute inset-0 bg-gradient-to-br from-black/80 via-black/30 to-black/75 transition-opacity duration-500 ${isActive ? "opacity-25" : "opacity-55"}`}
                          style={{ willChange: "opacity" }}
                        />
                      </div>
                    </div>

                    <div className="relative z-10 flex h-full flex-col justify-between px-6 py-8 md:px-8 md:py-10 space-y-6 transition-opacity duration-300 ease-out">
                      <div className="flex items-center gap-3 text-white/70">
                        <span className="text-[10px] uppercase tracking-[0.5em]">
                          {badge}
                        </span>
                        {hasContent && (
                          <span className="text-[10px] uppercase tracking-[0.4em] text-white/50">
                            {pictures.length} {locale === "zh" ? "张" : "photos"}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-[1.9rem] md:text-[2.2rem] font-extralight text-white drop-shadow-lg transition-transform duration-500 ease-out group-hover:-translate-y-[3px]">
                          {t(style.i18nKey)}
                        </h3>
                        {tagline && (
                          <p className="max-w-[24ch] text-sm md:text-[0.95rem] leading-relaxed text-white/80 transition-opacity duration-500 ease-out group-hover:opacity-95">
                            {tagline}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-[0.45em] text-white/75 transition-transform duration-500 ease-out group-hover:translate-x-1">
                          {hasContent ? t("styleViewGallery") : t("styleEmpty")}
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-white/80 transition-transform duration-300 group-hover:translate-x-1.5 group-hover:-translate-y-1.5" />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      <Dialog open={!!selectedStyleId} onOpenChange={(open) => { if (!open) setSelectedStyleId(null) }}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] w-[min(100vw-2rem,80rem)] max-w-5xl flex-col overflow-hidden bg-background p-0 shadow-2xl">
          <div className="flex min-h-0 flex-1 flex-col">
            <DialogHeader className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-6 pt-6 pb-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <DialogClose asChild>
                  <Button variant="ghost" size="sm" className="inline-flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    {t("backToHome")}
                  </Button>
                </DialogClose>
                {isModalLoading && (
                  <span className="text-xs text-muted-foreground">{t("loadingSets")}</span>
                )}
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <div className="space-y-1 text-left pt-6 pb-4">
                <DialogTitle className="font-light text-2xl tracking-wide">
                  {selectedStyleConfig ? t(selectedStyleConfig.i18nKey) : t("styleShowcaseTitle")}
                </DialogTitle>
                {selectedStyleConfig?.tagline && (
                  <DialogDescription className="text-sm text-muted-foreground">
                    {selectedStyleConfig.tagline[locale] || selectedStyleConfig.tagline.en}
                  </DialogDescription>
                )}
              </div>
              {isModalLoading ? (
                <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  {t("loadingSets")}
                </div>
              ) : modalPictures.length > 0 ? (
                <div className="flex flex-col gap-6">
                <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
                  <div className="space-y-2 md:space-y-4">
                    <div 
                      className="relative aspect-[16/10] w-full overflow-hidden rounded-[2.5rem] bg-black/70 shadow-[0_40px_120px_-60px_rgba(37,99,235,0.65)]"
                    >
                      {modalPictures.map((picture, idx) => {
                        const active = idx === modalIndex
                        const imageSrc = picture.imageUrl?.startsWith('http') ? picture.imageUrl : (picture.imageUrl ? `${bucketUrl}${picture.imageUrl}` : '/placeholder.svg')
                        const orientation = selectedStyleId ? landscapeMap[selectedStyleId]?.[picture.id] : undefined
                        return (
                          <Image
                            key={`${selectedStyleId}-${picture.id}-hero`}
                            src={imageSrc || '/placeholder.svg'}
                            alt={picture.translations[locale as 'zh' | 'en']?.title || picture.translations.en?.title || picture.set.title}
                            fill
                            priority={idx === modalIndex}
                            className={clsx(
                              'absolute inset-0 transition-all object-center',
                              orientation === false ? 'object-contain' : 'object-cover',
                              active ? 'opacity-100 scale-100' : 'opacity-0',
                              orientation === false
                                ? active ? 'scale-100' : 'scale-100'
                                : active ? 'scale-100' : 'scale-105'
                            )}
                            style={{ transitionDuration: '1400ms', transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}
                            onLoadingComplete={(img) => {
                              // 避免在弹窗打开时频繁触发更新
                              if (!modalIndexInitialized.current) return
                              updateOrientation(selectedStyleId, picture.id, img.naturalWidth, img.naturalHeight)
                            }}
                          />
                        )
                      })}
                      
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(99,102,241,0.28),transparent_55%),radial-gradient(circle_at_75%_10%,rgba(34,211,238,0.25),transparent_55%),linear-gradient(140deg,rgba(2,6,23,0.75) 10%,rgba(15,23,42,0.35) 45%,rgba(15,23,42,0.85) 100%)]" />
                      <div className="absolute left-3 md:left-6 top-3 md:top-6 flex items-center gap-2 md:gap-3 text-[9px] md:text-[10px] uppercase tracking-[0.3em] md:tracking-[0.45em] text-white/70">
                        <span>{selectedStyleConfig ? t(selectedStyleConfig.i18nKey) : t('styleShowcaseTitle')}</span>
                        <span className="rounded-full border border-white/30 bg-white/10 px-2 md:px-3 py-0.5 md:py-1 font-semibold tracking-[0.2em] md:tracking-[0.3em]">
                          {String(modalIndex + 1).padStart(2, '0')} / {String(modalPictures.length).padStart(2, '0')}
                        </span>
                      </div>
                      {currentModalPicture && (
                        <div className="absolute inset-x-3 md:inset-x-6 bottom-3 md:bottom-6 flex flex-col gap-1.5 md:gap-3 text-white drop-shadow-xl">
                          <div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-[9px] md:text-[11px] uppercase tracking-[0.3em] md:tracking-[0.4em] text-white/70">
                            <span className="truncate max-w-[150px] md:max-w-none">{currentModalPicture.set.translations[locale as 'zh' | 'en']?.title || currentModalPicture.set.title}</span>
                            <span className="hidden md:block h-[1px] w-10 bg-white/40" />
                            <span className="hidden md:inline">{locale === 'zh' ? '大师影廊' : 'Master Series'}</span>
                          </div>
                          <h3 className="text-lg md:text-2xl lg:text-3xl font-light leading-tight line-clamp-2 md:line-clamp-none">
                            {locale === 'zh'
                              ? currentModalPicture.translations.zh?.title || currentModalPicture.translations.en?.title
                              : currentModalPicture.translations.en?.title || currentModalPicture.translations.zh?.title || t('styleUntitled')}
                          </h3>
                          {(currentModalPicture.translations[locale as 'zh' | 'en']?.description || selectedStyleConfig?.tagline?.[locale as 'zh' | 'en']) && (
                            <p className="hidden md:block max-w-2xl text-sm text-white/80 line-clamp-2">
                              {currentModalPicture.translations[locale as 'zh' | 'en']?.description || selectedStyleConfig?.tagline?.[locale as 'zh' | 'en']}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1.5 md:gap-2">
                            {[...(currentModalPicture.categories || []), ...(currentModalPicture.tags || [])]
                              .filter(Boolean)
                              .slice(0, 3)
                              .map((label) => (
                                <span
                                  key={`${currentModalPicture.id}-${label}`}
                                  className="rounded-full border border-white/30 bg-white/10 px-2 md:px-3 py-0.5 md:py-1 text-[9px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] text-white/75"
                                >
                                  {label}
                                </span>
                              ))}
                            {[...(currentModalPicture.categories || []), ...(currentModalPicture.tags || [])].filter(Boolean).length > 3 && (
                              <span className="rounded-full border border-white/30 bg-white/10 px-2 md:px-3 py-0.5 md:py-1 text-[9px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] text-white/75">
                                +{[...(currentModalPicture.categories || []), ...(currentModalPicture.tags || [])].filter(Boolean).length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                    )}
                  </div>

                    {currentModalPicture && (
                      <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3 rounded-xl md:rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 md:px-5 md:py-4 text-sm text-white/80">
                        <div className="flex flex-col gap-0.5 md:gap-1">
                          <span className="text-[9px] md:text-[11px] uppercase tracking-[0.3em] md:tracking-[0.4em] text-white/60">
                            {t('styleFromSeries')}
                          </span>
                          <span className="text-sm md:text-base font-medium text-white line-clamp-1">
                            {currentModalPicture.set.translations[locale as 'zh' | 'en']?.title || currentModalPicture.set.title}
                          </span>
                        </div>
                        <Button variant="secondary" size="sm" className="bg-white/90 text-slate-900 hover:bg-white text-xs md:text-sm h-8 md:h-9 px-3 md:px-4" asChild>
                          <Link href={`/work/${currentModalPicture.pictureSetId}?index=${currentModalPicture.orderIndex ?? 0}&style=${selectedStyleId}`}>
                            <span className="hidden md:inline">{t('styleViewGallery')}</span>
                            <span className="md:hidden">{locale === 'zh' ? '查看' : 'View'}</span>
                            <ArrowUpRight className="ml-1 md:ml-2 h-3 w-3 md:h-4 md:w-4" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>                  <div className="hidden lg:block rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-[0_25px_70px_-50px_rgba(15,23,42,0.75)] backdrop-blur">
                    <ScrollArea className="h-[440px] pr-2">
                      <div className="grid grid-cols-2 gap-3">
                        {modalPictures.map((picture, idx) => {
                          const active = idx === modalIndex
                          const imageSrc = picture.imageUrl?.startsWith('http') ? picture.imageUrl : (picture.imageUrl ? `${bucketUrl}${picture.imageUrl}` : '/placeholder.svg')
                          const orientation = selectedStyleId ? landscapeMap[selectedStyleId]?.[picture.id] : undefined
                          return (
                            <button
                              key={`${selectedStyleId}-${picture.id}-thumb`}
                              type="button"
                              onClick={() => setModalIndex(idx)}
                              className={`group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border transition-all duration-500 ${
                                active
                                  ? 'border-white shadow-[0_20px_55px_-35px_rgba(59,130,246,0.6)] scale-[1.01]'
                                  : 'border-white/15 hover:border-white/45 hover:scale-[1.01]'
                              }`}
                            >
                              <Image
                                src={imageSrc || '/placeholder.svg'}
                                alt={picture.translations[locale as 'zh' | 'en']?.title || picture.translations.en?.title || picture.set.title}
                                fill
                                className={clsx(
                                  'transition duration-700 object-center',
                                  orientation === false ? 'object-contain group-hover:scale-100' : 'object-cover group-hover:scale-105'
                                )}
                                onLoadingComplete={(img) => updateOrientation(selectedStyleId, picture.id, img.naturalWidth, img.naturalHeight)}
                              />
                              <div className={`absolute inset-0 bg-black/35 transition-opacity duration-500 ${active ? 'opacity-5' : 'opacity-35 group-hover:opacity-15'}`} />
                              <div className="absolute left-3 top-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-white/70">
                                <span>{String(idx + 1).padStart(2, '0')}</span>
                              </div>
                              <div className="absolute bottom-3 left-3 right-3 text-left text-[11px] leading-tight text-white drop-shadow-md">
                                <div className="font-medium line-clamp-1">
                                  {picture.translations[locale as 'zh' | 'en']?.title || picture.translations.en?.title || picture.set.title}
                                </div>
                                <div className="opacity-75 line-clamp-1">
                                  {picture.set.translations[locale as 'zh' | 'en']?.title || picture.set.title}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                <div className="lg:hidden space-y-4 md:space-y-8">
                  {/* 竖向图片组 - 左右堆叠 */}
                  {(() => {
                    const portraitPictures = modalPictures.filter((picture) => {
                      const orientation = selectedStyleId ? landscapeMap[selectedStyleId]?.[picture.id] : undefined
                      return orientation === false
                    })
                    
                    if (portraitPictures.length === 0) return null
                    
                    return (
                      <div className="relative w-full">
                        <h4 className="text-xs uppercase tracking-[0.4em] text-white/60 mb-2 md:mb-4 text-center">
                          {locale === 'zh' ? '竖向作品' : 'Portrait'}
                        </h4>
                        <div 
                          className="relative overflow-x-auto overflow-y-hidden pb-4 -mx-4 px-4 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-white/10 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-white/50" 
                          style={{ height: '420px', WebkitOverflowScrolling: 'touch' }}
                        >
                          <div className="relative flex flex-row gap-4 justify-start items-center" style={{ height: '400px', minWidth: 'max-content', paddingLeft: 'max(0px, calc(50% - 120px))' }}>
                          {portraitPictures.map((picture, idx) => {
                            const globalIdx = modalPictures.indexOf(picture)
                            const active = globalIdx === modalIndex
                            const isHovered = hoveredMobileIndex === globalIdx
                            const imageSrc = picture.imageUrl?.startsWith('http') ? picture.imageUrl : (picture.imageUrl ? `${bucketUrl}${picture.imageUrl}` : '/placeholder.svg')
                            const cardWidth = 240
                            // 使用 picture 的 orderIndex 作为跳转参数，同时传递风格信息
                            const imageIndex = picture.orderIndex ?? 0
                            
                            return (
                              <Link
                                key={`${picture.id}-portrait-${idx}`}
                                href={`/work/${picture.pictureSetId}?index=${imageIndex}&style=${selectedStyleId}`}
                                className={`group relative flex-shrink-0 snap-center overflow-hidden rounded-2xl border transition-all duration-500 block ${
                                  active
                                    ? 'border-white shadow-[0_25px_60px_-35px_rgba(59,130,246,0.65)]'
                                    : 'border-white/20 hover:border-white/60'
                                }`}
                                style={{
                                  width: `${cardWidth}px`,
                                  height: '380px',
                                  transform: active ? 'scale(1.02)' : 'scale(1)',
                                  transition: 'all 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                                }}
                              >
                                <div className="absolute inset-0 z-10">
                                  <Image
                                    src={imageSrc || '/placeholder.svg'}
                                    alt={picture.translations[locale as 'zh' | 'en']?.title || picture.translations.en?.title || picture.set.title}
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    onLoadingComplete={(img) => updateOrientation(selectedStyleId, picture.id, img.naturalWidth, img.naturalHeight)}
                                    priority={active || isHovered}
                                  />
                                </div>
                                
                                <div className={`absolute inset-0 transition-opacity duration-500 z-5 ${
                                  active ? 'bg-black/5 opacity-100' : 'bg-black/35 opacity-100 group-hover:opacity-50'
                                }`} />
                                
                                <div className="absolute bottom-0 left-0 right-0 text-left text-[11px] leading-tight text-white z-20 px-2 py-2">
                                  <div className="font-medium line-clamp-1 drop-shadow-md">
                                    {picture.translations[locale as 'zh' | 'en']?.title || picture.translations.en?.title || picture.set.title}
                                  </div>
                                  <div className="opacity-75 line-clamp-1 drop-shadow-md">
                                    {picture.set.translations[locale as 'zh' | 'en']?.title || picture.set.title}
                                  </div>
                                </div>
                              </Link>
                            )
                          })}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                  
                  {/* 横向图片组 - 上下堆叠 */}
                  {(() => {
                    const landscapePictures = modalPictures.filter((picture) => {
                      const orientation = selectedStyleId ? landscapeMap[selectedStyleId]?.[picture.id] : undefined
                      return orientation === true || orientation === undefined
                    })
                    
                    if (landscapePictures.length === 0) return null
                    
                    return (
                      <div 
                        className="relative flex flex-col items-center"
                        onClick={(e) => {
                          // 如果点击的是容器本身（不是卡片），则收起所有展开的卡片
                          if (e.target === e.currentTarget && window.innerWidth < 1024) {
                            setHoveredMobileIndex(null)
                            const items = e.currentTarget.querySelectorAll('a')
                            if (!items) return
                            items.forEach((item, itemIdx) => {
                              const htmlItem = item as HTMLElement
                              htmlItem.style.transform = 'translateY(0) scale(1)'
                              htmlItem.style.zIndex = String(landscapePictures.length - itemIdx)
                            })
                          }
                        }}
                      >
                        <h4 className="text-xs uppercase tracking-[0.4em] text-white/60 mb-2 md:mb-4">
                          {locale === 'zh' ? '横向作品' : 'Landscape'}
                        </h4>
                        {landscapePictures.map((picture, idx) => {
                          const globalIdx = modalPictures.indexOf(picture)
                          const active = globalIdx === modalIndex
                          const isHovered = hoveredMobileIndex === globalIdx
                          const imageSrc = picture.imageUrl?.startsWith('http') ? picture.imageUrl : (picture.imageUrl ? `${bucketUrl}${picture.imageUrl}` : '/placeholder.svg')
                          const cardHeight = 180
                          const overlapAmount = 45
                          // 使用 picture 的 orderIndex 作为跳转参数，同时传递风格信息
                          const imageIndex = picture.orderIndex ?? 0
                          
                          return (
                            <a
                              key={`${picture.id}-landscape-${idx}`}
                              href={`/work/${picture.pictureSetId}?index=${imageIndex}&style=${selectedStyleId}`}
                              onClick={(e) => {
                                // 移动端逻辑：第一次点击展开，第二次点击跳转
                                if (window.innerWidth < 1024) { // lg breakpoint
                                  if (hoveredMobileIndex !== globalIdx) {
                                    e.preventDefault()
                                    
                                    // 先收起所有卡片
                                    const items = e.currentTarget.parentElement?.querySelectorAll('a')
                                    if (items) {
                                      items.forEach((item, itemIdx) => {
                                        const htmlItem = item as HTMLElement
                                        htmlItem.style.transform = 'translateY(0) scale(1)'
                                        htmlItem.style.zIndex = String(landscapePictures.length - itemIdx)
                                      })
                                    }
                                    
                                    // 然后展开当前卡片
                                    setHoveredMobileIndex(globalIdx)
                                    if (items) {
                                      items.forEach((item, itemIdx) => {
                                        const htmlItem = item as HTMLElement
                                        if (itemIdx < idx) {
                                          htmlItem.style.transform = 'translateY(-45px)'
                                        } else if (itemIdx === idx) {
                                          htmlItem.style.transform = active ? 'scale(1.03)' : 'scale(1.02)'
                                          htmlItem.style.zIndex = String(landscapePictures.length + 10)
                                        } else {
                                          htmlItem.style.transform = 'translateY(45px)'
                                        }
                                      })
                                    }
                                  }
                                  // 如果已经展开（hoveredMobileIndex === globalIdx），则允许跳转
                                }
                              }}
                              className={`group relative w-full overflow-hidden rounded-2xl border transition-all duration-500 block cursor-pointer ${
                                active
                                  ? 'border-white shadow-[0_25px_60px_-35px_rgba(59,130,246,0.65)]'
                                  : 'border-white/20 hover:border-white/60'
                              }`}
                              style={{
                                height: `${cardHeight}px`,
                                marginTop: idx === 0 ? '0' : `-${overlapAmount}px`,
                                zIndex: landscapePictures.length - idx,
                                transform: active ? 'scale(1.02)' : 'scale(1)',
                                transition: 'all 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                              }}
                              onMouseEnter={(e) => {
                                setHoveredMobileIndex(globalIdx)
                                const items = e.currentTarget.parentElement?.querySelectorAll('a')
                                if (!items) return
                                items.forEach((item, itemIdx) => {
                                  const htmlItem = item as HTMLElement
                                  if (itemIdx < idx) {
                                    htmlItem.style.transform = 'translateY(-45px)'
                                  } else if (itemIdx === idx) {
                                    htmlItem.style.transform = active ? 'scale(1.03)' : 'scale(1.02)'
                                    htmlItem.style.zIndex = String(landscapePictures.length + 10)
                                  } else {
                                    htmlItem.style.transform = 'translateY(45px)'
                                  }
                                })
                              }}
                              onMouseLeave={(e) => {
                                setHoveredMobileIndex(null)
                                const items = e.currentTarget.parentElement?.querySelectorAll('a')
                                if (!items) return
                                items.forEach((item, itemIdx) => {
                                  const htmlItem = item as HTMLElement
                                  htmlItem.style.transform = 'translateY(0) scale(1)'
                                  htmlItem.style.zIndex = String(landscapePictures.length - itemIdx)
                                })
                              }}
                            >
                              <div className="absolute inset-0 z-10">
                                <Image
                                  src={imageSrc || '/placeholder.svg'}
                                  alt={picture.translations[locale as 'zh' | 'en']?.title || picture.translations.en?.title || picture.set.title}
                                  fill
                                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                                  onLoadingComplete={(img) => updateOrientation(selectedStyleId, picture.id, img.naturalWidth, img.naturalHeight)}
                                  priority={active || isHovered}
                                />
                              </div>
                              
                              <div className={`absolute inset-0 transition-opacity duration-500 z-5 ${
                                active ? 'bg-black/5 opacity-100' : 'bg-black/35 opacity-100 group-hover:opacity-50'
                              }`} />
                              
                              <div className="absolute bottom-0 left-0 right-0 text-left text-[11px] leading-tight text-white z-20 px-2 py-2">
                                <div className="font-medium line-clamp-1 drop-shadow-md">
                                  {picture.translations[locale as 'zh' | 'en']?.title || picture.translations.en?.title || picture.set.title}
                                </div>
                                <div className="opacity-75 line-clamp-1 drop-shadow-md">
                                  {picture.set.translations[locale as 'zh' | 'en']?.title || picture.set.title}
                                </div>
                              </div>
                            </a>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  {t("styleEmpty")}
                </div>
              )}
              <div className="mt-6 flex justify-end">
                <DialogClose asChild>
                  <Button variant="ghost">
                    {t("close")}
                  </Button>
                </DialogClose>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default PhotographyStyleShowcase
