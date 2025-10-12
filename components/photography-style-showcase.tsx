"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { PHOTOGRAPHY_STYLES, PHOTOGRAPHY_STYLE_BY_ID } from "@/lib/photography-styles"
import { useI18n } from "@/lib/i18n"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowUpRight } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

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
  const bucketUrl = useMemo(() => process.env.NEXT_PUBLIC_BUCKET_URL || "", [])

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
  }, [ensureStylePictures, getEligibleIndices, stylesData, visibleIndex])

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
    }
  }, [])

  useEffect(() => {
    if (!selectedStyleId) return
    const pictures = stylesData[selectedStyleId]?.pictures || []
    if (!pictures.length) return
    const idx = visibleIndex[selectedStyleId] ?? 0
    setModalIndex(Math.max(0, Math.min(pictures.length - 1, idx)))
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

  return (
    <section className="mt-12 md:mt-20">
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
          <div className="text-xs text-muted-foreground/70 uppercase tracking-[0.4em]">
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
          <div className="flex flex-col md:flex-row [clip-path:polygon(0_0,100%_0,100%_100%,0_100%)] overflow-hidden">
            {PHOTOGRAPHY_STYLES.map((style, idx) => {
              const pictures = stylesData[style.id]?.pictures || []
              const eligible = getEligibleIndices(style.id)
              const activeIndex = visibleIndex[style.id] ?? (eligible[0] ?? -1)
              const preview = activeIndex >= 0 ? pictures[activeIndex] : undefined
              const isActive = highlightStyleId === style.id
              const flexGrow = activeStyle ? (isActive ? 2.2 : 0.78) : 1
              const flexBasis = activeStyle ? (isActive ? "50%" : "16%") : "auto"
              const translateY = isActive ? "-8px" : "0px"
              const hasContent = eligible.length > 0
              const badge = locale === "zh" ? "风格" : "Style"
              const tagline = style.tagline?.[locale] || style.tagline?.en || ""
              const isFirst = idx === 0
              const isLast = idx === PHOTOGRAPHY_STYLES.length - 1
              const clipPath = isFirst
                ? "polygon(0% 0, 100% 0, 94% 100%, 0% 100%)"
                : isLast
                  ? "polygon(6% 0, 100% 0, 100% 100%, 0% 100%)"
                  : "polygon(6% 0, 100% 0, 94% 100%, 0% 100%)"
              return (
                <button
                  key={style.id}
                  type="button"
                  onMouseEnter={() => handleHighlightChange(style.id)}
                  onMouseLeave={() => handleHighlightChange(null)}
                  onFocus={() => handleHighlightChange(style.id)}
                  onBlur={() => handleHighlightChange(null)}
                  onClick={() => handleOpenStyle(style.id)}
                  className="group relative min-h-[280px] md:min-h-[360px] flex-1 bg-black/70 text-left transition-transform duration-500 transform-gpu"
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
                          className="image-fade-soft object-cover scale-[1.02] transition-transform ease-out group-hover:scale-[1.08] transform-gpu"
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
        )}
      </div>

      <Dialog open={!!selectedStyleId} onOpenChange={(open) => { if (!open) setSelectedStyleId(null) }}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] w-[min(100vw-2rem,80rem)] max-w-5xl flex-col overflow-hidden bg-background p-0 shadow-2xl">
          <div className="flex min-h-0 flex-1 flex-col">
            <DialogHeader className="sticky top-0 z-20 gap-3 border-b border-border/60 bg-background/95 px-6 pt-6 pb-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
              <div className="space-y-1 text-left">
                <DialogTitle className="font-light text-2xl tracking-wide">
                  {selectedStyleConfig ? t(selectedStyleConfig.i18nKey) : t("styleShowcaseTitle")}
                </DialogTitle>
                {selectedStyleConfig?.tagline && (
                  <DialogDescription className="text-sm text-muted-foreground">
                    {selectedStyleConfig.tagline[locale] || selectedStyleConfig.tagline.en}
                  </DialogDescription>
                )}
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {isModalLoading ? (
                <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  {t("loadingSets")}
                </div>
              ) : modalPictures.length > 0 ? (
                <div className="flex flex-col gap-6">
                <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
                  <div className="space-y-4">
                    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[2.5rem] border border-white/15 bg-black/70 shadow-[0_40px_120px_-60px_rgba(37,99,235,0.65)]">
                      {modalPictures.map((picture, idx) => {
                        const active = idx === modalIndex
                        const imageSrc = picture.imageUrl?.startsWith('http') ? picture.imageUrl : (picture.imageUrl ? `${bucketUrl}${picture.imageUrl}` : '/placeholder.svg')
                        return (
                          <Image
                            key={`${picture.id}-hero-${idx}`}
                            src={imageSrc || '/placeholder.svg'}
                            alt={picture.translations[locale as 'zh' | 'en']?.title || picture.translations.en?.title || picture.set.title}
                            fill
                            priority={idx === modalIndex}
                            className={`absolute inset-0 object-cover transition-all ${
                              active ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                            }`}
                            style={{ transitionDuration: '1400ms', transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}
                            onLoadingComplete={(img) => updateOrientation(selectedStyleId, picture.id, img.naturalWidth, img.naturalHeight)}
                          />
                        )
                      })}
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(99,102,241,0.28),transparent_55%),radial-gradient(circle_at_75%_10%,rgba(34,211,238,0.25),transparent_55%),linear-gradient(140deg,rgba(2,6,23,0.75) 10%,rgba(15,23,42,0.35) 45%,rgba(15,23,42,0.85) 100%)]" />
                      <div className="absolute left-6 top-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.45em] text-white/70">
                        <span>{selectedStyleConfig ? t(selectedStyleConfig.i18nKey) : t('styleShowcaseTitle')}</span>
                        <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 font-semibold tracking-[0.3em]">
                          {String(modalIndex + 1).padStart(2, '0')} / {String(modalPictures.length).padStart(2, '0')}
                        </span>
                      </div>
                      {currentModalPicture && (
                        <div className="absolute inset-x-6 bottom-6 flex flex-col gap-3 text-white drop-shadow-xl">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.4em] text-white/70">
                            <span>{currentModalPicture.set.translations[locale as 'zh' | 'en']?.title || currentModalPicture.set.title}</span>
                            <span className="h-[1px] w-10 bg-white/40" />
                            <span>{locale === 'zh' ? '大师影廊' : 'Master Series'}</span>
                          </div>
                          <h3 className="text-2xl md:text-3xl font-light leading-tight">
                            {locale === 'zh'
                              ? currentModalPicture.translations.zh?.title || currentModalPicture.translations.en?.title
                              : currentModalPicture.translations.en?.title || currentModalPicture.translations.zh?.title || t('styleUntitled')}
                          </h3>
                          {(currentModalPicture.translations[locale as 'zh' | 'en']?.description || selectedStyleConfig?.tagline?.[locale as 'zh' | 'en']) && (
                            <p className="max-w-2xl text-sm text-white/80">
                              {currentModalPicture.translations[locale as 'zh' | 'en']?.description || selectedStyleConfig?.tagline?.[locale as 'zh' | 'en']}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {[...(currentModalPicture.categories || []), ...(currentModalPicture.tags || [])]
                              .filter(Boolean)
                              .slice(0, 6)
                              .map((label) => (
                                <span
                                  key={`${currentModalPicture.id}-${label}`}
                                  className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/75"
                                >
                                  {label}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {currentModalPicture && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-sm text-white/80">
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] uppercase tracking-[0.4em] text-white/60">
                            {t('styleFromSeries')}
                          </span>
                          <span className="text-base font-medium text-white">
                            {currentModalPicture.set.translations[locale as 'zh' | 'en']?.title || currentModalPicture.set.title}
                          </span>
                        </div>
                        <Button variant="secondary" size="sm" className="bg-white/90 text-slate-900 hover:bg-white" asChild>
                          <Link href={`/work/${currentModalPicture.pictureSetId}`}>
                            {t('styleViewGallery')}
                            <ArrowUpRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="hidden lg:block rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-[0_25px_70px_-50px_rgba(15,23,42,0.75)] backdrop-blur">
                    <ScrollArea className="h-[440px] pr-2">
                      <div className="grid grid-cols-2 gap-3">
                        {modalPictures.map((picture, idx) => {
                          const active = idx === modalIndex
                          const imageSrc = picture.imageUrl?.startsWith('http') ? picture.imageUrl : (picture.imageUrl ? `${bucketUrl}${picture.imageUrl}` : '/placeholder.svg')
                          return (
                            <button
                              key={`${picture.id}-thumb-${idx}`}
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
                                className="object-cover transition duration-700 group-hover:scale-105"
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

                <div className="lg:hidden grid gap-3 sm:grid-cols-3 auto-rows-[120px] sm:auto-rows-[150px] md:auto-rows-[180px] overflow-hidden">
                  {modalPictures.map((picture, idx) => {
                    const active = idx === modalIndex
                    const imageSrc = picture.imageUrl?.startsWith('http') ? picture.imageUrl : (picture.imageUrl ? `${bucketUrl}${picture.imageUrl}` : '/placeholder.svg')
                    return (
                      <button
                        key={`${picture.id}-mobile-${idx}`}
                        type="button"
                        onClick={() => setModalIndex(idx)}
                        className={`group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border transition-all duration-500 ${
                          active
                            ? 'border-white shadow-[0_25px_60px_-35px_rgba(59,130,246,0.65)] scale-[1.02]'
                            : 'border-white/20 hover:border-white/60 hover:scale-[1.01]'
                        }`}
                      >
                        <Image
                          src={imageSrc || '/placeholder.svg'}
                          alt={picture.translations[locale as 'zh' | 'en']?.title || picture.translations.en?.title || picture.set.title}
                          fill
                          className="object-cover transition duration-700 group-hover:scale-105"
                          onLoadingComplete={(img) => updateOrientation(selectedStyleId, picture.id, img.naturalWidth, img.naturalHeight)}
                        />
                        <div className={`absolute inset-0 bg-black/35 transition-opacity duration-500 ${active ? 'opacity-5' : 'opacity-35 group-hover:opacity-15'}`} />
                        <div className="absolute bottom-2 left-2 right-2 text-left text-[11px] leading-tight text-white drop-shadow-md">
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
