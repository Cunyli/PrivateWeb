// components/PortfolioGrid.tsx
"use client"

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react"
import type { CSSProperties } from "react"
import { useI18n } from "@/lib/i18n"
import Image from "next/image"
import Link from "next/link"
import { supabase } from "@/utils/supabase"
import { ArrowUp } from "lucide-react"
import type { PictureSet, Picture } from "@/lib/pictureSet.types"
import { PortfolioLocationMap } from "@/components/portfolio-location-map"
import { LangSwitcher } from "@/components/lang-switcher"
import { PhotographyStyleShowcase } from "@/components/photography-style-showcase"
import { derivePortfolioBuckets, fallbackBuckets } from "@/lib/portfolio-order"
import type { InitialPortfolioPayload } from "@/lib/portfolioInitialData"

const DEFAULT_DOWN_TILE_ASPECT_RATIO = 3 / 4
const INITIAL_DOWN_LIMIT = 16
const DOWN_PREFETCH_LIMIT = 48

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
  const baseUrl = useMemo(() => process.env.NEXT_PUBLIC_BUCKET_URL || 'https://s3.cunyli.top', [])
  const [coverDimensions, setCoverDimensions] = useState<Record<number, { width: number; height: number }>>({})
  const [downLoadedMap, setDownLoadedMap] = useState<Record<number, boolean>>({})
  const downPrefetchedRef = useRef<Set<string>>(new Set())
  const downPrefetchQueueRef = useRef<string[]>([])
  const downPrefetchingRef = useRef(false)

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
    const q = searchQuery.trim()
    if (!q) {
      setSetResults(null)
      setPictureResults(null)
      return
    }
    let alive = true
    const t = setTimeout(async () => {
      setSearchLoading(true)
      try {
        // Search sets
        let sets: any[] = []
        {
          const fts = await supabase
            .from('picture_sets')
            .select('*')
            .textSearch('search_vector', q, { type: 'websearch', config: 'english' })
            .order('updated_at', { ascending: false })
            .limit(80)
          if (fts.error) console.warn('Set FTS error:', fts.error)
          if (fts.data && fts.data.length > 0) {
            sets = fts.data
          } else {
            const terms = q.split(/\s+/).filter(Boolean)
            let builder: any = supabase.from('picture_sets').select('*')
            for (const t of terms) builder = builder.ilike('search_text', `%${t}%`)
            const andRes = await builder.order('updated_at', { ascending: false }).limit(80)
            if (andRes.error) console.warn('Set ILIKE error:', andRes.error)
            sets = andRes.data || []
          }
        }

        // Search pictures
        let pics: any[] = []
        {
          const fts = await supabase
            .from('pictures')
            .select('*')
            .textSearch('search_vector', q, { type: 'websearch', config: 'english' })
            .order('updated_at', { ascending: false })
            .limit(100)
          if (fts.error) console.warn('Pic FTS error:', fts.error)
          if (fts.data && fts.data.length > 0) {
            pics = fts.data
          } else {
            const terms = q.split(/\s+/).filter(Boolean)
            let builder: any = supabase.from('pictures').select('*')
            for (const t of terms) builder = builder.ilike('search_text', `%${t}%`)
            const andRes = await builder.order('updated_at', { ascending: false }).limit(100)
            if (andRes.error) console.warn('Pic ILIKE error:', andRes.error)
            pics = andRes.data || []
          }
        }

        if (!alive) return
        const normalizedSearchSets = normalizePictureSets(sets as Partial<PictureSet>[])
        setSetResults(normalizedSearchSets)
        setPictureResults(pics as Picture[])

        // Fetch translations for sets in results
        const setIds = (sets || []).map((s: any) => s.id)
        if (setIds.length > 0) {
          const [{ data: enTrans }, { data: zhTrans }] = await Promise.all([
            supabase.from('picture_set_translations').select('picture_set_id, title, subtitle, description').eq('locale', 'en').in('picture_set_id', setIds),
            supabase.from('picture_set_translations').select('picture_set_id, title, subtitle, description').eq('locale', 'zh').in('picture_set_id', setIds),
          ])
          const map: Record<number, any> = { ...transMap }
          for (const t of enTrans || []) {
            map[(t as any).picture_set_id] = { ...(map[(t as any).picture_set_id] || {}), en: { title: (t as any).title || undefined, subtitle: (t as any).subtitle || undefined, description: (t as any).description || undefined } }
          }
          for (const t of zhTrans || []) {
            map[(t as any).picture_set_id] = { ...(map[(t as any).picture_set_id] || {}), zh: { title: (t as any).title || undefined, subtitle: (t as any).subtitle || undefined, description: (t as any).description || undefined } }
          }
          if (alive) setTransMap(map)
        }

        // Fetch translations for pictures in results
        const picIds = (pics || []).map((p: any) => p.id)
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
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 300)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const upPictureSets = derivedUpSets
  // 直接使用状态中的洗牌结果，不再进行额外洗牌
  const downPictureSets = shuffledDownSets

  const mid = Math.ceil(upPictureSets.length / 2)
  const firstRow = upPictureSets.slice(0, mid)
  const secondRow = upPictureSets.slice(mid)
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    const bufferCount = Math.min(DOWN_PREFETCH_LIMIT, downPictureSets.length)
    const candidates = downPictureSets.slice(0, bufferCount)
    for (const item of candidates) {
      if (!item.cover_image_url) continue
      enqueueDownPrefetch(`${baseUrl}${item.cover_image_url}`)
    }
  }, [downPictureSets, baseUrl, enqueueDownPrefetch])

  useEffect(() => {
    setDownLoadedMap((prev) => {
      if (downPictureSets.length === 0) return {}
      const next: Record<number, boolean> = {}
      for (const item of downPictureSets) {
        if (prev[item.id]) next[item.id] = true
      }
      return next
    })
  }, [downPictureSets])

  const handleDownImageLoaded = useCallback((id: number, width?: number, height?: number) => {
    setDownLoadedMap((prev) => {
      if (prev[id]) return prev
      return { ...prev, [id]: true }
    })
    if (width && height) {
      setCoverDimensions((prev) => {
        if (prev[id]) return prev
        return { ...prev, [id]: { width, height } }
      })
    }
  }, [])

  useEffect(() => {
    if (!upPictureSets.length) return
    const top = topRowRef.current
    const bottom = bottomRowRef.current
    if (!top || !bottom) return

    const tick = () => {
      // refs might become null during unmount
      if (!topRowRef.current || !bottomRowRef.current) return
      const t = topRowRef.current
      const b = bottomRowRef.current
      if (!t || !b) return
      if (!t.matches(":hover")) {
        t.scrollLeft >= t.scrollWidth - t.clientWidth - 5
          ? t.scrollTo({ left: 0, behavior: "auto" })
          : t.scrollBy({ left: 1, behavior: "auto" })
      }
      if (!b.matches(":hover")) {
        b.scrollLeft <= 5
          ? b.scrollTo({ left: b.scrollWidth - b.clientWidth, behavior: "auto" })
          : b.scrollBy({ left: -1, behavior: "auto" })
      }
    }

    const id = window.setInterval(tick, 30)
    return () => window.clearInterval(id)
  }, [upPictureSets])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

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

  const downGallerySection = !loading && downPictureSets.length > 0 && (
    <section className="mt-16 sm:mt-24">
      <div className="text-center max-w-3xl mx-auto mb-2 sm:mb-4">
        <h2 className="text-lg sm:text-2xl font-medium text-slate-900 tracking-[0.08em] uppercase">
          {t('downGalleryTitle')}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500/80">
          {t('downGallerySubtitle')}
        </p>
      </div>
      <div className="flex justify-center">
        <div className="w-full max-w-6xl lg:max-w-7xl px-2 sm:px-4">
          <div className="columns-2 sm:columns-2 lg:columns-3 xl:columns-4 gap-2 sm:gap-3" style={{ columnFill: 'balance' }}>
            {downPictureSets.map((item, index) => {
              const dims = coverDimensions[item.id]
              const aspectRatio = dims ? dims.width / Math.max(dims.height, 1) : undefined
              const coverSrc = item.cover_image_url ? `${baseUrl}${item.cover_image_url}` : '/placeholder.svg'
              const isLoaded = !!downLoadedMap[item.id]
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
                    href={`/work/${item.id}`}
                    className="block relative overflow-hidden gpu-accelerated rounded-lg transition-transform duration-300 ease-out hover:scale-[1.02]"
                    style={{ aspectRatio: aspectRatio || DEFAULT_DOWN_TILE_ASPECT_RATIO }}
                  >
                    {!isLoaded && (
                      <div className="pointer-events-none absolute inset-0 bg-gray-200 animate-pulse" aria-hidden />
                    )}
                    <Image
                      src={coverSrc}
                      alt={getText(item, 'title') || item.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                      quality={60}
                      fetchPriority={eager ? 'high' : 'auto'}
                      className={`object-cover transition-transform duration-300 ease-out group-hover:scale-105 transition-opacity ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                      priority={eager}
                      loading={eager ? 'eager' : 'lazy'}
                      onLoad={(e) => {
                        const img = e.target as HTMLImageElement
                        handleDownImageLoaded(item.id, img.naturalWidth, img.naturalHeight)
                      }}
                    />

                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 ease-out flex items-center justify-center">
                      <div className="text-white text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out p-4">
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
    <div className="w-full mx-auto px-2 sm:px-4 py-8 sm:py-16 flex flex-col min-h-screen">
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
                          <Link key={item.id} href={`/work/${item.id}`} className="group block relative overflow-hidden rounded-md bg-gray-100">
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
                          <Link key={p.id} href={`/work/${p.picture_set_id}`} className="group block relative overflow-hidden rounded-md bg-gray-100">
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
                <div ref={topRowRef} className="flex overflow-x-auto hide-scrollbar gap-2 sm:gap-3 w-full">
                  {[...firstRow, ...firstRow].map((item, i) => {
                    const widthClass =
                      i % 5 === 0 || i % 5 === 4 ? "w-[15%]" : i % 5 === 1 || i % 5 === 3 ? "w-[25%]" : "w-[20%]"

                    return (
                      <Link
                        key={`${item.id}-${i}`}
                        href={`/work/${item.id}`}
                        className={`group relative aspect-[16/9] flex-none ${widthClass} min-w-[160px] sm:min-w-[200px] overflow-hidden bg-gray-100 gpu-accelerated rounded-md transition-transform duration-300 ease-out hover:scale-[1.02]`}
                      >
                        <Image
                          src={item.cover_image_url ? `${baseUrl}${item.cover_image_url}` : "/placeholder.svg"}
                          alt={item.title}
                          fill
                          quality={60}
                          sizes="(max-width: 640px) 33vw, 20vw"
                          className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
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
                {secondRow.length > 0 && (
                  <div ref={bottomRowRef} className="flex overflow-x-auto hide-scrollbar gap-2 sm:gap-3 w-full">
                    {[...secondRow, ...secondRow].map((item, i) => {
                      const widthClass =
                        i % 5 === 0 || i % 5 === 4 ? "w-[15%]" : i % 5 === 1 || i % 5 === 3 ? "w-[25%]" : "w-[20%]"

                      return (
                        <Link
                          key={`${item.id}-${i}`}
                          href={`/work/${item.id}`}
                          className={`group relative aspect-[16/9] flex-none ${widthClass} min-w-[160px] sm:min-w-[200px] overflow-hidden bg-gray-100 gpu-accelerated rounded-md transition-transform duration-300 ease-out hover:scale-[1.02]`}
                        >
                          <Image
                            src={item.cover_image_url ? `${baseUrl}${item.cover_image_url}` : "/placeholder.svg"}
                            alt={item.title}
                            fill
                            quality={60}
                            sizes="(max-width: 640px) 33vw, 20vw"
                            className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
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
        <Suspense fallback={<div className="py-8 text-center text-gray-500">Loading...</div>}>
          <PhotographyStyleShowcase />
        </Suspense>
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

      {/* Scroll to top button */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 bg-black text-white p-3 rounded-full transition-all duration-300 ease-out hover:bg-gray-800 hover:scale-110 shadow-lg"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
