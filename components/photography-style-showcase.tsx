"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { PHOTOGRAPHY_STYLES, PHOTOGRAPHY_STYLE_BY_ID } from "@/lib/photography-styles"
import { useI18n } from "@/lib/i18n"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Carousel } from "@/components/carousel"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "lucide-react"

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

const FALLBACK_DELAY_MS = 6_500
const DELAY_VARIANCE_MS = 4_000

const pickNextIndex = (current: number, length: number) => {
  if (length <= 1) return 0
  const random = Math.floor(Math.random() * length)
  if (random === current) return (current + 1) % length
  return random
}

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

  const fetchStyles = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/picture-styles")
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`)
      }
      const data = await res.json()
      const payload = (data?.styles || {}) as Record<string, StyleApiResponse>
      setStylesData(payload)
      const nextVisible: Record<string, number> = {}
      for (const style of PHOTOGRAPHY_STYLES) {
        const pictures = payload[style.id]?.pictures || []
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
      setStylesData((prev) => {
        const next = { ...prev }
        next[styleId] = payload[styleId]
        return next
      })
      setVisibleIndex((prev) => {
        const next = { ...prev }
        const pictures = payload[styleId]?.pictures || []
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
      const pictures = stylesData[style.id]?.pictures || []
      if (pictures.length <= 1) continue
      const schedule = () => {
        const delay = FALLBACK_DELAY_MS + Math.random() * DELAY_VARIANCE_MS
        rotationTimers.current[style.id] = setTimeout(() => {
          setVisibleIndex((prev) => {
            const current = prev[style.id] ?? 0
            const next = pickNextIndex(current, pictures.length)
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
  }, [stylesData])

  const handleOpenStyle = useCallback((styleId: string) => {
    void ensureStylePictures(styleId)
    const pictures = stylesData[styleId]?.pictures || []
    const currentIdx = visibleIndex[styleId] ?? 0
    const safeIdx = pictures.length ? Math.max(0, Math.min(pictures.length - 1, currentIdx)) : 0
    setSelectedStyleId(styleId)
    setModalIndex(safeIdx)
  }, [ensureStylePictures, stylesData, visibleIndex])

  useEffect(() => {
    if (!selectedStyleId) return
    const pictures = stylesData[selectedStyleId]?.pictures || []
    if (!pictures.length) return
    const idx = visibleIndex[selectedStyleId] ?? 0
    setModalIndex(Math.max(0, Math.min(pictures.length - 1, idx)))
  }, [selectedStyleId, stylesData, visibleIndex])

  const selectedStyleConfig = selectedStyleId ? PHOTOGRAPHY_STYLE_BY_ID[selectedStyleId as keyof typeof PHOTOGRAPHY_STYLE_BY_ID] : undefined
  const modalPictures = selectedStyleId ? stylesData[selectedStyleId]?.pictures || [] : []
  const currentModalPicture = modalPictures[modalIndex]
  const isModalLoading = !!selectedStyleId && styleLoading === selectedStyleId && modalPictures.length === 0
  const highlightStyleId = activeStyle ?? selectedStyleId ?? null

  const carouselImages = useMemo(() => {
    if (!modalPictures.length) return []
    return modalPictures.map((picture) => ({
      url: picture.imageUrl,
      rawUrl: picture.rawImageUrl,
      translations: {
        en: picture.translations.en || {},
        zh: picture.translations.zh || {},
      },
    }))
  }, [modalPictures])

  const loadingState = loading && Object.keys(stylesData).length === 0

  return (
    <section className="mt-12 md:mt-20">
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-light tracking-wide">
              {t("styleShowcaseTitle")}
            </h2>
            <p className="text-sm md:text-base text-muted-foreground/80 max-w-2xl">
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
            {PHOTOGRAPHY_STYLES.map((style) => {
              const pictures = stylesData[style.id]?.pictures || []
              const activeIndex = visibleIndex[style.id] ?? 0
              const preview = activeIndex >= 0 ? pictures[activeIndex] : undefined
              const isActive = highlightStyleId === style.id
              const flexClass = activeStyle
                ? isActive
                  ? "md:flex-[2.25]"
                  : "md:flex-[0.6]"
                : "md:flex-1"
              const hasContent = pictures.length > 0
              const badge = locale === "zh" ? "风格" : "Style"
              const tagline = style.tagline?.[locale] || style.tagline?.en || ""
              return (
                <button
                  key={style.id}
                  type="button"
                  onMouseEnter={() => setActiveStyle(style.id)}
                  onMouseLeave={() => setActiveStyle(null)}
                  onFocus={() => setActiveStyle(style.id)}
                  onBlur={() => setActiveStyle(null)}
                  onClick={() => handleOpenStyle(style.id)}
                  className={`group relative min-h-[280px] md:min-h-[360px] transition-[flex] duration-600 ease-[cubic-bezier(0.22,1,0.36,1)] flex-1 ${flexClass} bg-black/70 text-left`}
                  style={{
                    clipPath: "polygon(6% 0, 100% 0, 94% 100%, 0 100%)",
                    marginRight: style.id !== PHOTOGRAPHY_STYLES[PHOTOGRAPHY_STYLES.length - 1].id ? "-5%" : undefined,
                    marginLeft: style.id !== PHOTOGRAPHY_STYLES[0].id ? "-5%" : undefined,
                    zIndex: isActive ? 20 : 10,
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
                          className="object-cover scale-[1.02] transition-transform duration-[1400ms] ease-out group-hover:scale-[1.12]"
                          priority={style.id === PHOTOGRAPHY_STYLES[0].id}
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-slate-300 via-slate-200 to-white" />
                      )}
                      <div
                        className={`absolute inset-0 bg-gradient-to-br from-black/82 via-black/30 to-black/75 transition-opacity duration-500 ${isActive ? "opacity-28" : "opacity-55"}`}
                      />
                    </div>
                  </div>

                  <div className="relative z-10 flex h-full flex-col justify-between px-6 py-8 md:px-8 md:py-10 space-y-6">
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
                      <h3 className="text-[1.9rem] md:text-[2.2rem] font-extralight text-white drop-shadow-lg">
                        {t(style.i18nKey)}
                      </h3>
                      {tagline && (
                        <p className="max-w-[24ch] text-sm md:text-[0.95rem] leading-relaxed text-white/75">
                          {tagline}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-[0.45em] text-white/70">
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
        <DialogContent className="max-w-5xl w-full p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="font-light tracking-wide text-2xl">
              {selectedStyleConfig ? t(selectedStyleConfig.i18nKey) : t("styleShowcaseTitle")}
            </DialogTitle>
            {selectedStyleConfig?.tagline && (
              <DialogDescription className="text-sm text-muted-foreground">
                {selectedStyleConfig.tagline[locale] || selectedStyleConfig.tagline.en}
              </DialogDescription>
            )}
            {isModalLoading && (
              <span className="text-xs text-muted-foreground">{t("loadingSets")}</span>
            )}
          </DialogHeader>
          <div className="px-6 pb-6">
            {isModalLoading ? (
              <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                {t("loadingSets")}
              </div>
            ) : modalPictures.length > 0 ? (
              <div className="flex flex-col gap-6">
                <div className="rounded-3xl border border-border/50 bg-white/5 p-4 shadow-xl">
                  <Carousel
                    images={carouselImages}
                    currentIndex={modalIndex}
                    onChangeImage={setModalIndex}
                  />
                </div>
                {currentModalPicture && (
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-medium text-foreground">
                        {locale === "zh"
                          ? currentModalPicture.translations.zh?.title || currentModalPicture.translations.en?.title
                          : currentModalPicture.translations.en?.title || currentModalPicture.translations.zh?.title || t("styleUntitled")}
                      </span>
                      <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground/80">
                        {t("styleFromSeries")}
                      </span>
                      <Link
                        href={`/work/${currentModalPicture.pictureSetId}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors"
                      >
                        {locale === "zh"
                          ? currentModalPicture.set.translations.zh?.title || currentModalPicture.set.translations.en?.title || currentModalPicture.set.title
                          : currentModalPicture.set.translations.en?.title || currentModalPicture.set.translations.zh?.title || currentModalPicture.set.title}
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                    {currentModalPicture.translations[locale as "en" | "zh"]?.description && (
                      <p className="text-sm leading-relaxed">
                        {currentModalPicture.translations[locale as "en" | "zh"]?.description}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                {t("styleEmpty")}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button variant="ghost" onClick={() => setSelectedStyleId(null)}>
                {t("close")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default PhotographyStyleShowcase
