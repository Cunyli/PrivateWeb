// components/PortfolioGrid.tsx
"use client"

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react"
import type { CSSProperties, MouseEvent, WheelEvent } from "react"
import { useI18n } from "@/lib/i18n"
import Image from "next/image"
import Link from "next/link"
import clsx from "clsx"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/utils/supabase"
import { ArrowLeft, ArrowUp, Search, X } from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"
import type { PictureSet, Picture } from "@/lib/pictureSet.types"
import { PortfolioLocationMap } from "@/components/portfolio-location-map"
import { LangSwitcher } from "@/components/lang-switcher"
import { PhotographyStyleShowcase } from "@/components/photography-style-showcase"
import { derivePortfolioBuckets, fallbackBuckets } from "@/lib/portfolio-order"
import type { InitialPortfolioPayload } from "@/lib/portfolioInitialData"
import portfolioImageLoader from "@/lib/portfolio-image-loader"
import entryStyles from "./portfolio-entry.module.css"
import chrome from "./portfolio-chrome.module.css"
import { PortfolioFooter } from "./portfolio-footer"
import { PortfolioPhotoSessions } from "./portfolio-photo-sessions"
import { capturePortfolioPosition, settlePortfolioAnchor } from "@/lib/portfolio-return"
import { balancedGalleryColumns, galleryCoverRatio } from "@/lib/portfolio-gallery-layout"
import { usePortfolioRibbon } from "./use-portfolio-ribbon"
import { usePhotoCuration } from "./photo-curation-provider"
import { withFeaturedCovers } from "@/lib/photo-curation-catalog"
import { curationVisible } from "@/lib/photo-curation"
import { photoSource } from "@/lib/portfolio-photo-source"
import { portfolioLocationLabel } from "@/lib/portfolio-location-label"

const DOWN_THUMB_PREFETCH_WIDTH = 640
const THUMB_MAX_RESPONSIVE_WIDTH = 640
const DOWN_IMAGE_SIZES =
  "(min-width: 2200px) 14rem, (min-width: 1800px) 16rem, (min-width: 1536px) 18rem, (min-width: 1024px) 24vw, (min-width: 640px) 33vw, 50vw"
const ROW_SCROLL_SPEED_PX_PER_SECOND = 32
const MIN_LOOPED_ROW_ITEMS = 12
const ribbonRatios = [1.4, 1.7, 1.5, 1.75, 1.3]
const ribbonCardStyle = (index: number, count: number, row: number): CSSProperties => {
  const position=index % count
  const phase=position/count*Math.PI*2*Math.max(1,Math.round(count/6))+row*Math.PI*.7
  return {
    ["--ribbon-ratio" as string]:ribbonRatios[position % ribbonRatios.length],
    ["--ribbon-y" as string]:`${(Math.sin(phase)*24).toFixed(2)}px`,
    ["--ribbon-tilt" as string]:`${(Math.cos(phase)*5).toFixed(2)}deg`,
    ["--ribbon-layer" as string]:Math.sin(phase)>.1?4-row:2+row,
    ["--ribbon-yaw" as string]:`${(Math.sin(phase)*7).toFixed(2)}deg`,
    ["--ribbon-pitch" as string]:`${row===0?-4:4}deg`,
    ["--ribbon-depth" as string]:`${(Math.cos(phase)*8).toFixed(2)}px`,
  }
}
const createLoopedRow = (row: PictureSet[]): PictureSet[] => {
  if (!row.length) return []
  const minCopies = Math.max(2, Math.ceil(MIN_LOOPED_ROW_ITEMS / row.length))
  const result: PictureSet[] = []
  for (let i = 0; i < minCopies; i++) {
    result.push(...row)
  }
  return result
}

const capResponsiveImageWidth = (src: string, maxWidth = THUMB_MAX_RESPONSIVE_WIDTH) => {
  if (!src.includes("/picture/responsive/")) return src
  const separator = src.includes("?") ? "&" : "?"
  return `${src}${separator}maxWidth=${maxWidth}`
}

const normalizeSearchInput = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()

const buildSearchTerms = (value: string) => {
  const normalized = normalizeSearchInput(value).toLowerCase()
  if (!normalized) return []
  const parts = normalized.split(" ").filter(Boolean)
  return Array.from(new Set([normalized, ...parts.filter((part) => part.length >= 2)]))
}

const escapeIlike = (value: string) =>
  value.replace(/[%_,()]/g, " ").replace(/\s+/g, " ").trim()

const buildSearchOrClause = (fields: string[], terms: string[]) =>
  fields.flatMap((field) => terms.map((term) => `${field}.ilike.%${escapeIlike(term)}%`)).join(",")

const dedupeById = <T extends { id: number }>(rows: T[]) => {
  const seen = new Set<number>()
  return rows.filter((row) => {
    if (seen.has(row.id)) return false
    seen.add(row.id)
    return true
  })
}

const SEMANTIC_SET_PROMOTION_STRONG_HITS = 3
const SEMANTIC_SET_PROMOTION_MIN_HITS = 2
const SEMANTIC_SET_PROMOTION_MIN_HIT_SHARE = 0.25
const SEMANTIC_SET_PROMOTION_MIN_SET_RATIO = 0.18

type SemanticSetPromotion = {
  setId: number
  hitCount: number
  hitShare: number
  setRatio: number
  bestRank: number
  score: number
}

type SearchReturnCache = {
  query: string
  setResults: PictureSet[]
  pictureResults: Picture[]
  transMap: Record<number, { en?: { title?: string; subtitle?: string; description?: string }, zh?: { title?: string; subtitle?: string; description?: string } }>
  pictureTransMap: Record<number, { en?: { title?: string; subtitle?: string; description?: string }, zh?: { title?: string; subtitle?: string; description?: string } }>
}

const buildSemanticSetPromotions = (
  semanticPictures: Picture[],
  pictureCountsBySet: Record<number, number>,
): SemanticSetPromotion[] => {
  if (!semanticPictures.length) return []

  const groups = new Map<number, { hitCount: number; bestRank: number }>()
  semanticPictures.forEach((picture, index) => {
    if (!Number.isFinite(picture.picture_set_id)) return
    const existing = groups.get(picture.picture_set_id)
    groups.set(picture.picture_set_id, {
      hitCount: (existing?.hitCount || 0) + 1,
      bestRank: Math.min(existing?.bestRank ?? index, index),
    })
  })

  const totalHits = semanticPictures.length
  return Array.from(groups.entries())
    .map(([setId, group]) => {
      const setPictureCount = Math.max(1, pictureCountsBySet[setId] || 0)
      const hitShare = group.hitCount / totalHits
      const setRatio = group.hitCount / setPictureCount
      return {
        setId,
        hitCount: group.hitCount,
        hitShare,
        setRatio,
        bestRank: group.bestRank,
        score: group.hitCount * 3 + hitShare * 4 + setRatio * 2 - group.bestRank * 0.05,
      }
    })
    .filter((promotion) =>
      promotion.hitCount >= SEMANTIC_SET_PROMOTION_STRONG_HITS
      || (
        promotion.hitCount >= SEMANTIC_SET_PROMOTION_MIN_HITS
        && (
          promotion.hitShare >= SEMANTIC_SET_PROMOTION_MIN_HIT_SHARE
          || promotion.setRatio >= SEMANTIC_SET_PROMOTION_MIN_SET_RATIO
        )
      ),
    )
    .sort((left, right) => right.score - left.score)
}

const normalizePictureSets = (
  rows: Array<Partial<PictureSet> | null | undefined>,
): PictureSet[] =>
  rows
    .filter((row): row is Partial<PictureSet> => Boolean(row) && (row as Partial<PictureSet>).is_published !== false)
    .map((row) => ({
      pictures: [],
      ...row,
    })) as PictureSet[]

interface PortfolioGridProps {
  initialData?: InitialPortfolioPayload
  embedded?: boolean
}

export function PortfolioGrid({ initialData, embedded = false }: PortfolioGridProps) {
  const { locale, t } = useI18n()
  const curation = usePhotoCuration()
  const searchParams = useSearchParams()
  const entryReturnHref = searchParams.get("from") === "photo-session" ? "/helsinki-photo-session" : "/"
  const [pictureSets, setPictureSets] = useState<PictureSet[]>(initialData?.pictureSets || [])
  const [loading, setLoading] = useState(!initialData)
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const [shuffledDownSets, setShuffledDownSets] = useState<PictureSet[]>(initialData?.downSets || [])
  const [derivedUpSets, setDerivedUpSets] = useState<PictureSet[]>(initialData?.upSets || [])
  // use global locale (zh prefers zh translations, else en)
  const [transMap, setTransMap] = useState<Record<number, { en?: { title?: string; subtitle?: string; description?: string }, zh?: { title?: string; subtitle?: string; description?: string } }>>(initialData?.transMap || {})
  const [searchQuery, setSearchQuery] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [searchRetry, setSearchRetry] = useState(0)
  const [setResults, setSetResults] = useState<PictureSet[] | null>(null)
  const [pictureResults, setPictureResults] = useState<Picture[] | null>(null)
  const [pictureTransMap, setPictureTransMap] = useState<Record<number, { en?: { title?: string; subtitle?: string; description?: string }, zh?: { title?: string; subtitle?: string; description?: string } }>>({})
  const [setLocations, setSetLocations] = useState<Record<number, { name?: string | null; name_en?: string | null; name_zh?: string | null; latitude: number; longitude: number }>>(initialData?.setLocations || {})
  const [searchOpen, setSearchOpen] = useState(false)
  const searchTriggerRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchResultsRef = useRef<HTMLDivElement>(null)
  const [pictureSearchDimensions, setPictureSearchDimensions] = useState<Record<number, { width: number; height: number }>>({})
  const topRowRef = useRef<HTMLDivElement>(null)
  const ribbonWeaveRef = useRef<HTMLDivElement>(null)
  const ribbonActiveRef = useRef(false)
  const bottomRowRef = useRef<HTMLDivElement>(null)
  const [galleryColumnCount, setGalleryColumnCount] = useState(4)
  const archiveRef = useRef<HTMLDivElement>(null)
  const [archiveMetrics, setArchiveMetrics] = useState({width: 1040, gap: 24})
  const [topRowPaused, setTopRowPaused] = useState(false)
  const [bottomRowPaused, setBottomRowPaused] = useState(false)
  const topRowMaxScrollRef = useRef(0)
  const bottomRowMaxScrollRef = useRef(0)
  const topRowScrollRef = useRef(0)
  const bottomRowScrollRef = useRef(0)
  const topRowResumeTimerRef = useRef<number | null>(null)
  const bottomRowResumeTimerRef = useRef<number | null>(null)
  const pageScrollRef = useRef<HTMLDivElement>(null)
  const restoreAppliedRef = useRef(false)
  const restoredSearchQueryRef = useRef<string | null>(null)
  const baseUrl = useMemo(() => process.env.NEXT_PUBLIC_BUCKET_URL || 'https://s3.cunyli.top', [])
  const resumeTopRow = useCallback(() => {
    if (ribbonActiveRef.current) return
    const row = topRowRef.current
    if ((row?.contains(document.activeElement) && document.activeElement?.matches(":focus-visible")) || (window.matchMedia("(hover: hover)").matches && row?.matches(":hover"))) return
    const current = topRowRef.current?.scrollLeft
    if (Number.isFinite(current)) topRowScrollRef.current = current || 0
    setTopRowPaused(false)
  }, [])
  const resumeBottomRow = useCallback(() => {
    if (ribbonActiveRef.current) return
    const row = bottomRowRef.current
    if ((row?.contains(document.activeElement) && document.activeElement?.matches(":focus-visible")) || (window.matchMedia("(hover: hover)").matches && row?.matches(":hover"))) return
    const current = bottomRowRef.current?.scrollLeft
    if (Number.isFinite(current)) bottomRowScrollRef.current = current || 0
    setBottomRowPaused(false)
  }, [])
  const forcePauseTopRow = useCallback(() => {
    if (topRowResumeTimerRef.current !== null) {
      window.clearTimeout(topRowResumeTimerRef.current)
      topRowResumeTimerRef.current = null
    }
    const current = topRowRef.current?.scrollLeft
    if (Number.isFinite(current)) topRowScrollRef.current = current || 0
    setTopRowPaused(true)
  }, [])
  const forcePauseBottomRow = useCallback(() => {
    if (bottomRowResumeTimerRef.current !== null) {
      window.clearTimeout(bottomRowResumeTimerRef.current)
      bottomRowResumeTimerRef.current = null
    }
    const current = bottomRowRef.current?.scrollLeft
    if (Number.isFinite(current)) bottomRowScrollRef.current = current || 0
    setBottomRowPaused(true)
  }, [])
  const scheduleResumeTopRow = useCallback(() => {
    if (topRowResumeTimerRef.current !== null) {
      window.clearTimeout(topRowResumeTimerRef.current)
    }
    topRowResumeTimerRef.current = window.setTimeout(() => {
      topRowResumeTimerRef.current = null
      resumeTopRow()
    }, 900)
  }, [resumeTopRow])
  const scheduleResumeBottomRow = useCallback(() => {
    if (bottomRowResumeTimerRef.current !== null) {
      window.clearTimeout(bottomRowResumeTimerRef.current)
    }
    bottomRowResumeTimerRef.current = window.setTimeout(() => {
      bottomRowResumeTimerRef.current = null
      resumeBottomRow()
    }, 900)
  }, [resumeBottomRow])
  const handleTopRowScroll = useCallback(() => {
    const current = topRowRef.current?.scrollLeft
    if (Number.isFinite(current)) topRowScrollRef.current = current || 0
    if (topRowPaused && !ribbonActiveRef.current) scheduleResumeTopRow()
  }, [scheduleResumeTopRow, topRowPaused])
  const handleBottomRowScroll = useCallback(() => {
    const current = bottomRowRef.current?.scrollLeft
    if (Number.isFinite(current)) bottomRowScrollRef.current = current || 0
    if (bottomRowPaused && !ribbonActiveRef.current) scheduleResumeBottomRow()
  }, [bottomRowPaused, scheduleResumeBottomRow])
  const handleTopRowWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
    forcePauseTopRow()
    scheduleResumeTopRow()
  }, [forcePauseTopRow, scheduleResumeTopRow])
  const handleBottomRowWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
    forcePauseBottomRow()
    scheduleResumeBottomRow()
  }, [forcePauseBottomRow, scheduleResumeBottomRow])
  const measureRowOverflow = useCallback((row: HTMLDivElement | null) => {
    if (typeof window === 'undefined' || !row) return 0
    const nativeOverflow = row.scrollWidth - row.clientWidth
    const count = Number(row.dataset.loopItems)
    const first = row.children[0] as HTMLElement | undefined
    const duplicate = row.children[count] as HTMLElement | undefined
    if (count > 0 && first && duplicate) return Math.min(nativeOverflow, duplicate.offsetLeft - first.offsetLeft)
    if (nativeOverflow > 1) return nativeOverflow
    const styles = window.getComputedStyle(row)
    const gapRaw = styles.columnGap || styles.gap || "0"
    const gap = Number.parseFloat(gapRaw) || 0
    const children = Array.from(row.children) as HTMLElement[]
    if (!children.length) return 0
    let totalChildWidth = 0
    for (const child of children) {
      const rect = child.getBoundingClientRect()
      const childStyle = window.getComputedStyle(child)
      const marginLeft = Number.parseFloat(childStyle.marginLeft) || 0
      const marginRight = Number.parseFloat(childStyle.marginRight) || 0
      totalChildWidth += rect.width + marginLeft + marginRight
    }
    const manualOverflow = totalChildWidth + gap * Math.max(0, children.length - 1) - row.clientWidth
    return Math.max(nativeOverflow, manualOverflow, 0)
  }, [])
  const updateRowScrollBounds = useCallback(() => {
    if (typeof window === 'undefined') return
    topRowMaxScrollRef.current = measureRowOverflow(topRowRef.current)
    bottomRowMaxScrollRef.current = measureRowOverflow(bottomRowRef.current)
  }, [measureRowOverflow])

  const fetchPictureSets = async () => {
    setLoading(true)
    try {
      console.log("Fetching picture sets for portfolio grid")
      const { data, error } = await supabase
        .from("picture_sets")
        .select("id, created_at, updated_at, cover_image_url, title, subtitle, description, position, is_published")
        .eq("is_published", true)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching picture sets:", error)
        setPictureSets([])
        setShuffledDownSets([])
      } else {
        console.log(`Found ${data?.length || 0} picture sets`)
        const normalizedSets = normalizePictureSets((data || []) as Partial<PictureSet>[])
        setPictureSets(normalizedSets)

        // Fetch both en and zh translations for display switching
        if (normalizedSets.length > 0) {
          const ids = normalizedSets.map((s) => s.id)
          const [{ data: enTrans }, { data: zhTrans }] = await Promise.all([
            supabase
              .from('picture_set_translations')
              .select('picture_set_id, title, subtitle, description, locale')
              .eq('locale', 'en')
              .in('picture_set_id', ids),
            supabase
              .from('picture_set_translations')
              .select('picture_set_id, title, subtitle, description, locale')
              .eq('locale', 'zh')
              .in('picture_set_id', ids),
          ])
          const map: Record<number, { en?: any; zh?: any }> = {}
          for (const t of enTrans || []) {
            map[t.picture_set_id] = {
              ...(map[t.picture_set_id] || {}),
              en: { title: (t as any).title || undefined, subtitle: (t as any).subtitle || undefined, description: (t as any).description || undefined },
            }
          }
          for (const t of zhTrans || []) {
            map[t.picture_set_id] = {
              ...(map[t.picture_set_id] || {}),
              zh: { title: (t as any).title || undefined, subtitle: (t as any).subtitle || undefined, description: (t as any).description || undefined },
            }
          }
          setTransMap(map)

          try {
            const { data: locRows, error: locErr } = await supabase
              .from('picture_set_locations')
              .select('picture_set_id, is_primary, location:locations(name, name_en, name_zh, latitude, longitude)')
              .in('picture_set_id', ids)
              .eq('is_primary', true)

            if (locErr) {
              console.warn('Fetch primary locations failed:', locErr)
              setSetLocations({})
            } else {
              const mapLoc: Record<number, { name?: string | null; name_en?: string | null; name_zh?: string | null; latitude: number; longitude: number }> = {}
              for (const row of locRows || []) {
                const loc = (row as any).location || (row as any).locations
                if (!loc) continue
                const lat = Number((loc as any).latitude)
                const lng = Number((loc as any).longitude)
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                  mapLoc[(row as any).picture_set_id] = {
                    name: (loc as any).name,
                    name_en: (loc as any).name_en,
                    name_zh: (loc as any).name_zh,
                    latitude: lat,
                    longitude: lng,
                  }
                }
              }
              setSetLocations(mapLoc)
            }
          } catch (locError) {
            console.warn('Failed to prepare map locations:', locError)
            setSetLocations({})
          }
        } else {
          setTransMap({})
          setSetLocations({})
        }

        // 根据 Sections 推导上下排（兼容 position）
        try {
          const ids = normalizedSets.map(s => s.id)
          const [{ data: assigns }, { data: secs }] = await Promise.all([
            supabase.from('picture_set_section_assignments').select('picture_set_id, section_id').in('picture_set_id', ids),
            supabase.from('sections').select('id,name')
          ])
          const { upCombined, downCombined } = derivePortfolioBuckets(normalizedSets, assigns || [], secs || [])
          setDerivedUpSets(upCombined)
          setShuffledDownSets(downCombined)
        } catch (e) {
          console.warn('Derive up/down by sections failed; fallback to position only', e)
          const { upCombined, downCombined } = fallbackBuckets(normalizedSets)
          setDerivedUpSets(upCombined)
          setShuffledDownSets(downCombined)
        }
      }
    } catch (error) {
      console.error("Error in fetchPictureSets:", error)
    } finally {
      setLoading(false)
    }
  }

  // Debounced search over sets and pictures
  useEffect(() => {
    const normalizedQuery = normalizeSearchInput(searchQuery)
    const searchTerms = buildSearchTerms(normalizedQuery)
    if (!normalizedQuery) {
      setSetResults(null)
      setPictureResults(null)
      setSearchLoading(false)
      setSearchError(false)
      return
    }
    if (restoredSearchQueryRef.current === normalizedQuery) {
      restoredSearchQueryRef.current = null
      setSearchLoading(false)
      return
    }
    let alive = true
    setSearchLoading(true)
    setSearchError(false)
    const t = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const setOrClause = buildSearchOrClause(["search_text"], searchTerms)
        const pictureOrClause = buildSearchOrClause(["search_text"], searchTerms)
        const translationOrClause = buildSearchOrClause(["title", "subtitle", "description"], searchTerms)

        const [
          setFts,
          setText,
          pictureFts,
          pictureText,
          setTransEn,
          setTransZh,
          pictureTransEn,
          pictureTransZh,
          semanticPictures,
        ] = await Promise.all([
          supabase
            .from("picture_sets")
            .select("*")
            .eq("is_published", true)
            .textSearch("search_vector", normalizedQuery, { type: "websearch", config: "english" })
            .order("updated_at", { ascending: false })
            .limit(80),
          supabase
            .from("picture_sets")
            .select("*")
            .eq("is_published", true)
            .or(setOrClause)
            .order("updated_at", { ascending: false })
            .limit(80),
          supabase
            .from("pictures")
            .select("*")
            .textSearch("search_vector", normalizedQuery, { type: "websearch", config: "english" })
            .order("updated_at", { ascending: false })
            .limit(100),
          supabase
            .from("pictures")
            .select("*")
            .or(pictureOrClause)
            .order("updated_at", { ascending: false })
            .limit(100),
          supabase
            .from("picture_set_translations")
            .select("picture_set_id")
            .eq("locale", "en")
            .or(translationOrClause)
            .limit(80),
          supabase
            .from("picture_set_translations")
            .select("picture_set_id")
            .eq("locale", "zh")
            .or(translationOrClause)
            .limit(80),
          supabase
            .from("picture_translations")
            .select("picture_id")
            .eq("locale", "en")
            .or(translationOrClause)
            .limit(100),
          supabase
            .from("picture_translations")
            .select("picture_id")
            .eq("locale", "zh")
            .or(translationOrClause)
            .limit(100),
          fetch(`/api/semantic-picture-search?q=${encodeURIComponent(normalizedQuery)}&limit=24&minSimilarity=0`)
            .then(async (response) => {
              if (!response.ok) {
                const payload = await response.json().catch(() => ({}))
                throw new Error(payload?.error || `Semantic search failed: ${response.status}`)
              }
              return response.json() as Promise<{ results?: Picture[] }>
            })
            .catch((error) => {
              console.warn("Semantic picture search error:", error)
              return { results: [] as Picture[] }
            }),
        ])

        if (setFts.error) console.warn("Set FTS error:", setFts.error)
        if (setText.error) console.warn("Set text search error:", setText.error)
        if (pictureFts.error) console.warn("Pic FTS error:", pictureFts.error)
        if (pictureText.error) console.warn("Pic text search error:", pictureText.error)
        if (setTransEn.error) console.warn("Set EN translation search error:", setTransEn.error)
        if (setTransZh.error) console.warn("Set ZH translation search error:", setTransZh.error)
        if (pictureTransEn.error) console.warn("Pic EN translation search error:", pictureTransEn.error)
        if (pictureTransZh.error) console.warn("Pic ZH translation search error:", pictureTransZh.error)

        const baseSets = dedupeById(
          normalizePictureSets([
            ...((setFts.data || []) as Partial<PictureSet>[]),
            ...((setText.data || []) as Partial<PictureSet>[]),
          ]),
        )
        const basePictures = dedupeById([
          ...((semanticPictures.results || []) as Picture[]),
          ...((pictureFts.data || []) as Picture[]),
          ...((pictureText.data || []) as Picture[]),
        ])
        const semanticPictureResults = (semanticPictures.results || []) as Picture[]
        const semanticSetIds = Array.from(
          new Set(
            semanticPictureResults
              .map((picture) => picture.picture_set_id)
              .filter((id): id is number => Number.isFinite(id)),
          ),
        )

        const setIdsFromTranslations = Array.from(
          new Set([
            ...((setTransEn.data || []).map((row: any) => row.picture_set_id)),
            ...((setTransZh.data || []).map((row: any) => row.picture_set_id)),
          ].filter((id): id is number => Number.isFinite(id))),
        )
        const pictureIdsFromTranslations = Array.from(
          new Set([
            ...((pictureTransEn.data || []).map((row: any) => row.picture_id)),
            ...((pictureTransZh.data || []).map((row: any) => row.picture_id)),
          ].filter((id): id is number => Number.isFinite(id))),
        )

        const missingSetIds = setIdsFromTranslations.filter((id) => !baseSets.some((item) => item.id === id))
        const missingPictureIds = pictureIdsFromTranslations.filter((id) => !basePictures.some((item) => item.id === id))

        const [extraSetsRes, extraPicturesRes, semanticSetPicturesRes] = await Promise.all([
          missingSetIds.length
            ? supabase.from("picture_sets").select("*").in("id", missingSetIds).eq("is_published", true).order("updated_at", { ascending: false }).limit(80)
            : Promise.resolve({ data: [] as any[], error: null }),
          missingPictureIds.length
            ? supabase.from("pictures").select("*").in("id", missingPictureIds).order("updated_at", { ascending: false }).limit(100)
            : Promise.resolve({ data: [] as any[], error: null }),
          semanticSetIds.length
            ? supabase.from("pictures").select("id,picture_set_id").in("picture_set_id", semanticSetIds)
            : Promise.resolve({ data: [] as any[], error: null }),
        ])

        if ("error" in extraSetsRes && extraSetsRes.error) console.warn("Extra set fetch error:", extraSetsRes.error)
        if ("error" in extraPicturesRes && extraPicturesRes.error) console.warn("Extra picture fetch error:", extraPicturesRes.error)
        if ("error" in semanticSetPicturesRes && semanticSetPicturesRes.error) console.warn("Semantic set picture count fetch error:", semanticSetPicturesRes.error)

        const pictureCountsBySet = (semanticSetPicturesRes.data || []).reduce<Record<number, number>>((acc, row: any) => {
          const setId = Number(row.picture_set_id)
          if (Number.isFinite(setId)) {
            acc[setId] = (acc[setId] || 0) + 1
          }
          return acc
        }, {})
        const semanticSetPromotions = buildSemanticSetPromotions(semanticPictureResults, pictureCountsBySet)
        const promotedSetIds = semanticSetPromotions.map((promotion) => promotion.setId)
        const missingPromotedSetIds = promotedSetIds.filter((id) =>
          !baseSets.some((item) => item.id === id)
          && !(extraSetsRes.data || []).some((item: any) => item.id === id),
        )
        const promotedSetsRes = missingPromotedSetIds.length
          ? await supabase.from("picture_sets").select("*").in("id", missingPromotedSetIds).eq("is_published", true).order("updated_at", { ascending: false }).limit(80)
          : { data: [] as any[], error: null }
        if (promotedSetsRes.error) console.warn("Promoted semantic set fetch error:", promotedSetsRes.error)

        const promotedSetRank = new Map(semanticSetPromotions.map((promotion, index) => [promotion.setId, index]))
        const promotedSets = normalizePictureSets([
          ...baseSets.filter((set) => promotedSetRank.has(set.id)),
          ...((extraSetsRes.data || []) as Partial<PictureSet>[]).filter((set) => promotedSetRank.has(Number(set.id))),
          ...((promotedSetsRes.data || []) as Partial<PictureSet>[]),
        ]).sort((left, right) => (promotedSetRank.get(left.id) ?? 999) - (promotedSetRank.get(right.id) ?? 999))

        const sets = dedupeById([
          ...promotedSets,
          ...baseSets,
          ...normalizePictureSets((extraSetsRes.data || []) as Partial<PictureSet>[]),
        ])
        const publishedPortfolioSetIds = new Set(
          [...pictureSets, ...sets]
            .filter((set) => set.is_published !== false)
            .map((set) => set.id),
        )
        const pics = dedupeById([
          ...basePictures,
          ...((extraPicturesRes.data || []) as Picture[]),
        ]).filter((picture) => publishedPortfolioSetIds.has(picture.picture_set_id))

        if (!alive) return
        setSetResults(sets)
        setPictureResults(pics.filter(picture=>curationVisible(curation,picture)))

        // Fetch translations for sets in results
        const setIds = sets.map((s) => s.id)
        if (setIds.length > 0) {
          const [{ data: enTrans }, { data: zhTrans }] = await Promise.all([
            supabase.from('picture_set_translations').select('picture_set_id, title, subtitle, description').eq('locale', 'en').in('picture_set_id', setIds),
            supabase.from('picture_set_translations').select('picture_set_id, title, subtitle, description').eq('locale', 'zh').in('picture_set_id', setIds),
          ])
          if (alive) {
            setTransMap((prev) => {
              const map: Record<number, any> = { ...prev }
              for (const t of enTrans || []) {
                map[(t as any).picture_set_id] = { ...(map[(t as any).picture_set_id] || {}), en: { title: (t as any).title || undefined, subtitle: (t as any).subtitle || undefined, description: (t as any).description || undefined } }
              }
              for (const t of zhTrans || []) {
                map[(t as any).picture_set_id] = { ...(map[(t as any).picture_set_id] || {}), zh: { title: (t as any).title || undefined, subtitle: (t as any).subtitle || undefined, description: (t as any).description || undefined } }
              }
              return map
            })
          }
        }

        // Fetch translations for pictures in results
        const picIds = pics.map((p) => p.id)
        if (picIds.length > 0) {
          const [{ data: pen }, { data: pzh }] = await Promise.all([
            supabase.from('picture_translations').select('picture_id, title, subtitle, description').eq('locale', 'en').in('picture_id', picIds),
            supabase.from('picture_translations').select('picture_id, title, subtitle, description').eq('locale', 'zh').in('picture_id', picIds),
          ])
          const pmap: Record<number, any> = {}
          for (const t of pen || []) pmap[(t as any).picture_id] = { ...(pmap[(t as any).picture_id] || {}), en: { title: (t as any).title || undefined, subtitle: (t as any).subtitle || undefined, description: (t as any).description || undefined } }
          for (const t of pzh || []) pmap[(t as any).picture_id] = { ...(pmap[(t as any).picture_id] || {}), zh: { title: (t as any).title || undefined, subtitle: (t as any).subtitle || undefined, description: (t as any).description || undefined } }
          if (alive) setPictureTransMap(pmap)
        } else {
          if (alive) setPictureTransMap({})
        }

      } catch (e) {
        console.error('Search error', e)
        if (alive) setSearchError(true)
      } finally {
        if (alive) setSearchLoading(false)
      }
    }, 350)
    return () => { alive = false; clearTimeout(t) }
  }, [pictureSets, searchQuery, searchRetry])

  useEffect(() => {
    if (initialData) return
    fetchPictureSets()
  }, [initialData])

  // Monitor scroll position to show/hide scroll to top button
  useEffect(() => {
    const node = pageScrollRef.current
    if (!node) return
    const handleScroll = () => {
      setShowScrollToTop(embedded ? node.getBoundingClientRect().top < -300 : node.scrollTop > 300)
    }

    const scrollTarget = embedded ? window : node
    scrollTarget.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => scrollTarget.removeEventListener("scroll", handleScroll)
  }, [embedded])

  const upPictureSets = useMemo(() => withFeaturedCovers(derivedUpSets,curation).filter(set=>set.cover_image_url),[derivedUpSets,curation])
  const downPictureSets = useMemo(() => withFeaturedCovers(shuffledDownSets,curation).filter(set=>set.cover_image_url),[shuffledDownSets,curation])
  // Keep unrated collections reachable without inventing a photographic cover.
  const coverlessSets = useMemo(() => withFeaturedCovers(pictureSets,curation).filter(set=>!set.cover_image_url),[pictureSets,curation])

  const { firstRow, secondRow } = useMemo(() => {
    const midpoint = Math.ceil(upPictureSets.length / 2)
    return {
      firstRow: upPictureSets.slice(0, midpoint),
      secondRow: upPictureSets.slice(midpoint),
    }
  }, [upPictureSets])
  const loopedFirstRow = useMemo(() => createLoopedRow(firstRow), [firstRow])
  const loopedSecondRow = useMemo(() => createLoopedRow(secondRow), [secondRow])
  const pauseRibbon = useCallback(() => { forcePauseTopRow(); forcePauseBottomRow() }, [forcePauseTopRow, forcePauseBottomRow])
  const resumeRibbon = useCallback(() => { resumeTopRow(); resumeBottomRow() }, [resumeTopRow, resumeBottomRow])
  usePortfolioRibbon({root:ribbonWeaveRef, top:topRowRef, bottom:bottomRowRef,
    topPosition:topRowScrollRef, bottomPosition:bottomRowScrollRef, topCycle:topRowMaxScrollRef, bottomCycle:bottomRowMaxScrollRef,
    active:ribbonActiveRef, pause:pauseRibbon, resume:resumeRibbon, disabled:searchOpen, revision:upPictureSets})
  useEffect(() => {
    updateRowScrollBounds()
  }, [updateRowScrollBounds, loopedFirstRow.length, loopedSecondRow.length])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('resize', updateRowScrollBounds)
    return () => window.removeEventListener('resize', updateRowScrollBounds)
  }, [updateRowScrollBounds])

  useEffect(() => {
    return () => {
      if (topRowResumeTimerRef.current !== null) {
        window.clearTimeout(topRowResumeTimerRef.current)
      }
      if (bottomRowResumeTimerRef.current !== null) {
        window.clearTimeout(bottomRowResumeTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (typeof ResizeObserver === 'undefined') return
    const top = topRowRef.current
    const bottom = bottomRowRef.current
    if (!top && !bottom) return
    const observer = new ResizeObserver(() => updateRowScrollBounds())
    if (top) observer.observe(top)
    if (bottom) observer.observe(bottom)
    return () => observer.disconnect()
  }, [updateRowScrollBounds])

  const handlePictureSearchImageLoaded = useCallback((id: number, width?: number, height?: number) => {
    if (width && height) {
      setPictureSearchDimensions((prev) => {
        if (prev[id]) return prev
        return { ...prev, [id]: { width, height } }
      })
    }
  }, [])

  useEffect(() => {
    if (!loopedFirstRow.length && !loopedSecondRow.length) return
    if (!topRowRef.current && !bottomRowRef.current) return

    let animationFrameId = 0, lastTime = 0, rowsVisible = false
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const gate = embedded ? document.getElementById("works") : null
    const visibleRows = new Set<Element>()
    const active = () => rowsVisible && (!topRowPaused || !bottomRowPaused) && !searchOpen && !document.hidden && !motion.matches && !gate?.hasAttribute("inert")
    const tick = (now: number) => {
      animationFrameId = 0
      if (!active()) return
      const delta = lastTime ? Math.min(now - lastTime, 80) : 0
      lastTime = now
      const distance = delta * ROW_SCROLL_SPEED_PX_PER_SECOND / 1000
      const top = topRowRef.current, bottom = bottomRowRef.current
      const maxTop = topRowMaxScrollRef.current, maxBottom = bottomRowMaxScrollRef.current
      if (top && loopedFirstRow.length && maxTop > .5 && !topRowPaused && !ribbonActiveRef.current) {
        const next = topRowScrollRef.current + distance
        topRowScrollRef.current = next % maxTop
        top.scrollLeft = topRowScrollRef.current
      }
      if (bottom && loopedSecondRow.length && maxBottom > .5 && !bottomRowPaused && !ribbonActiveRef.current) {
        const next = bottomRowScrollRef.current - distance
        bottomRowScrollRef.current = ((next % maxBottom) + maxBottom) % maxBottom
        bottom.scrollLeft = bottomRowScrollRef.current
      }
      animationFrameId = requestAnimationFrame(tick)
    }
    const sync = () => {
      if (active() && !animationFrameId) { lastTime = 0; animationFrameId = requestAnimationFrame(tick) }
      else if (!active() && animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = 0; lastTime = 0 }
    }
    const rowObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) visibleRows.add(entry.target); else visibleRows.delete(entry.target) })
      rowsVisible = visibleRows.size > 0
      sync()
    })
    if (topRowRef.current) rowObserver.observe(topRowRef.current)
    if (bottomRowRef.current) rowObserver.observe(bottomRowRef.current)
    const gateObserver = new MutationObserver(sync)
    if (gate) gateObserver.observe(gate, { attributes: true, attributeFilter: ["inert"] })
    motion.addEventListener("change", sync)
    document.addEventListener("visibilitychange", sync)
    return () => {
      cancelAnimationFrame(animationFrameId)
      rowObserver.disconnect(); gateObserver.disconnect()
      motion.removeEventListener("change", sync)
      document.removeEventListener("visibilitychange", sync)
    }
  }, [embedded, loopedFirstRow.length, loopedSecondRow.length, topRowPaused, bottomRowPaused, searchOpen])

  useEffect(() => {
    if (!loopedFirstRow.length) return
    const top = topRowRef.current
    if (!top) return
    top.scrollLeft = 0
    topRowScrollRef.current = 0
    topRowMaxScrollRef.current = measureRowOverflow(top)
  }, [loopedFirstRow.length, measureRowOverflow])

  useEffect(() => {
    const bottom = bottomRowRef.current
    if (!loopedSecondRow.length || !bottom) return
    const maxScroll = measureRowOverflow(bottom)
    bottomRowMaxScrollRef.current = maxScroll
    const start = maxScroll > 0 ? maxScroll / 2 : 0
    bottomRowScrollRef.current = start
    bottom.scrollLeft = start
  }, [loopedSecondRow.length, measureRowOverflow])

  const scrollToTop = () => {
    const scrollTarget = embedded ? window : pageScrollRef.current
    const top = embedded ? document.getElementById("works")?.offsetTop || 0 : 0
    scrollTarget?.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
  }

  useEffect(() => {
    const open = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.defaultPrevented || (embedded && document.getElementById("works")?.hasAttribute("inert"))) return
      if (document.querySelector('[role="dialog"]') && !searchOpen) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(value => !value); return }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === "/" && !target?.closest('input,textarea,select,[contenteditable="true"]')) { event.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener("keydown", open)
    return () => window.removeEventListener("keydown", open)
  }, [embedded, searchOpen])

  const savePortfolioReturnState = useCallback((anchor?: HTMLElement) => {
    restoreAppliedRef.current = false
    capturePortfolioPosition(anchor)
    window.sessionStorage.setItem("portfolio:return-search-open", searchOpen ? "1" : "0")
    window.sessionStorage.setItem("portfolio:return-search-query", searchQuery)
    window.sessionStorage.setItem("portfolio:return-search-scroll", String(searchResultsRef.current?.scrollTop ?? 0))
    if (searchOpen && searchQuery.trim()) {
      const cache: SearchReturnCache = {
        query: searchQuery,
        setResults: setResults || [],
        pictureResults: pictureResults || [],
        transMap,
        pictureTransMap,
      }
      try {
        window.sessionStorage.setItem("portfolio:return-search-cache", JSON.stringify(cache))
      } catch (error) {
        console.warn("Could not cache portfolio search results:", error)
      }
    }
  }, [embedded, pictureResults, pictureTransMap, searchOpen, searchQuery, setResults, transMap])

  const handlePortfolioNavigation = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    savePortfolioReturnState(event.currentTarget)
  }, [savePortfolioReturnState])

  const buildWorkHref = useCallback((setId: number | string, opts?: { index?: number | null; pictureId?: number | null }) => {
    const params = new URLSearchParams()
    params.set("origin", embedded ? "home" : "portfolio")
    params.set("returnSet", String(setId))
    if (typeof opts?.pictureId === "number" && Number.isFinite(opts.pictureId)) {
      params.set("pictureId", String(opts.pictureId))
    }
    if (typeof opts?.index === "number" && Number.isFinite(opts.index)) {
      params.set("index", String(opts.index))
    }
    return `/work/${Number(setId)===0?"selected":setId}?${params.toString()}`
  }, [embedded])

  const buildSearchBrowseHref = useCallback((picture: Picture) => {
    const params = new URLSearchParams()
    params.set("origin", embedded ? "home" : "portfolio")
    params.set("returnSet", String(picture.picture_set_id))
    params.set("pictureId", String(picture.id))
    const orderedPictureIds = (pictureResults || []).map((item) => item.id).filter(Number.isFinite)
    params.set("pictureIds", (orderedPictureIds.length ? orderedPictureIds : [picture.id]).join(","))
    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim())
    }
    return `/work/search?${params.toString()}`
  }, [embedded, pictureResults, searchQuery])

  useEffect(() => {
    if (restoreAppliedRef.current || loading) return
    const returnPath = window.sessionStorage.getItem("portfolio:return-path")
    const matchingReturn = returnPath === (embedded ? "/" : "/portfolio") || (!returnPath && !embedded)

    const wantsRestore = searchParams.get("restore") === "1"
    const focusSet = searchParams.get("focusSet")
    const focusSection = searchParams.get("focusSection")
    const hasPendingReturn = typeof window !== "undefined"
      ? matchingReturn && window.sessionStorage.getItem("portfolio:return-pending") === "1"
      : false
    if (!wantsRestore && !focusSet && !focusSection && !hasPendingReturn) return

    restoreAppliedRef.current = true

    const run = () => {
      const node = pageScrollRef.current
      if (!node) return

      const storedScrollTop = typeof window !== "undefined"
        ? window.sessionStorage.getItem("portfolio:return-scroll")
        : null
      const storedSearchOpen = typeof window !== "undefined"
        ? window.sessionStorage.getItem("portfolio:return-search-open") === "1"
        : false
      const storedSearchQuery = typeof window !== "undefined"
        ? window.sessionStorage.getItem("portfolio:return-search-query") || ""
        : ""
      const storedSearchScroll = typeof window !== "undefined"
        ? Number(window.sessionStorage.getItem("portfolio:return-search-scroll"))
        : 0
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("portfolio:return-pending")
      }
      const shouldRestoreReturnState = matchingReturn && (wantsRestore || hasPendingReturn)

      if (shouldRestoreReturnState && storedSearchOpen) {
        const cachedSearch = (() => {
          if (typeof window === "undefined") return null
          const raw = window.sessionStorage.getItem("portfolio:return-search-cache")
          if (!raw) return null
          try {
            return JSON.parse(raw) as Partial<SearchReturnCache>
          } catch (error) {
            console.warn("Could not restore portfolio search cache:", error)
            return null
          }
        })()
        if (
          cachedSearch?.query === storedSearchQuery
          && Array.isArray(cachedSearch.setResults)
          && Array.isArray(cachedSearch.pictureResults)
        ) {
          restoredSearchQueryRef.current = normalizeSearchInput(storedSearchQuery)
          setSetResults(cachedSearch.setResults)
          setPictureResults(cachedSearch.pictureResults.filter(picture=>curationVisible(curation,picture)))
          setTransMap((prev) => ({ ...prev, ...(cachedSearch.transMap || {}) }))
          setPictureTransMap(cachedSearch.pictureTransMap || {})
          setSearchLoading(false)
        }
        setSearchQuery(storedSearchQuery)
        setSearchOpen(true)
        window.setTimeout(() => {
          if (searchResultsRef.current && Number.isFinite(storedSearchScroll)) {
            searchResultsRef.current.scrollTop = storedSearchScroll
          }
          searchInputRef.current?.focus({ preventScroll: true })
        }, 450)
      }

      if (shouldRestoreReturnState && storedScrollTop) {
        const value = Number(storedScrollTop)
        if (Number.isFinite(value)) {
          const scrollTarget = embedded ? window : node
          const topRowScroll = Number(window.sessionStorage.getItem("portfolio:return-top-row-scroll"))
          const bottomRowScroll = Number(window.sessionStorage.getItem("portfolio:return-bottom-row-scroll"))
          if (topRowRef.current && Number.isFinite(topRowScroll)) {
            topRowRef.current.scrollLeft = topRowScroll
            topRowScrollRef.current = topRowScroll
          }
          if (bottomRowRef.current && Number.isFinite(bottomRowScroll)) {
            bottomRowRef.current.scrollLeft = bottomRowScroll
            bottomRowScrollRef.current = bottomRowScroll
          }
          const width = Number(window.sessionStorage.getItem("portfolio:return-width"))
          const height = Number(window.sessionStorage.getItem("portfolio:return-height"))
          const resized = Math.abs(width - window.innerWidth) > 8 || Math.abs(height - window.innerHeight) > 80
          const anchor = window.sessionStorage.getItem("portfolio:return-anchor")
          const section = window.sessionStorage.getItem("portfolio:return-section")
          const scope = section ? node.querySelector(`[data-return-section="${CSS.escape(section)}"]`) || node : node
          const focusTarget = focusSet && (resized || anchor !== focusSet)
            ? scope.querySelector<HTMLElement>(`[data-set-id="${CSS.escape(focusSet)}"]`) || (section === "coordinates" ? null : node.querySelector<HTMLElement>(`[data-set-id="${CSS.escape(focusSet)}"]`)) : null
          node.dataset.returnMode = focusTarget ? "focus" : "position"
          node.dataset.returnViewport = `${width}x${height}`
          if (focusTarget) {
            focusTarget.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" })
            const minimum = embedded ? document.getElementById("works")?.offsetTop || 0 : 0
            if (embedded && window.scrollY < minimum) window.scrollTo({ top: minimum, behavior: "auto" })
            const row = focusTarget.closest<HTMLDivElement>("[data-portfolio-row]")
            if (row) {
              const left = row.scrollLeft + focusTarget.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - focusTarget.clientWidth) / 2
              row.scrollLeft = left
              if (row.dataset.portfolioRow === "top") { topRowScrollRef.current = row.scrollLeft; forcePauseTopRow() }
              else { bottomRowScrollRef.current = row.scrollLeft; forcePauseBottomRow() }
            }
            requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }))
          } else if (resized && section === "coordinates") {
            scope.scrollIntoView({ block: "start", behavior: "auto" })
          } else if (resized && focusSection) {
            node.querySelector(`[data-return-section="${CSS.escape(focusSection)}"]`)?.scrollIntoView({ block: "start", behavior: "auto" })
          } else {
            const minimum = embedded ? document.getElementById("works")?.offsetTop || 0 : 0
            scrollTarget.scrollTo({ top: Math.max(minimum, value), behavior: "auto" })
            const anchorTop=window.sessionStorage.getItem("portfolio:return-anchor-top")
            const positionAnchor=!resized && anchor?scope.querySelector<HTMLElement>(`[data-set-id="${CSS.escape(anchor)}"]`):null
            if (positionAnchor && anchorTop) settlePortfolioAnchor(node,positionAnchor,Number(anchorTop),embedded)
          }
          return
        }
      }

      if (focusSet) {
        const target = node.querySelector(`[data-set-id="${CSS.escape(focusSet)}"]`) as HTMLElement | null
        target?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" })
        const minimum = embedded ? document.getElementById("works")?.offsetTop || 0 : 0
        if (embedded && window.scrollY < minimum) window.scrollTo({ top: minimum, behavior: "auto" })
        return
      }

      if (focusSection) {
        const target = node.querySelector(`[data-return-section="${CSS.escape(focusSection)}"]`) as HTMLElement | null
        target?.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" })
      }
    }

    requestAnimationFrame(() => requestAnimationFrame(run))
  }, [embedded, loading, searchParams, forcePauseTopRow, forcePauseBottomRow])

  const getText = useCallback((s: PictureSet, key: 'title' | 'subtitle' | 'description') => {
    if(s.id===0)return key==='title'?(locale==='zh'?'精选':'Selected'):''
    const translations = transMap[s.id]
    if (locale === 'zh') return translations?.zh?.[key] || s[key]
    return translations?.en?.[key] || s[key]
  }, [locale, transMap])

  const getPicText = useCallback((p: Picture, key: 'title' | 'subtitle' | 'description') => {
    const translations = pictureTransMap[p.id]
    if (locale === 'zh') return translations?.zh?.[key] || (p as any)[key]
    return translations?.en?.[key] || (p as any)[key]
  }, [locale, pictureTransMap])

  const locationClusters = useMemo(() => {
    const buckets = new Map<string, { key: string; name: string; latitude: number; longitude: number; sets: Array<{ id: number; title: string; subtitle?: string; coverUrl: string }> }>()
    for (const set of withFeaturedCovers(pictureSets,curation)) {
      const loc = setLocations[set.id]
      if (!loc) continue
      const lat = Number(loc.latitude)
      const lng = Number(loc.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const bucketKey = `${lat.toFixed(3)}:${lng.toFixed(3)}`

      const locationName = portfolioLocationLabel(loc, locale, t("mapUnknownLocation"))

      const existing = buckets.get(bucketKey) || {
        key: bucketKey,
        name: locationName,
        latitude: lat,
        longitude: lng,
        sets: [],
      }
      const title = getText(set, 'title') || set.title || t('mapUntitledSet')
      const subtitle = getText(set, 'subtitle') || set.subtitle || undefined
      existing.sets.push({
        id: set.id,
        title,
        subtitle,
        coverUrl: set.cover_image_url ? capResponsiveImageWidth(photoSource(set.cover_image_url,baseUrl,640)) : '',
      })
      buckets.set(bucketKey, existing)
    }

    return Array.from(buckets.values()).map((bucket) => ({
      ...bucket,
      sets: bucket.sets.sort((a, b) => a.title.localeCompare(b.title)),
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [pictureSets, setLocations, baseUrl, getText, t, locale, curation])

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1280px)")
    const medium = window.matchMedia("(min-width: 900px)")
    const landscape = window.matchMedia("(max-height: 520px) and (min-width: 641px)")
    const updateColumns = () => setGalleryColumnCount(landscape.matches ? 3 : wide.matches ? 4 : medium.matches ? 3 : 2)
    const queries = [wide, medium, landscape]
    updateColumns()
    queries.forEach(query => query.addEventListener("change", updateColumns))
    return () => queries.forEach(query => query.removeEventListener("change", updateColumns))
  }, [])

  useEffect(() => {
    const node = archiveRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width
      const gap = Number.parseFloat(getComputedStyle(node).columnGap) || 0
      if (width > 0) setArchiveMetrics(previous => Math.abs(previous.width - width) < .5 && previous.gap === gap ? previous : {width, gap})
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [loading])

  const galleryColumns = useMemo(() => balancedGalleryColumns(downPictureSets, galleryColumnCount, archiveMetrics.width, archiveMetrics.gap),
    [downPictureSets, galleryColumnCount, archiveMetrics])

  useEffect(() => {
    const root=pageScrollRef.current
    if (!root || loading) return
    const groups=root.querySelectorAll<HTMLElement>("[data-gallery-float-group]")
    if (!groups.length) return
    const visible=() => {root.dataset.galleryAwake=String(!document.hidden)}
    const observer=new IntersectionObserver(entries => {
      entries.forEach(entry => { (entry.target as HTMLElement).dataset.inView=String(entry.isIntersecting) })
    },{rootMargin:"80px"})
    groups.forEach(group => {group.dataset.inView="false";observer.observe(group)})
    visible();document.addEventListener("visibilitychange",visible)
    return () => {observer.disconnect();document.removeEventListener("visibilitychange",visible);delete root.dataset.galleryAwake}
  },[loading,galleryColumns])

  const downGallerySection = !loading && downPictureSets.length > 0 && (
    <section className={chrome.section} data-return-section="collections">
      <h2 className="sr-only">{t("downGalleryTitle")}</h2>
      <div className="flex justify-center w-full">
        <div className={chrome.archive}>
          <div ref={archiveRef} className={chrome.archiveColumns} style={{gridTemplateColumns: `repeat(${galleryColumnCount}, minmax(0, 1fr))`}}>
            {galleryColumns.map((column,columnIndex) => <div key={columnIndex} className={chrome.archiveColumn} data-gallery-column={columnIndex}
              style={{"--archive-inner-gap":`${column.innerGap}px`, "--archive-group-gap":`${column.groupGap}px`, "--archive-offset":`${column.offset}px`} as CSSProperties}>
            {Array.from({length:Math.ceil(column.items.length/2)},(_,pairIndex) => {
              const pair=column.items.slice(pairIndex*2,pairIndex*2+2)
              const groupIndex=pairIndex*galleryColumnCount+columnIndex
              const direction=groupIndex%2===0?1:-1
              return <div key={pair[0].id} className={chrome.archiveFloatGroup} data-gallery-float-group
                style={{["--drift-from" as string]:`${-16*direction}px`,["--drift-to" as string]:`${16*direction}px`,["--drift-duration" as string]:`${11+groupIndex%5*1.7}s`,["--drift-delay" as string]:`${-(groupIndex%4)*2.1}s`}}>
                {pair.map(item => {
                  const coverSrc=item.cover_image_url?capResponsiveImageWidth(photoSource(item.cover_image_url,baseUrl,640)):"/placeholder.svg"
                  return <Link key={item.id} href={buildWorkHref(item.id)} prefetch={false} data-set-id={item.id} data-featured-collection={item.id===0 || undefined} data-cover-id={item.id===0?curation.selectedCover?.id:curation.covers[item.id]?.id}
                    onClick={handlePortfolioNavigation} className={clsx(chrome.archiveTile,"group block relative overflow-hidden")}
                    aria-label={[getText(item,"title"),getText(item,"subtitle")].filter(Boolean).join(" · ")}>
                    {item.cover_image_url?<img src={portfolioImageLoader({src:coverSrc,width:DOWN_THUMB_PREFETCH_WIDTH})} alt="" width={640} height={Math.round(640/galleryCoverRatio(item))}
                      loading="lazy" decoding="async" draggable={false} className="block h-auto w-full" />:<span className={chrome.emptyCollection}>{getText(item,"title")}</span>}
                    <div className={chrome.tileCaption}><h3>{getText(item,"title")}</h3><p>{getText(item,"subtitle")}</p></div>
                  </Link>
                })}
              </div>
            })}
            </div>)}
          </div>
        </div>
      </div>

    </section>
  )

  return (
    <div ref={pageScrollRef} data-portfolio-scroll-root data-embedded={embedded || undefined} data-gallery-paused={searchOpen || undefined} className={clsx(chrome.gallery, embedded ? entryStyles.gallery : chrome.standalone)}>
      <section data-portfolio-content className={chrome.content}>
        <header className={chrome.header}>
          <div className={chrome.headingGroup}>
            {!embedded && <Link href={entryReturnHref} className={chrome.control} aria-label={entryReturnHref === "/helsinki-photo-session" ? (locale === "zh" ? "返回约拍" : "Back to photo sessions") : (locale === "zh" ? "返回首页" : "Back to home")}><ArrowLeft size={18} strokeWidth={1.4} /></Link>}
            {embedded ? <h2 className="sr-only">{t('galleriesTitle')}</h2> : <h1 className="sr-only">{t('galleriesTitle')}</h1>}
          </div>
          <div className={chrome.controls}>
            <LangSwitcher />
            <button ref={searchTriggerRef} type="button" onClick={() => setSearchOpen(true)} className={chrome.control} aria-label={t('openSearch')} title={t('search')}>
              <Search size={18} strokeWidth={1.4} aria-hidden="true" />
            </button>
          </div>
        </header>

      <Dialog.Root open={searchOpen} onOpenChange={setSearchOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={chrome.searchOverlay} />
          <Dialog.Content className={chrome.searchPanel}
            onOpenAutoFocus={event => { event.preventDefault(); searchInputRef.current?.focus({ preventScroll: true }) }}
            onCloseAutoFocus={event => { event.preventDefault(); searchTriggerRef.current?.focus({ preventScroll: true }) }}>
            <Dialog.Title className="sr-only">{t('search')}</Dialog.Title>
            <Dialog.Description className="sr-only">{locale === "zh" ? "搜索地点、颜色或画面，选择照片开始浏览。" : "Search a place, colour or scene, then choose a photograph."}</Dialog.Description>
            <div className={chrome.searchBar}>
              <Search size={20} strokeWidth={1.4} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  type="search"
                  autoComplete="off"
                  aria-label={t('search')}
                  placeholder={t('homeSearchPlaceholder')}
                  className={chrome.searchInput}
                />
                {searchQuery && (
                  <button type="button" className={chrome.searchClear} onClick={() => { setSearchQuery(""); searchInputRef.current?.focus({ preventScroll: true }) }}>{t('clear')}</button>
                )}
              <Dialog.Close asChild><button type="button" className={chrome.control} aria-label={t('close')}><X size={18} strokeWidth={1.4} /></button></Dialog.Close>
            </div>
            <div ref={searchResultsRef} className={chrome.searchResults}>
              <div className={chrome.searchStatus} role="status" aria-live="polite">
                {searchLoading ? t('searching') : searchQuery.trim() && !searchError ? `${setResults?.length || 0} ${locale === "zh" ? "本相册" : "collections"} · ${pictureResults?.length || 0} ${locale === "zh" ? "张照片" : "photographs"}` : t('search')}
              </div>
              {!searchQuery.trim() ? <div className={chrome.searchEmpty}>
                <p>{locale === "zh" ? "地点、颜色、天气，都可以搜。" : "Search by place, colour, weather, or what you remember."}</p>
                <div className={chrome.suggestions}>{(locale === "zh" ? ["巴黎", "雨天", "海边"] : ["Paris", "Rain", "By the sea"]).map(query => <button key={query} type="button" onClick={() => { setSearchQuery(query); searchInputRef.current?.focus({ preventScroll: true }) }}>{query}</button>)}</div>
              </div> : searchError ? <div className={chrome.searchEmpty} role="alert"><p>{locale === "zh" ? "暂时没能完成搜索，请再试一次。" : "Search could not finish. Please try again."}</p><div className={chrome.suggestions}><button type="button" onClick={() => setSearchRetry(value => value + 1)}>{locale === "zh" ? "重新搜索" : "Try again"}</button></div></div> : <>
                {/* Results list */}
                <div className="flex flex-col gap-7">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{t('setMatchesHdr')}</h2>

                    </div>
                    {(setResults?.length || 0) === 0 ? (
                      <p className="text-sm text-gray-500">{searchLoading ? '…' : t('noMatchingSets')}</p>
                    ) : (
                      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 hide-scrollbar sm:gap-4">
                        {withFeaturedCovers(setResults || [],curation).map((item) => (
                          <Link
                            key={item.id}
                            href={buildWorkHref(item.id)}
                            data-set-id={item.id} data-featured-collection={item.id===0 || undefined} data-cover-id={item.id===0?curation.selectedCover?.id:curation.covers[item.id]?.id}
                            onClick={handlePortfolioNavigation}
                            className="group relative aspect-[16/9] w-[78%] flex-none snap-start overflow-hidden rounded-lg bg-slate-100 shadow-sm transition-transform duration-300 ease-out hover:-translate-y-0.5 sm:w-[46%] md:w-[34%] lg:w-[27%] xl:w-[22%]"
                          >
                            {item.cover_image_url?<Image
                              src={item.cover_image_url ? capResponsiveImageWidth(photoSource(item.cover_image_url,baseUrl,640)) : "/placeholder.svg"}
                              alt=""
                              fill
                              quality={65}
                              sizes="(max-width: 640px) 78vw, (max-width: 768px) 46vw, (max-width: 1024px) 34vw, 22vw"
                              className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                            />:<span className={chrome.emptyCollection}>{getText(item,"title")}</span>}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/35 to-transparent px-3 pb-3 pt-10 text-white">
                              <div className="line-clamp-1 text-sm font-medium drop-shadow-sm sm:text-base">{getText(item, 'title')}</div>
                              <div className="line-clamp-1 text-xs text-white/78 drop-shadow-sm">{getText(item, 'subtitle')}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{t('pictureMatchesHdr')}</h2>

                    </div>
                    {(pictureResults?.length || 0) === 0 ? (
                      <p className="text-sm text-gray-500">{searchLoading ? '…' : t('noMatchingPictures')}</p>
                    ) : (
                      <div className="columns-2 sm:columns-3 lg:columns-4 2xl:columns-5 [column-fill:balance] [column-gap:0.5rem] sm:[column-gap:0.75rem]">
                        {(pictureResults || []).map((p) => {
                          const dims = pictureSearchDimensions[p.id]

                          return (
                            <Link
                              key={p.id}
                              href={buildSearchBrowseHref(p)}
                              prefetch={false}
                              data-set-id={p.picture_set_id}
                              onClick={handlePortfolioNavigation}
                              aria-label={getPicText(p, 'title') || `${t('pictureMatchesHdr')} ${p.id}`}
                              className="mb-2 inline-block w-full overflow-hidden rounded-lg align-top shadow-sm sm:mb-3 [break-inside:avoid] [page-break-inside:avoid] [-webkit-column-break-inside:avoid]"
                            >
                              <div className="overflow-hidden">
                                <Image
                                  src={p.image_url ? capResponsiveImageWidth(`${baseUrl}${p.image_url}`) : "/placeholder.svg"}
                                  alt={getPicText(p, 'title')}
                                  width={dims?.width || 400}
                                  height={dims?.height || 250}
                                  quality={60}
                                  sizes="(max-width: 640px) 47vw, (max-width: 1024px) 31vw, (max-width: 1536px) 24vw, 19vw"
                                  className="h-auto w-full object-cover"
                                  onLoad={(e) => {
                                    const img = e.target as HTMLImageElement
                                    handlePictureSearchImageLoaded(p.id, img.naturalWidth, img.naturalHeight)
                                  }}
                                />
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex flex-col gap-6 sm:gap-12 flex-1">
        {loading ? (
          <>
            <div className="space-y-4">
              <div className="h-36 sm:h-44 rounded-2xl bg-gray-100 animate-pulse" />
              <div className="h-36 sm:h-44 rounded-2xl bg-gray-100 animate-pulse" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-48 sm:h-64 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* 上部两行自动滚动 - 移动端优化 */}
            {firstRow.length > 0 && (
              <div ref={ribbonWeaveRef} className={chrome.ribbonWeave} data-ribbon-surface role="region" aria-label={locale === "zh" ? "可拖动的摄影作品" : "Draggable photography collections"}>
                <div
                  ref={topRowRef}
                  data-portfolio-row="top"
                  data-loop-items={firstRow.length}
                  className={clsx(chrome.ribbonRow,"flex overflow-x-auto hide-scrollbar w-full")}
                  onScroll={handleTopRowScroll}
                  onWheel={handleTopRowWheel}
                >
                  {loopedFirstRow.map((item, i) => {
                    const tileStyle = ribbonCardStyle(i,firstRow.length,0)
                    const eager = i < Math.min(6, firstRow.length)

                    return (
                      <Link
                        key={`${item.id}-${i}`}
                        href={buildWorkHref(item.id)}
                        draggable={false}
                        data-set-id={item.id} data-featured-collection={item.id===0 || undefined} data-cover-id={item.id===0?curation.selectedCover?.id:curation.covers[item.id]?.id}
                        tabIndex={i >= firstRow.length ? -1 : 0} aria-hidden={i >= firstRow.length || undefined}
                        onClick={handlePortfolioNavigation}
                        style={tileStyle}
                        className={clsx(chrome.tile,"group relative flex-none overflow-hidden bg-gray-100")}
                      >
                      {item.cover_image_url?<Image
                        src={item.cover_image_url ? capResponsiveImageWidth(photoSource(item.cover_image_url,baseUrl,640)) : "/placeholder.svg"}
                        alt=""
                        draggable={false}
                        fill
                        quality={60}
                        fetchPriority={eager ? "high" : "auto"}
                        sizes="(max-width: 640px) 160px, 240px"
                        className="object-cover"
                        priority={eager}
                        loading={eager ? "eager" : "lazy"}
                      />:<span className={chrome.emptyCollection}>{getText(item,"title")}</span>}

                        <div className={chrome.tileCaption}>
                          <h3>{getText(item, 'title')}</h3>
                          <p>{getText(item, 'subtitle')}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>

                {/* 第二行 */}
                {loopedSecondRow.length > 0 && (
                  <div
                    ref={bottomRowRef}
                    data-portfolio-row="bottom"
                    data-loop-items={secondRow.length}
                    className={clsx(chrome.ribbonRow,"flex overflow-x-auto hide-scrollbar w-full")}
                    onScroll={handleBottomRowScroll}
                    onWheel={handleBottomRowWheel}
                              >
                    {loopedSecondRow.map((item, i) => {
                      const tileStyle = ribbonCardStyle(i,secondRow.length,1)
                      const eager = i < Math.min(6, secondRow.length)

                      return (
                        <Link
                          key={`${item.id}-${i}`}
                          href={buildWorkHref(item.id)}
                        draggable={false}
                          data-set-id={item.id} data-featured-collection={item.id===0 || undefined} data-cover-id={item.id===0?curation.selectedCover?.id:curation.covers[item.id]?.id}
                        tabIndex={i >= secondRow.length ? -1 : 0} aria-hidden={i >= secondRow.length || undefined}
                          onClick={handlePortfolioNavigation}
                          style={tileStyle}
                        className={clsx(chrome.tile,"group relative flex-none overflow-hidden bg-gray-100")}
                        >
                        {item.cover_image_url?<Image
                          src={item.cover_image_url ? capResponsiveImageWidth(photoSource(item.cover_image_url,baseUrl,640)) : "/placeholder.svg"}
                          alt=""
                          draggable={false}
                          fill
                          quality={60}
                          fetchPriority={eager ? "high" : "auto"}
                          sizes="(max-width: 640px) 160px, 240px"
                          className="object-cover"
                          priority={eager}
                          loading={eager ? "eager" : "lazy"}
                          />:<span className={chrome.emptyCollection}>{getText(item,"title")}</span>}

                          <div className={chrome.tileCaption}>
                          <h3>{getText(item, 'title')}</h3>
                          <p>{getText(item, 'subtitle')}</p>
                        </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {!loading && (
        <section data-portfolio-section="styles" data-return-section="styles">
        <Suspense fallback={<div className="py-8 text-center text-gray-500">Loading...</div>}>
          <PhotographyStyleShowcase paused={searchOpen} />
        </Suspense>
        </section>
      )}

      {!loading && <PortfolioPhotoSessions paused={searchOpen} />}

      {locationClusters.length > 0 && (
        <section className={chrome.section} data-return-section="coordinates">
          <PortfolioLocationMap
            locations={locationClusters}
            heading={t('mapSectionTitle')}
            subheading={t('mapSectionSubtitle')}
            emptyLabel={t('mapEmptyCallout')}
            viewAllLabel={t('mapViewAll')}
          />
        </section>
      )}

      {downGallerySection}

      {!loading && coverlessSets.length>0 && <nav className={chrome.collectionIndex} aria-label={locale==="zh"?"更多系列":"More collections"}>
        {coverlessSets.map(item=><Link key={item.id} href={buildWorkHref(item.id)} prefetch={false}
          data-text-collection={item.id} onClick={handlePortfolioNavigation}>
          {getText(item,"title")} <span aria-hidden="true">↗</span>
        </Link>)}
      </nav>}

      <PortfolioFooter />
      </section>

      {/* Scroll to top button */}
      {showScrollToTop && (
        <button
          type="button" onClick={scrollToTop}
          className={chrome.topButton}
          aria-label={locale === "zh" ? "回到作品列表顶部" : "Back to the top of the gallery"}
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
