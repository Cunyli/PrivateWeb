"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Image from "next/image"
import clsx from "clsx"
import { PHOTOGRAPHY_STYLES } from "@/lib/photography-styles"
import { useI18n } from "@/lib/i18n"
import { ArrowUpRight } from "lucide-react"
import { useRouter } from "next/navigation"
import portfolioImageLoader from "@/lib/portfolio-image-loader"
import { capturePortfolioPosition } from "@/lib/portfolio-return"
import { useReducedMotion } from "framer-motion"
import chrome from "./portfolio-chrome.module.css"
import { usePhotoCuration } from "./photo-curation-provider"
import { useElasticStyleSurface } from "./use-elastic-style-surface"

import type { StylePicture, StyleApiResponse } from "@/lib/photography-style-previews"
import { viewerPhotoSource } from "@/lib/viewer-photo-source"

const FALLBACK_DELAY_MS = 15_000
const DELAY_VARIANCE_MS = 6_000
const HOVER_INTENT_DELAY_MS = 90
const PREVIEW_QUALITY = 55
const PREVIEW_PREFETCH_WIDTH = 800
const PREVIEW_SIZES = "(min-width: 1280px) 25vw, (min-width: 768px) 45vw, 90vw"

let stylesPayloadVersion=""
let stylesPayloadPromise: Promise<Record<string, StyleApiResponse>> | null = null

const normalizeStylesPayload = (payload: Record<string, StyleApiResponse>) => {
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
  return normalized
}

const loadStylesPayload = async () => {
  const res = await fetch("/api/picture-styles?featured=1&preview=1")
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  const data = await res.json()
  return normalizeStylesPayload((data?.styles || {}) as Record<string, StyleApiResponse>)
}

export const preloadPhotographyStyles = (version="") => {
  if (typeof window === "undefined") return null
  if (stylesPayloadVersion!==version) {stylesPayloadPromise=null;stylesPayloadVersion=version}
  if (!stylesPayloadPromise) {
    stylesPayloadPromise = loadStylesPayload().catch((error) => {
      stylesPayloadPromise = null
      throw error
    })
  }
  return stylesPayloadPromise
}

export function PhotographyStyleShowcase({ paused = false, initialData }: { paused?: boolean; initialData?: Record<string,StyleApiResponse> }) {
  const { t, locale } = useI18n()
  const curation=usePhotoCuration()
  const version=useMemo(()=>`${curation.ids.join(",")}/${curation.featuredIds.join(",")}`,[curation])
  const sectionRef = useRef<HTMLElement>(null)
  const elasticStageRef = useRef<HTMLDivElement>(null)
  const elasticSurfaceRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const node = sectionRef.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "160px" })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const router = useRouter()
  const bucketUrl = useMemo(() => process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top", [])

  const [stylesData, setStylesData] = useState<Record<string, StyleApiResponse>>(initialData || {})
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const [activeStyle, setActiveStyle] = useState<string | null>(null)
  const [visibleIndex, setVisibleIndex] = useState<Record<string, number>>({})
  const fetchedVersion = useRef<string | null>(null)
  const rotationTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [landscapeMap, setLandscapeMap] = useState<Record<string, Record<number, boolean>>>({})
  const [, startHighlightTransition] = useTransition()
  const hoverTimerRef = useRef<number | null>(null)
  const prefetchedImagesRef = useRef<Set<string>>(new Set())
  const [hoveredMobileIndex, setHoveredMobileIndex] = useState<number | null>(null)
  const [activeMobileStyleId, setActiveMobileStyleId] = useState<string | null>(PHOTOGRAPHY_STYLES[0]?.id || null) // 当前可见的风格
  const scrollThrottleTimer = useRef<number | null>(null) // 滚动节流定时器

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
        if (!hasMasterTag(picture) || curation.ids.includes(picture.id) || !curation.featuredIds.includes(picture.id)) return
        const orientationValue = orientationMap[picture.id] ?? (picture.width && picture.height ? picture.width>=picture.height : undefined)
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
  }, [hasMasterTag, landscapeMap, stylesData,curation])

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
      const normalized = await (preloadPhotographyStyles(version) ?? loadStylesPayload())
      setStylesData(normalized)
      const nextVisible: Record<string, number> = {}
      for (const style of PHOTOGRAPHY_STYLES) {
        const pictures = normalized[style.id]?.pictures || []
        const previousId=initialData?.[style.id]?.pictures[0]?.id
        const preserved=pictures.findIndex(p=>p.id===previousId)
        nextVisible[style.id] = preserved>=0?preserved:pictures.length?0:-1
      }
      setVisibleIndex(nextVisible)
      setError(null)
    } catch (err: any) {
      console.error("Failed to load photography styles", err)
      setError(Object.values(initialData || {}).some(style=>style.pictures.length)?null:err?.message || "Failed to load styles")
    } finally {
      setLoading(false)
    }
  }, [initialData,version])

  useEffect(() => {
    if (fetchedVersion.current===version) return
    fetchedVersion.current = version
    fetchStyles().catch(() => {})
  }, [fetchStyles,version])

  useEffect(() => {
    if (!inView || reduced || paused) return
    // Clear existing timers before scheduling new ones
    Object.values(rotationTimers.current).forEach((timer) => clearTimeout(timer))
    rotationTimers.current = {}

    for (const style of PHOTOGRAPHY_STYLES) {
      const schedule = () => {
        const eligibleIndices = getEligibleIndices(style.id)
        if (eligibleIndices.length <= 1) return
        const delay = FALLBACK_DELAY_MS + Math.random() * DELAY_VARIANCE_MS
        rotationTimers.current[style.id] = setTimeout(() => {
          if (document.hidden) { schedule(); return }
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
  }, [getEligibleIndices, pickNextEligibleIndex, stylesData, inView, reduced, paused])

  const styleHref=useCallback((styleId:string)=>{
    const params=new URLSearchParams()
    params.set("origin",window.location.pathname==="/"?"home":"portfolio")
    const indices=getEligibleIndices(styleId)
    const preview=stylesData[styleId]?.pictures[visibleIndex[styleId] ?? indices[0]]
    if(preview)params.set("pictureId",String(preview.id))
    params.set("returnSection","styles");params.set("restore","1")
    return `/work/style/${styleId}?${params.toString()}`
  },[stylesData,visibleIndex,getEligibleIndices])
  const handleOpenStyle=useCallback((styleId:string)=>{
    capturePortfolioPosition();router.push(styleHref(styleId))
  },[router,styleHref])

  const prefetchPreview = useCallback((styleId: string | null, intent=false) => {
    if (typeof window === 'undefined') return
    if (!styleId) return
    const pictures = stylesData[styleId]?.pictures || []
    if (!pictures.length) return
    const eligible = getEligibleIndices(styleId)
    const candidateIdx = visibleIndex[styleId] ?? (eligible.length ? eligible[0] : 0)
    const candidate = pictures[candidateIdx]
    if (!candidate) return
    const src = candidate.imageUrl?.startsWith("http")
      ? candidate.imageUrl
      : `${bucketUrl}${candidate.imageUrl}`
    if (!src) return
    const optimizedSrc = portfolioImageLoader({ src, width: PREVIEW_PREFETCH_WIDTH })
    if (!prefetchedImagesRef.current.has(optimizedSrc)) {
    const img = new window.Image()
    img.decoding = "async"
    img.src = optimizedSrc
    prefetchedImagesRef.current.add(optimizedSrc)
    }
    if(!intent)return
    router.prefetch(styleHref(styleId))
    const display=viewerPhotoSource({id:candidate.id,url:candidate.imageUrl},bucketUrl,{width:window.innerWidth,height:window.innerHeight*.82,density:window.devicePixelRatio})
    if(display!==optimizedSrc && !prefetchedImagesRef.current.has(display)){
      const photo=new window.Image();photo.decoding="async";photo.fetchPriority="low";photo.src=display
      prefetchedImagesRef.current.add(display)
    }
  }, [bucketUrl, getEligibleIndices, stylesData,visibleIndex,router,styleHref])

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
      prefetchPreview(next,true)
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
    setVisibleIndex((prev) => {
      let changed = false
      const next = { ...prev }
      const usedPictureIds = new Set<number>()
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
        if (eligible.includes(current) && pictures[current] && !usedPictureIds.has(pictures[current].id)) {
          usedPictureIds.add(pictures[current].id)
          continue
        }
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

  const highlightStyleId = activeStyle ?? null

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
    const desiredIndex=visibleIndex[style.id] ?? eligible[0]
    const activeIndex = eligible.includes(desiredIndex)?desiredIndex:eligible[0] ?? -1
    const preview = activeIndex >= 0 ? pictures[activeIndex] : undefined
    const orientationMap = landscapeMap[style.id] || {}
    const previewOrientation = preview ? orientationMap[preview.id] : undefined
    const isActive = highlightStyleId === style.id
    const translateY = isActive ? "-8px" : "0px"
    const scale = activeStyle ? (isActive ? 1.035 : 0.98) : 1
    const hasContent = eligible.length > 0
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
      translateY,
      scale,
      hasContent,
      isFirst,
      isLast,
      previewOrientation,
    }
  })

  useElasticStyleSurface({ stage: elasticStageRef, surface: elasticSurfaceRef,
    enabled: inView && !paused && !reduced && !loadingState && !error })

  return (
    <section ref={sectionRef} className={chrome.section} data-performance-section="photography-styles">
      <div className="flex flex-col gap-4 md:gap-6">
        <h2 className="sr-only">{t("styleShowcaseTitle")}</h2>

        {loadingState && (
          <div className="grid gap-2.5 md:grid-cols-4">
            {PHOTOGRAPHY_STYLES.map((style) => (
              <div
                key={style.id}
                className="h-64 rounded-sm bg-gradient-to-br from-gray-200 via-gray-100 to-white animate-pulse"
              />
            ))}
          </div>
        )}

        {!loadingState && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {locale === "zh" ? "暂时无法载入，稍后再试。" : "Could not load this section. Please try again."}
            <button type="button" className="ml-3 underline" onClick={fetchStyles}>{locale === "zh" ? "重试" : "Retry"}</button>
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
                className="flex gap-0 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                style={{ WebkitOverflowScrolling: "touch", paddingLeft: "0.875rem", paddingRight: "0.875rem" }}
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
                    if (!container) {
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
                      

                    }
                  })
                }}
              >
                {styleCards.map(({ style, preview, hasContent, pictures, previewOrientation, isActive, isFirst, isLast }, cardIdx) => {
                  const isMobileActive = activeMobileStyleId === style.id
                  const shouldContain = previewOrientation === false && (isActive || isMobileActive)
                  const clipPath = isFirst
                    ? "polygon(0% 0, 100% 0, 94% 100%, 0% 100%)"
                    : isLast
                      ? "polygon(6% 0, 100% 0, 100% 100%, 0% 100%)"
                      : "polygon(6% 0, 100% 0, 94% 100%, 0% 100%)"
                  
                  return (
                  <button
                    key={`${style.id}-mobile`}
                    type="button"
                    onClick={() => handleOpenStyle(style.id)}
                    aria-label={locale === "zh" ? `浏览${t(style.i18nKey)}专栏` : `Explore ${t(style.i18nKey)}`}
                    disabled={!hasContent}
                    onTouchStart={() => {setActiveMobileStyleId(style.id);prefetchPreview(style.id,true)}}
                    className="snap-center relative inline-flex h-[320px] min-h-[320px] flex-shrink-0 overflow-hidden bg-slate-900 text-left shadow-[0_24px_70px_-42px_rgba(15,23,42,0.85)] transition-all duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:scale-[0.96]"
                    style={{
                      clipPath,
                      width: 'calc(100vw - 4rem)',
                      maxWidth: '300px',
                      marginRight: isLast ? '0' : '-10%',
                      marginLeft: isFirst ? '0' : '-10%',
                      transform: isMobileActive ? 'scale(1.015) translateY(-5px)' : 'scale(1) translateY(0)',
                      zIndex: isMobileActive ? 20 : 10 - cardIdx,
                    }}
                  >
                    <div className="absolute inset-0">
                      {preview ? (
                        <Image
                          key={`${style.id}-mobile-${preview.id}`}
                          src={preview.imageUrl ? (/^https?:/.test(preview.imageUrl)?preview.imageUrl:`${bucketUrl}${preview.imageUrl}`) : "/placeholder.svg"}
                          alt={preview.translations[locale as "zh" | "en"]?.title || preview.translations.en?.title || t(style.i18nKey)}
                          fill
                          quality={PREVIEW_QUALITY}
                          sizes={PREVIEW_SIZES}
                          // 图片优先级优化：第一张优先加载，第二张预加载，其余懒加载
                          priority={false}
                          loading={inView ? "eager" : "lazy"}
                          className={clsx(
                            "transition-all ease-out object-center",
                            shouldContain ? "object-contain" : "object-cover",
                            isMobileActive 
                              ? shouldContain ? "scale-100 duration-700" : "scale-[1.08] duration-700"
                              : shouldContain ? "scale-100 duration-1000" : "scale-[1.02] duration-1000"
                          )}
                          onLoad={(e) => {
                            const img = e.target as HTMLImageElement
                            updateOrientation(style.id, preview.id, img.naturalWidth, img.naturalHeight)
                          }}
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-slate-300 via-slate-200 to-white" />
                      )}
                      <div 
                        className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/75 transition-opacity duration-500"
                        style={{ opacity: isMobileActive ? 0.6 : 0.8 }}
                      />

                    </div>

                    <div className="relative z-10 flex h-full flex-col justify-between p-5 transition-all duration-500">
                      <div 
                        className="flex w-full items-center gap-3 text-white/70 transition-all duration-500"
                        style={{ 
                          opacity: isMobileActive ? 1 : 0.8,
                          transform: isMobileActive ? 'translateY(0)' : 'translateY(4px)'
                        }}
                      >
                      </div>
                      <div 
                        className="space-y-2 transition-all duration-500"
                        style={{ 
                          transform: isMobileActive ? 'translateY(0)' : 'translateY(8px)',
                          opacity: isMobileActive ? 1 : 0.9
                        }}
                      >
                        <h3 className="text-[1.55rem] font-medium tracking-[-.035em] text-white drop-shadow-xl">
                          {t(style.i18nKey)}
                        </h3>
                      </div>
                      <div 
                        className="flex w-full items-center gap-2 transition-all duration-500"
                        style={{ 
                          opacity: isMobileActive ? 1 : 0.8,
                          transform: isMobileActive ? 'translateX(0)' : 'translateX(-4px)'
                        }}
                      >
                        {!hasContent && (
                          <span className="text-[11px] uppercase tracking-[0.45em] text-white/80">
                            {t("styleEmpty")}
                          </span>
                        )}
                        <ArrowUpRight 
                          className="ml-auto h-4 w-4 text-white/85 transition-all duration-500" 
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
              <div className="flex justify-center items-center gap-2 mt-3">
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
                          const card = container.children[idx] as HTMLElement | undefined
                          if (!card) return
                          const left = container.scrollLeft + card.getBoundingClientRect().left - container.getBoundingClientRect().left - (container.clientWidth - card.clientWidth) / 2
                          container.scrollTo({ left, behavior: reduced ? "auto" : "smooth" })
                        }
                      }}
                      className="inline-flex h-11 w-11 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#657b6b]"
                      aria-current={isActive ? "true" : undefined}
                      aria-label={`${t(style.i18nKey)} ${idx + 1}/${PHOTOGRAPHY_STYLES.length}`}
                    ><span aria-hidden="true" className="h-[2px] transition-[width,background] duration-300" style={{ width: isActive ? 30 : 14, background: isActive ? "#516c5a" : "#c5c9bd" }} /></button>
                  )
                })}
              </div>
            </div>

            <div ref={elasticStageRef} className={chrome.styleElasticStage} data-style-elastic-stage>
              <div ref={elasticSurfaceRef} className={chrome.styleElasticSurface} data-style-elastic-surface>
              {styleCards.map(({ style, preview, hasContent, pictures, isFirst, isLast, isActive, translateY, scale, previewOrientation }, cardIdx) => {
                const clipPath = isFirst
                  ? "polygon(0% 0, 100% 0, 94% 100%, 0% 100%)"
                  : isLast
                    ? "polygon(6% 0, 100% 0, 100% 100%, 0% 100%)"
                    : "polygon(6% 0, 100% 0, 94% 100%, 0% 100%)"
                const shouldContain = previewOrientation === false && isActive

                return (
                  <button
                    key={style.id}
                    type="button"
                    data-style-card-index={cardIdx}
                    onMouseEnter={() => handleHighlightChange(style.id)}
                    onMouseLeave={() => handleHighlightChange(null)}
                    onFocus={() => handleHighlightChange(style.id)}
                    onBlur={() => handleHighlightChange(null)}
                    onClick={() => handleOpenStyle(style.id)}
                    aria-label={locale === "zh" ? `浏览${t(style.i18nKey)}专栏` : `Explore ${t(style.i18nKey)}`}
                    disabled={!hasContent}
                    className="group relative min-h-[320px] flex-1 bg-black/70 text-left transition-transform duration-500 transform-gpu"
                    style={{
                      clipPath,
                      marginRight: isLast ? undefined : "-5%",
                      marginLeft: isFirst ? undefined : "-5%",
                      zIndex: isActive ? 25 : 10,
                      transform: `translateY(${translateY}) scale(${scale})`,
                      transition: "transform 360ms cubic-bezier(0.24,1,0.32,1), box-shadow 360ms cubic-bezier(0.24,1,0.32,1)",
                      willChange: "transform",
                      contain: "paint",
                    }}
                  >
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute inset-0 origin-center overflow-hidden">
                        {preview ? (
                          <Image
                            key={`${style.id}-${preview.id}`}
                            src={preview.imageUrl ? (/^https?:/.test(preview.imageUrl)?preview.imageUrl:`${bucketUrl}${preview.imageUrl}`) : "/placeholder.svg"}
                            alt={preview.translations[locale as "zh" | "en"]?.title || preview.translations.en?.title || t(style.i18nKey)}
                            fill
                            draggable={false}
                            quality={PREVIEW_QUALITY}
                            sizes={PREVIEW_SIZES}
                            className={clsx(
                              "image-fade-soft transform-gpu transition-transform ease-out object-center",
                              shouldContain ? "object-contain" : "object-cover",
                              shouldContain ? "scale-100 group-hover:scale-100" : "scale-[1.02] group-hover:scale-[1.08]"
                            )}
                            style={{ willChange: "transform, opacity", transitionDuration: '1200ms' }}
                            priority={false}
                            loading={inView ? "eager" : "lazy"}
                            onLoad={(e) => {
                              const img = e.target as HTMLImageElement
                              updateOrientation(style.id, preview.id, img.naturalWidth, img.naturalHeight)
                            }}
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-slate-300 via-slate-200 to-white" />
                        )}
                        <div
                          className={`absolute inset-0 bg-gradient-to-br from-transparent via-black/10 to-black/70 transition-opacity duration-500 ${isActive ? "opacity-25" : "opacity-55"}`}
                          style={{ willChange: "opacity" }}
                        />
                      </div>
                    </div>

                    <div className="relative z-10 flex h-full flex-col justify-between px-6 py-8 md:px-8 md:py-10 space-y-6 transition-opacity duration-300 ease-out">
                      <div className="flex w-full items-center gap-3 text-white/70">
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-[1.9rem] md:text-[2.2rem] font-medium tracking-[-.035em] text-white drop-shadow-lg transition-transform duration-500 ease-out group-hover:-translate-y-[3px]">
                          {t(style.i18nKey)}
                        </h3>
                      </div>
                      <div className="flex w-full items-center gap-2">
                        {!hasContent && (
                          <span className="text-[11px] uppercase tracking-[0.45em] text-white/75 transition-transform duration-500 ease-out group-hover:translate-x-1">
                            {t("styleEmpty")}
                          </span>
                        )}
                        <ArrowUpRight className="ml-auto h-4 w-4 text-white/80 transition-transform duration-300 group-hover:translate-x-1.5 group-hover:-translate-y-1.5" />
                      </div>
                    </div>
                  </button>
                )
              })}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default PhotographyStyleShowcase
