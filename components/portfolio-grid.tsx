// components/PortfolioGrid.tsx
"use client"

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react"
import type { CSSProperties } from "react"
import { useI18n } from "@/lib/i18n"
import Image from "next/image"
import Link from "next/link"
import clsx from "clsx"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/utils/supabase"
import { ArrowUp } from "lucide-react"
import type { PictureSet, Picture } from "@/lib/pictureSet.types"
import { PortfolioLocationMap } from "@/components/portfolio-location-map"
import { LangSwitcher } from "@/components/lang-switcher"
import { PhotographyStyleShowcase } from "@/components/photography-style-showcase"
import { derivePortfolioBuckets, fallbackBuckets } from "@/lib/portfolio-order"
import type { InitialPortfolioPayload } from "@/lib/portfolioInitialData"

const DEFAULT_DOWN_TILE_ASPECT_RATIO = 3 / 4
const INITIAL_DOWN_LIMIT = 8
const DOWN_PREFETCH_LIMIT = 16
const DOWN_THUMB_QUALITY = 45
const DOWN_THUMB_PREFETCH_WIDTH = 640
const DOWN_DIMENSION_PREFETCH_WIDTH = 64
const DOWN_DIMENSION_PREFETCH_QUALITY = 30
const DOWN_IMAGE_SIZES =
  "(min-width: 2200px) 14rem, (min-width: 1800px) 16rem, (min-width: 1536px) 18rem, (min-width: 1024px) 24vw, (min-width: 640px) 33vw, 50vw"
const SCROLL_SPEED = 0.85
const MIN_LOOPED_ROW_ITEMS = 12
const widthPattern = ["w-[15%]", "w-[25%]", "w-[20%]", "w-[25%]", "w-[15%]"]
const getTileWidthClass = (index: number) => widthPattern[index % widthPattern.length]
const createLoopedRow = (row: PictureSet[]): PictureSet[] => {
  if (!row.length) return []
  const minCopies = Math.max(2, Math.ceil(MIN_LOOPED_ROW_ITEMS / row.length))
  const result: PictureSet[] = []
  for (let i = 0; i < minCopies; i++) {
    result.push(...row)
  }
  return result
}

const buildOptimizedImageUrl = (src: string, width: number, quality: number) =>
  `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`

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

const normalizePictureSets = (
  rows: Array<Partial<PictureSet> | null | undefined>,
): PictureSet[] =>
  rows
    .filter((row): row is Partial<PictureSet> => Boolean(row))
    .map((row) => ({
      pictures: [],
      ...row,
    })) as PictureSet[]

interface PortfolioGridProps {
  initialData?: InitialPortfolioPayload
}

export function PortfolioGrid({ initialData }: PortfolioGridProps) {
  const { locale, t } = useI18n()
  const searchParams = useSearchParams()
  const [pictureSets, setPictureSets] = useState<PictureSet[]>(initialData?.pictureSets || [])
  const [loading, setLoading] = useState(!initialData)
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const [shuffledDownSets, setShuffledDownSets] = useState<PictureSet[]>(initialData?.downSets || [])
  const [derivedUpSets, setDerivedUpSets] = useState<PictureSet[]>(initialData?.upSets || [])
  // use global locale (zh prefers zh translations, else en)
  const [transMap, setTransMap] = useState<Record<number, { en?: { title?: string; subtitle?: string; description?: string }, zh?: { title?: string; subtitle?: string; description?: string } }>>(initialData?.transMap || {})
  const [searchQuery, setSearchQuery] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [setResults, setSetResults] = useState<PictureSet[] | null>(null)
  const [pictureResults, setPictureResults] = useState<Picture[] | null>(null)
  const [pictureTransMap, setPictureTransMap] = useState<Record<number, { en?: { title?: string; subtitle?: string; description?: string }, zh?: { title?: string; subtitle?: string; description?: string } }>>({})
  const [setLocations, setSetLocations] = useState<Record<number, { name?: string | null; name_en?: string | null; name_zh?: string | null; latitude: number; longitude: number }>>(initialData?.setLocations || {})
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const topRowRef = useRef<HTMLDivElement>(null)
  const bottomRowRef = useRef<HTMLDivElement>(null)
  const pointerInteractedRef = useRef(false)
  const [topRowPaused, setTopRowPaused] = useState(false)
  const [bottomRowPaused, setBottomRowPaused] = useState(false)
  const topRowMaxScrollRef = useRef(0)
  const bottomRowMaxScrollRef = useRef(0)
  const topRowScrollRef = useRef(0)
  const bottomRowScrollRef = useRef(0)
  const pageScrollRef = useRef<HTMLDivElement>(null)
  const restoreAppliedRef = useRef(false)
  const baseUrl = useMemo(() => process.env.NEXT_PUBLIC_BUCKET_URL || 'https://s3.cunyli.top', [])
  const [coverDimensions, setCoverDimensions] = useState<Record<number, { width: number; height: number }>>({})
  const downPrefetchedRef = useRef<Set<string>>(new Set())
  const downPrefetchQueueRef = useRef<string[]>([])
  const downPrefetchingRef = useRef(false)
  const downDimensionQueuedRef = useRef<Set<number>>(new Set())
  const downDimensionQueueRef = useRef<Array<{ id: number; url: string }>>([])
  const downDimensionPrefetchingRef = useRef(false)
  const [activeVideoIndex, setActiveVideoIndex] = useState(0)
  const pauseTopRow = useCallback(() => {
    if (!pointerInteractedRef.current) return
    setTopRowPaused(true)
  }, [])
  const resumeTopRow = useCallback(() => setTopRowPaused(false), [])
  const pauseBottomRow = useCallback(() => {
    if (!pointerInteractedRef.current) return
    setBottomRowPaused(true)
  }, [])
  const resumeBottomRow = useCallback(() => setBottomRowPaused(false), [])
  const forcePauseTopRow = useCallback(() => {
    pointerInteractedRef.current = true
    setTopRowPaused(true)
  }, [])
  const forcePauseBottomRow = useCallback(() => {
    pointerInteractedRef.current = true
    setBottomRowPaused(true)
  }, [])
  const measureRowOverflow = useCallback((row: HTMLDivElement | null) => {
    if (typeof window === 'undefined' || !row) return 0
    const nativeOverflow = row.scrollWidth - row.clientWidth
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
      return
    }
    let alive = true
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
        ] = await Promise.all([
          supabase
            .from("picture_sets")
            .select("*")
            .textSearch("search_vector", normalizedQuery, { type: "websearch", config: "english" })
            .order("updated_at", { ascending: false })
            .limit(80),
          supabase
            .from("picture_sets")
            .select("*")
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
          ...((pictureFts.data || []) as Picture[]),
          ...((pictureText.data || []) as Picture[]),
        ])

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

        const [extraSetsRes, extraPicturesRes] = await Promise.all([
          missingSetIds.length
            ? supabase.from("picture_sets").select("*").in("id", missingSetIds).order("updated_at", { ascending: false }).limit(80)
            : Promise.resolve({ data: [] as any[], error: null }),
          missingPictureIds.length
            ? supabase.from("pictures").select("*").in("id", missingPictureIds).order("updated_at", { ascending: false }).limit(100)
            : Promise.resolve({ data: [] as any[], error: null }),
        ])

        if ("error" in extraSetsRes && extraSetsRes.error) console.warn("Extra set fetch error:", extraSetsRes.error)
        if ("error" in extraPicturesRes && extraPicturesRes.error) console.warn("Extra picture fetch error:", extraPicturesRes.error)

        const sets = dedupeById([
          ...baseSets,
          ...normalizePictureSets((extraSetsRes.data || []) as Partial<PictureSet>[]),
        ])
        const pics = dedupeById([
          ...basePictures,
          ...((extraPicturesRes.data || []) as Picture[]),
        ])

        if (!alive) return
        setSetResults(sets)
        setPictureResults(pics)

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
      } finally {
        if (alive) setSearchLoading(false)
      }
    }, 350)
    return () => { alive = false; clearTimeout(t) }
  }, [searchQuery])

  useEffect(() => {
    if (initialData) return
    fetchPictureSets()
  }, [initialData])

  // Monitor scroll position to show/hide scroll to top button
  useEffect(() => {
    const node = pageScrollRef.current
    if (!node) return
    const handleScroll = () => {
      setShowScrollToTop(node.scrollTop > 300)
    }

    node.addEventListener("scroll", handleScroll)
    return () => node.removeEventListener("scroll", handleScroll)
  }, [])

  const upPictureSets = derivedUpSets
  // 直接使用状态中的洗牌结果，不再进行额外洗牌
  const downPictureSets = shuffledDownSets

  const { firstRow, secondRow } = useMemo(() => {
    const midpoint = Math.ceil(upPictureSets.length / 2)
    return {
      firstRow: upPictureSets.slice(0, midpoint),
      secondRow: upPictureSets.slice(midpoint),
    }
  }, [upPictureSets])
  const loopedFirstRow = useMemo(() => createLoopedRow(firstRow), [firstRow])
  const loopedSecondRow = useMemo(() => createLoopedRow(secondRow), [secondRow])
  const downEagerCount = useMemo(
    () => Math.min(downPictureSets.length, INITIAL_DOWN_LIMIT),
    [downPictureSets.length],
  )

  const processDownPrefetch = useCallback(() => {
    if (typeof window === 'undefined') return
    if (downPrefetchingRef.current) return
    const url = downPrefetchQueueRef.current.shift()
    if (!url) return
    downPrefetchingRef.current = true
    const img = new window.Image()
    img.decoding = 'async'
    img.onload = img.onerror = () => {
      downPrefetchingRef.current = false
      processDownPrefetch()
    }
    img.src = url
  }, [])

  const enqueueDownPrefetch = useCallback((url: string) => {
    if (!url) return
    if (downPrefetchedRef.current.has(url)) return
    downPrefetchedRef.current.add(url)
    downPrefetchQueueRef.current.push(url)
    if (typeof window !== 'undefined') {
      const idle = (window as any).requestIdleCallback
      if (typeof idle === 'function') {
        idle(() => processDownPrefetch())
      } else {
        window.setTimeout(processDownPrefetch, 50)
      }
    }
  }, [processDownPrefetch])

  const processDownDimensionPrefetch = useCallback(() => {
    if (typeof window === "undefined") return
    if (downDimensionPrefetchingRef.current) return
    const next = downDimensionQueueRef.current.shift()
    if (!next) return

    downDimensionPrefetchingRef.current = true
    const img = new window.Image()
    img.decoding = "async"
    img.onload = img.onerror = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setCoverDimensions((prev) => {
          if (prev[next.id]) return prev
          return {
            ...prev,
            [next.id]: {
              width: img.naturalWidth,
              height: img.naturalHeight,
            },
          }
        })
      }
      downDimensionPrefetchingRef.current = false
      processDownDimensionPrefetch()
    }
    img.src = next.url
  }, [])

  const enqueueDownDimensionPrefetch = useCallback((id: number, url: string) => {
    if (!url) return
    if (downDimensionQueuedRef.current.has(id)) return
    downDimensionQueuedRef.current.add(id)
    downDimensionQueueRef.current.push({ id, url })
    if (typeof window !== "undefined") {
      const idle = (window as any).requestIdleCallback
      if (typeof idle === "function") {
        idle(() => processDownDimensionPrefetch())
      } else {
        window.setTimeout(processDownDimensionPrefetch, 16)
      }
    }
  }, [processDownDimensionPrefetch])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const conn = (navigator as any).connection
    if (conn?.saveData) return
    if (conn?.effectiveType && ['slow-2g', '2g'].includes(conn.effectiveType)) return

    const bufferCount = Math.min(DOWN_PREFETCH_LIMIT, downPictureSets.length)
    const candidates = downPictureSets.slice(0, bufferCount)
    for (const item of candidates) {
      if (!item.cover_image_url) continue
      const src = `${baseUrl}${item.cover_image_url}`
      enqueueDownPrefetch(buildOptimizedImageUrl(src, DOWN_THUMB_PREFETCH_WIDTH, DOWN_THUMB_QUALITY))
    }
  }, [downPictureSets, baseUrl, enqueueDownPrefetch])

  useEffect(() => {
    if (typeof window === "undefined") return
    const conn = (navigator as any).connection
    if (conn?.saveData) return
    if (conn?.effectiveType && ["slow-2g", "2g"].includes(conn.effectiveType)) return

    for (const item of downPictureSets) {
      if (!item.cover_image_url) continue
      if (coverDimensions[item.id]) continue
      const src = `${baseUrl}${item.cover_image_url}`
      enqueueDownDimensionPrefetch(
        item.id,
        buildOptimizedImageUrl(src, DOWN_DIMENSION_PREFETCH_WIDTH, DOWN_DIMENSION_PREFETCH_QUALITY),
      )
    }
  }, [downPictureSets, baseUrl, coverDimensions, enqueueDownDimensionPrefetch])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePointerActivity = () => {
      pointerInteractedRef.current = true
    }
    window.addEventListener('pointerdown', handlePointerActivity, { passive: true })
    window.addEventListener('pointermove', handlePointerActivity, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', handlePointerActivity)
      window.removeEventListener('pointermove', handlePointerActivity)
    }
  }, [])

  useEffect(() => {
    updateRowScrollBounds()
  }, [updateRowScrollBounds, loopedFirstRow.length, loopedSecondRow.length])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('resize', updateRowScrollBounds)
    return () => window.removeEventListener('resize', updateRowScrollBounds)
  }, [updateRowScrollBounds])

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

  const handleDownImageLoaded = useCallback((id: number, width?: number, height?: number) => {
    if (width && height) {
      setCoverDimensions((prev) => {
        if (prev[id]) return prev
        return { ...prev, [id]: { width, height } }
      })
    }
  }, [])

  useEffect(() => {
    if (!loopedFirstRow.length && !loopedSecondRow.length) return
    if (!topRowRef.current && !bottomRowRef.current) return

    let lastTime = performance.now()
    const speedPerMs = SCROLL_SPEED / 30
    const tick = () => {
      const now = performance.now()
      const delta = now - lastTime
      lastTime = now
      const top = topRowRef.current
      const bottom = bottomRowRef.current
      const maxTop = topRowMaxScrollRef.current
      const maxBottom = bottomRowMaxScrollRef.current
      if (top && loopedFirstRow.length && maxTop > 0.5 && !topRowPaused) {
        const next = topRowScrollRef.current + delta * speedPerMs
        const wrapped = next >= maxTop ? 0 : next
        topRowScrollRef.current = wrapped
        top.scrollLeft = wrapped
      }
      if (bottom && loopedSecondRow.length && maxBottom > 0.5 && !bottomRowPaused) {
        const next = bottomRowScrollRef.current - delta * speedPerMs
        const wrapped = next <= 0 ? maxBottom : next
        bottomRowScrollRef.current = wrapped
        bottom.scrollLeft = wrapped
      }
    }

    const id = window.setInterval(tick, 16)
    return () => window.clearInterval(id)
  }, [loopedFirstRow.length, loopedSecondRow.length, topRowPaused, bottomRowPaused])

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
    const start = maxScroll > 0 ? maxScroll : 0
    bottomRowScrollRef.current = start
    bottom.scrollLeft = start
  }, [loopedSecondRow.length, measureRowOverflow])

  const scrollToTop = () => {
    pageScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  const savePortfolioReturnState = useCallback(() => {
    if (typeof window === "undefined") return
    const scrollTop = pageScrollRef.current?.scrollTop ?? window.scrollY ?? 0
    window.sessionStorage.setItem("portfolio:return-scroll", String(scrollTop))
    window.sessionStorage.setItem("portfolio:return-top-row-scroll", String(topRowRef.current?.scrollLeft ?? topRowScrollRef.current ?? 0))
    window.sessionStorage.setItem("portfolio:return-bottom-row-scroll", String(bottomRowRef.current?.scrollLeft ?? bottomRowScrollRef.current ?? 0))
  }, [])

  const buildWorkHref = useCallback((setId: number | string, opts?: { index?: number | null }) => {
    const params = new URLSearchParams()
    params.set("origin", "portfolio")
    params.set("returnSet", String(setId))
    if (typeof opts?.index === "number" && Number.isFinite(opts.index)) {
      params.set("index", String(opts.index))
    }
    return `/work/${setId}?${params.toString()}`
  }, [])

  useEffect(() => {
    if (restoreAppliedRef.current || loading) return

    const wantsRestore = searchParams.get("restore") === "1"
    const focusSet = searchParams.get("focusSet")
    const focusSection = searchParams.get("focusSection")
    if (!wantsRestore && !focusSet && !focusSection) return

    restoreAppliedRef.current = true

    const run = () => {
      const node = pageScrollRef.current
      if (!node) return

      const storedScrollTop = typeof window !== "undefined"
        ? window.sessionStorage.getItem("portfolio:return-scroll")
        : null

      if (wantsRestore && storedScrollTop) {
        const value = Number(storedScrollTop)
        if (Number.isFinite(value)) {
          node.scrollTo({ top: value, behavior: "auto" })
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
          return
        }
      }

      if (focusSet) {
        const target = node.querySelector(`[data-set-id="${focusSet}"]`) as HTMLElement | null
        target?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" })
        return
      }

      if (focusSection) {
        const target = node.querySelector(`[data-portfolio-section="${focusSection}"]`) as HTMLElement | null
        target?.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" })
      }
    }

    requestAnimationFrame(() => requestAnimationFrame(run))
  }, [loading, searchParams])

  const getText = useCallback((s: PictureSet, key: 'title' | 'subtitle' | 'description') => {
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
    for (const set of pictureSets) {
      const loc = setLocations[set.id]
      if (!loc) continue
      const lat = Number(loc.latitude)
      const lng = Number(loc.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const bucketKey = `${lat.toFixed(3)}:${lng.toFixed(3)}`

      // 根据当前语言选择地点名称
      let locationName: string
      if (locale === 'zh') {
        locationName = (loc.name_zh && String(loc.name_zh).trim().length > 0)
          ? String(loc.name_zh)
          : (loc.name && String(loc.name).trim().length > 0)
            ? String(loc.name)
            : t('mapUnknownLocation')
      } else {
        locationName = (loc.name_en && String(loc.name_en).trim().length > 0)
          ? String(loc.name_en)
          : (loc.name && String(loc.name).trim().length > 0)
            ? String(loc.name)
            : t('mapUnknownLocation')
      }

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
        coverUrl: set.cover_image_url ? `${baseUrl}${set.cover_image_url}` : '/placeholder.svg',
      })
      buckets.set(bucketKey, existing)
    }

    return Array.from(buckets.values()).map((bucket) => ({
      ...bucket,
      sets: bucket.sets.sort((a, b) => a.title.localeCompare(b.title)),
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [pictureSets, setLocations, baseUrl, getText, t, locale])

  const downGallerySubtitle = t('downGallerySubtitle')
  const hasDownGallerySubtitle = downGallerySubtitle.trim().length > 0

  const downGallerySection = !loading && downPictureSets.length > 0 && (
    <section className="mt-12 sm:mt-20">
      <div className={clsx("text-center max-w-3xl mx-auto", hasDownGallerySubtitle ? "mb-2 sm:mb-4" : "mb-4 sm:mb-6")}>
        <h2 className="text-lg sm:text-2xl font-medium text-slate-900 tracking-[0.08em] uppercase">
          {t('downGalleryTitle')}
        </h2>
        {hasDownGallerySubtitle && (
          <p className="mt-1 text-xs sm:text-sm text-slate-500/80">
            {downGallerySubtitle}
          </p>
        )}
      </div>
      <div className="flex justify-center w-full">
        <div className="w-full px-2 sm:px-4 mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[100rem] min-[2200px]:max-w-[120rem]">
          <div
            className="columns-2 sm:columns-2 lg:columns-3 xl:columns-4 [column-fill:balance] [column-gap:0.5rem] sm:[column-gap:0.75rem] min-[900px]:[column-gap:0.9rem] 2xl:[column-count:auto] 2xl:[column-width:18rem] min-[1800px]:[column-width:16rem] min-[2200px]:[column-width:14rem]"
          >
            {downPictureSets.map((item, index) => {
              const dims = coverDimensions[item.id]
              const aspectRatio = dims ? dims.width / Math.max(dims.height, 1) : undefined
              const coverSrc = item.cover_image_url ? `${baseUrl}${item.cover_image_url}` : '/placeholder.svg'
              const eager = index < downEagerCount

              const columnAwareStyle: CSSProperties = {
                opacity: 1,
                animationDelay: `${index * 100}ms`,
                breakInside: 'avoid-column',
                ['WebkitColumnBreakInside' as any]: 'avoid',
              }

              return (
                <div
                  key={item.id}
                  className="group relative inline-block w-full transition-opacity duration-500 ease-out mb-2 sm:mb-3"
                  style={columnAwareStyle}
                >
                  <Link
                    href={buildWorkHref(item.id)}
                    data-set-id={item.id}
                    onClick={savePortfolioReturnState}
                    className="block relative overflow-hidden gpu-accelerated rounded-lg"
                    style={{ aspectRatio: aspectRatio || DEFAULT_DOWN_TILE_ASPECT_RATIO }}
                  >
                    <Image
                      src={coverSrc}
                      alt={getText(item, 'title') || item.title}
                      fill
                      quality={DOWN_THUMB_QUALITY}
                      fetchPriority={eager ? 'high' : 'low'}
                      decoding="async"
                      sizes={DOWN_IMAGE_SIZES}
                      className="object-cover"
                      priority={eager}
                      loading={eager ? 'eager' : 'lazy'}
                      onLoad={(e) => {
                        const img = e.target as HTMLImageElement
                        handleDownImageLoaded(item.id, img.naturalWidth, img.naturalHeight)
                      }}
                    />

                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 p-4 text-white opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100">
                      <div className="text-center">
                        <h3 className="text-lg font-medium mb-1">{getText(item, 'title')}</h3>
                        <p className="text-sm opacity-80">{getText(item, 'subtitle')}</p>
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </div>

    </section>
  )

  return (
    <div ref={pageScrollRef} data-portfolio-scroll-root className="w-full mx-auto h-[100svh] overflow-y-auto scroll-smooth snap-y snap-proximity md:snap-mandatory">
      <section className="snap-start snap-always h-[100svh] flex items-center justify-center px-2 sm:px-4 py-8 sm:py-16">
        <div className="w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[90rem] flex flex-col gap-4 sm:gap-6">
          <div className="flex flex-col gap-4 md:grid md:grid-cols-[auto,minmax(0,1fr),auto] md:items-center md:gap-3">
            <button
              type="button"
              aria-label="Previous video"
              className="hidden md:inline-flex h-10 w-10 sm:h-11 sm:w-11 rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md items-center justify-center"
              onClick={() => setActiveVideoIndex((prev) => (prev + 1) % 2)}
            >
              ‹
            </button>
            <div className="relative mx-auto w-full max-w-[900px] overflow-hidden bg-transparent aspect-[3/2]">
              {activeVideoIndex === 0 ? (
                <iframe
                  key="yt-0"
                  src="https://www.youtube.com/embed/LLVJtDjDHrA?si=BdXz0Kl75BTRMoGm&rel=0&modestbranding=1&iv_load_policy=3"
                  title="YouTube video player"
                  className="absolute inset-0 h-full w-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : (
                <iframe
                  key="yt-1"
                  src="https://www.youtube.com/embed/GFKieTQabW4?si=OcQbh_KPwkcE1trL&rel=0&modestbranding=1&iv_load_policy=3"
                  title="YouTube video player"
                  className="absolute inset-0 h-full w-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              )}
            </div>
            <button
              type="button"
              aria-label="Next video"
              className="hidden md:inline-flex h-10 w-10 sm:h-11 sm:w-11 rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md items-center justify-center"
              onClick={() => setActiveVideoIndex((prev) => (prev + 1) % 2)}
            >
              ›
            </button>
            <div className="flex items-center justify-center gap-3 md:hidden">
              <button
                type="button"
                aria-label="Previous video"
                className="h-10 w-10 rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => setActiveVideoIndex((prev) => (prev + 1) % 2)}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next video"
                className="h-10 w-10 rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => setActiveVideoIndex((prev) => (prev + 1) % 2)}
              >
                ›
              </button>
            </div>
          </div>
          <div className="scroll-hint">
            <span className="scroll-glow" />
            <span className="scroll-chevron" />
            <span className="scroll-chevron" />
            <span className="scroll-chevron" />
          </div>
        </div>
      </section>

      <section className="snap-start snap-always min-h-[100svh] px-2 sm:px-4 py-8 sm:py-16 flex flex-col">
        <div className="relative mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-light tracking-wide text-center text-slate-900/90">
            {t('galleriesTitle')}
          </h1>
          {/* Header controls (search) */}
          <div className="absolute right-0 top-0 flex items-center gap-2">
            <LangSwitcher className="bg-white text-gray-700" />
            {/* Search panel trigger */}
            <button
              onClick={() => {
                setSearchOpen(true)
                setTimeout(() => searchInputRef.current?.focus(), 0)
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg shadow-sm bg-white text-gray-700 hover:shadow"
              title={t('search')}
              aria-label={t('openSearch')}
            >
              🔍
            </button>
          </div>
        </div>

        {/* Lightweight search panel (overlay) */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setSearchOpen(false)}>
          <div className="absolute inset-x-0 top-16 mx-auto max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b">
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('homeSearchPlaceholder')}
                  className="flex-1 outline-none"
                />
                {searchQuery && (
                  <button className="text-sm text-gray-500 hover:text-gray-700" onClick={() => setSearchQuery("")}>{t('clear')}</button>
                )}
                <button className="text-xl" onClick={() => setSearchOpen(false)} aria-label={t('close')}>×</button>
              </div>
              <div className="max-h-[70vh] overflow-auto p-3 sm:p-4">
                {/* Results list */}
                <div className="flex flex-col gap-8">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-base font-medium">{t('setMatchesHdr')}</h2>
                      {searchLoading && <span className="text-xs text-gray-500">{t('searching')}</span>}
                    </div>
                    {(setResults?.length || 0) === 0 ? (
                      <p className="text-sm text-gray-500">{t('noMatchingSets')}</p>
                    ) : (
                      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                        {(setResults || []).map((item) => (
                          <Link
                            key={item.id}
                            href={buildWorkHref(item.id)}
                            data-set-id={item.id}
                            onClick={savePortfolioReturnState}
                            className="group block relative overflow-hidden rounded-md bg-gray-100"
                          >
                            <Image src={item.cover_image_url ? `${baseUrl}${item.cover_image_url}` : "/placeholder.svg"} alt={getText(item, 'title')} width={400} height={250} quality={60} className="w-full h-auto object-cover transition-transform duration-300 ease-out group-hover:scale-105" />
                            <div className="p-2">
                              <div className="text-sm font-medium line-clamp-1">{getText(item, 'title')}</div>
                              <div className="text-xs text-gray-500 line-clamp-1">{getText(item, 'subtitle')}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-base font-medium">{t('pictureMatchesHdr')}</h2>
                      {searchLoading && <span className="text-xs text-gray-500">{t('searching')}</span>}
                    </div>
                    {(pictureResults?.length || 0) === 0 ? (
                      <p className="text-sm text-gray-500">{t('noMatchingPictures')}</p>
                    ) : (
                      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                        {(pictureResults || []).map((p) => (
                          <Link
                            key={p.id}
                            href={buildWorkHref(p.picture_set_id, { index: Number.isFinite((p as any).order_index) ? Number((p as any).order_index) : null })}
                            data-set-id={p.picture_set_id}
                            onClick={savePortfolioReturnState}
                            className="group block relative overflow-hidden rounded-md bg-gray-100"
                          >
                            <Image src={p.image_url ? `${baseUrl}${p.image_url}` : "/placeholder.svg"} alt={getPicText(p, 'title')} width={400} height={250} quality={60} className="w-full h-auto object-cover transition-transform duration-300 ease-out group-hover:scale-105" />
                            <div className="p-2">
                              <div className="text-sm font-medium line-clamp-1">{getPicText(p, 'title')}</div>
                              <div className="text-xs text-gray-500 line-clamp-1">{getPicText(p, 'subtitle')}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
              <div className="space-y-2 sm:space-y-3">
                <div
                  ref={topRowRef}
                  data-portfolio-row="top"
                  className="flex overflow-x-auto hide-scrollbar gap-2 sm:gap-3 w-full"
                  onPointerEnter={pauseTopRow}
                  onPointerLeave={resumeTopRow}
                  onPointerUp={resumeTopRow}
                  onPointerCancel={resumeTopRow}
                  onPointerDown={forcePauseTopRow}
                >
                  {loopedFirstRow.map((item, i) => {
                    const widthClass = getTileWidthClass(i)

                    return (
                      <Link
                        key={`${item.id}-${i}`}
                        href={buildWorkHref(item.id)}
                        data-set-id={item.id}
                        onClick={savePortfolioReturnState}
                        className={`group relative aspect-[16/9] flex-none ${widthClass} min-w-[160px] sm:min-w-[200px] overflow-hidden bg-gray-100 gpu-accelerated rounded-md transition-transform duration-300 ease-out hover:scale-[1.02]`}
                      >
                      <Image
                        src={item.cover_image_url ? `${baseUrl}${item.cover_image_url}` : "/placeholder.svg"}
                        alt={item.title}
                        fill
                        quality={60}
                        sizes="(max-width: 640px) 33vw, 20vw"
                        className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                        onLoadingComplete={updateRowScrollBounds}
                      />

                        <div
                          className="
                            absolute inset-0
                            bg-black/60
                            opacity-100
                            transition-opacity duration-300 ease-out
                            group-hover:opacity-0
                            flex flex-col items-center justify-center text-white p-4 text-center
                          "
                        >
                          <h2
                            className="text-xl sm:text-2xl font-light mb-2 hidden sm:block transition-transform duration-300 ease-out group-hover:-translate-y-1"
                          >
                            {getText(item, 'title')}
                          </h2>
                          <p
                            className="text-sm opacity-80 hidden sm:block transition-transform duration-300 ease-out group-hover:translate-y-1"
                          >
                            {getText(item, 'subtitle')}
                          </p>
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
                    className="flex overflow-x-auto hide-scrollbar gap-2 sm:gap-3 w-full"
                    onPointerEnter={pauseBottomRow}
                    onPointerLeave={resumeBottomRow}
                    onPointerUp={resumeBottomRow}
                    onPointerCancel={resumeBottomRow}
                    onPointerDown={forcePauseBottomRow}
                  >
                    {loopedSecondRow.map((item, i) => {
                      const widthClass = getTileWidthClass(i)

                      return (
                        <Link
                          key={`${item.id}-${i}`}
                          href={buildWorkHref(item.id)}
                          data-set-id={item.id}
                          onClick={savePortfolioReturnState}
                          className={`group relative aspect-[16/9] flex-none ${widthClass} min-w-[160px] sm:min-w-[200px] overflow-hidden bg-gray-100 gpu-accelerated rounded-md transition-transform duration-300 ease-out hover:scale-[1.02]`}
                        >
                        <Image
                          src={item.cover_image_url ? `${baseUrl}${item.cover_image_url}` : "/placeholder.svg"}
                          alt={item.title}
                          fill
                          quality={60}
                          sizes="(max-width: 640px) 33vw, 20vw"
                          className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                          onLoadingComplete={updateRowScrollBounds}
                        />

                          <div
                            className="
                              absolute inset-0
                              bg-black/60
                              opacity-100
                              transition-opacity duration-300 ease-out
                              group-hover:opacity-0
                              flex flex-col items-center justify-center text-white p-4 text-center
                            "
                          >
                            <h2
                              className="text-xl sm:text-2xl font-light mb-2 hidden sm:block transition-transform duration-300 ease-out group-hover:-translate-y-1"
                            >
                              {getText(item, 'title')}
                            </h2>
                            <p
                              className="text-sm opacity-80 hidden sm:block transition-transform duration-300 ease-out group-hover:translate-y-1"
                            >
                              {getText(item, 'subtitle')}
                            </p>
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
        <section data-portfolio-section="styles">
        <Suspense fallback={<div className="py-8 text-center text-gray-500">Loading...</div>}>
          <PhotographyStyleShowcase />
        </Suspense>
        </section>
      )}

      {locationClusters.length > 0 && (
        <section className="mt-16 sm:mt-24">
          <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-2xl font-medium text-slate-900 tracking-[0.08em] uppercase">
              {t('mapSectionTitle')}
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-500/80">
              {t('mapSectionSubtitle')}
            </p>
          </div>
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

      <footer className="mt-16 sm:mt-24 pb-6 sm:pb-8 border-t border-slate-200/70">
        <div className="flex flex-wrap items-center justify-center gap-4 pt-6 text-xs tracking-[0.24em] text-slate-500/80">
          <a
            href="https://www.instagram.com/cunyli_lijie/"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-slate-900"
          >
            {locale === "zh" ? "Instagram" : "Instagram"}
          </a>
          <span aria-hidden className="text-slate-300">
            /
          </span>
          <a
            href="https://www.xiaohongshu.com/user/profile/608e62a5000000000100bc40"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-slate-900"
          >
            {locale === "zh" ? "小红书" : "Xiaohongshu"}
          </a>
          <span aria-hidden className="text-slate-300">
            /
          </span>
          <span className="text-slate-500/80 normal-case">
            {locale === "zh" ? "微信" : "WeChat"} Llj773882712
          </span>
        </div>
      </footer>
      </section>

      {/* Scroll to top button */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 bg-black text-white p-3 rounded-full transition-all duration-300 ease-out hover:bg-gray-800 hover:scale-110 shadow-lg"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
      <style jsx>{`
        .scroll-hint {
          position: relative;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          color: rgba(100, 116, 139, 0.9);
        }

        .scroll-chevron {
          width: 14px;
          height: 14px;
          border-right: 2px solid currentColor;
          border-bottom: 2px solid currentColor;
          transform: rotate(45deg);
          opacity: 0.65;
          animation: chevronPulse 1.6s ease-in-out infinite;
        }

        .scroll-chevron:nth-of-type(2) {
          animation-delay: 0.2s;
        }

        .scroll-chevron:nth-of-type(3) {
          animation-delay: 0.4s;
        }

        .scroll-glow {
          position: absolute;
          top: 0;
          left: 50%;
          width: 26px;
          height: 40px;
          transform: translateX(-50%);
          background: linear-gradient(180deg, rgba(148, 163, 184, 0), rgba(148, 163, 184, 0.6), rgba(148, 163, 184, 0));
          filter: blur(6px);
          opacity: 0.6;
          animation: glowSlide 1.6s ease-in-out infinite;
        }

        @keyframes chevronPulse {
          0%,
          100% {
            opacity: 0.3;
            transform: rotate(45deg) translateY(-2px);
          }
          50% {
            opacity: 0.9;
            transform: rotate(45deg) translateY(2px);
          }
        }

        @keyframes glowSlide {
          0% {
            opacity: 0;
            transform: translate(-50%, -6px);
          }
          40% {
            opacity: 0.8;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, 24px);
          }
        }
      `}</style>
    </div>
  )
}
