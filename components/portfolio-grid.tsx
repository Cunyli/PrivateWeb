// components/PortfolioGrid.tsx
"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { supabase } from "@/utils/supabase"
import { ArrowUp } from "lucide-react"
import type { PictureSet, Picture } from "@/lib/pictureSet.types"

export function PortfolioGrid() {
  const [pictureSets, setPictureSets] = useState<PictureSet[]>([])
  const [loading, setLoading] = useState(true)
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const [shuffledDownSets, setShuffledDownSets] = useState<PictureSet[]>([])
  const [derivedUpSets, setDerivedUpSets] = useState<PictureSet[]>([])
  const [lang, setLang] = useState<'auto' | 'en' | 'zh'>('auto')
  const [transMap, setTransMap] = useState<Record<number, { en?: { title?: string; subtitle?: string; description?: string }, zh?: { title?: string; subtitle?: string; description?: string } }>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [setResults, setSetResults] = useState<PictureSet[] | null>(null)
  const [pictureResults, setPictureResults] = useState<Picture[] | null>(null)
  const [pictureTransMap, setPictureTransMap] = useState<Record<number, { en?: { title?: string; subtitle?: string; description?: string }, zh?: { title?: string; subtitle?: string; description?: string } }>>({})
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const topRowRef = useRef<HTMLDivElement>(null)
  const bottomRowRef = useRef<HTMLDivElement>(null)

  // Stable shuffle with a fixed seed for reproducible order
  const stableShuffleArray = (array: PictureSet[], seed: string): PictureSet[] => {
    const shuffled = [...array]
    // Use string as seed to produce deterministic pseudo-random numbers
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0 // cast to 32-bit int
    }

    // Fisher-Yates shuffle (with bounded, non-negative index)
    for (let i = shuffled.length - 1; i > 0; i--) {
      hash = (hash * 9301 + 49297) % 233280 // LCG
      if (hash < 0) hash += 233280
      const j = Math.abs(hash) % (i + 1)
      const tmp = shuffled[i]
      shuffled[i] = shuffled[j]
      shuffled[j] = tmp
    }

    return shuffled
  }

  const fetchPictureSets = async () => {
    setLoading(true)
    try {
      console.log("Fetching picture sets for portfolio grid")
      const { data, error } = await supabase
        .from("picture_sets")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching picture sets:", error)
        setPictureSets([])
        setShuffledDownSets([])
      } else {
        console.log(`Found ${data?.length || 0} picture sets`)
        const sets = data || []
        setPictureSets(sets)

        // Fetch both en and zh translations for display switching
        if (sets.length > 0) {
          const ids = sets.map((s) => s.id)
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
        } else {
          setTransMap({})
        }
        
        // 根据 Sections 推导上下排（兼容 position）
        try {
          const ids = sets.map(s => s.id)
          const [{ data: assigns }, { data: secs }] = await Promise.all([
            supabase.from('picture_set_section_assignments').select('picture_set_id, section_id').in('picture_set_id', ids),
            supabase.from('sections').select('id,name')
          ])
          const secNameById: Record<number, string> = {}
          for (const r of secs || []) secNameById[(r as any).id] = String((r as any).name || '').toLowerCase().trim()
          const isTop = (n?: string) => !!n && (/\bup\b|top|上|顶/.test(n))
          const isBottom = (n?: string) => !!n && (/\bdown\b|bottom|下|底/.test(n))
          const topIds = new Set<number>()
          const bottomIds = new Set<number>()
          for (const a of assigns || []) {
            const sid = (a as any).section_id as number
            const psid = (a as any).picture_set_id as number
            const nm = secNameById[sid]
            if (isTop(nm)) topIds.add(psid)
            if (isBottom(nm)) bottomIds.add(psid)
          }
          // derive lists and merge with legacy position
          const topSets = sets.filter(s => topIds.has(s.id))
          const bottomSets = sets.filter(s => bottomIds.has(s.id))
          const legacyUp = sets.filter(s => (s.position||'').trim().toLowerCase() === 'up' && !topIds.has(s.id))
          const legacyDown = sets.filter(s => (s.position||'').trim().toLowerCase() === 'down' && !bottomIds.has(s.id))
          const upCombined = [...topSets, ...legacyUp]
          const downCombined = [...bottomSets, ...legacyDown]
          setDerivedUpSets(upCombined)
          const seed = downCombined.map(s => s.id).join('-')
          const shuffled = stableShuffleArray(downCombined, seed)
          setShuffledDownSets(shuffled)
        } catch (e) {
          console.warn('Derive up/down by sections failed; fallback to position only', e)
          const downSets = (sets || []).filter((s) => s.position?.trim().toLowerCase() === "down")
          const seed = downSets.map(s => s.id).join('-')
          const shuffled = stableShuffleArray(downSets, seed)
          setShuffledDownSets(shuffled)
          setDerivedUpSets(sets.filter((s) => s.position?.trim().toLowerCase() === "up"))
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
        setSetResults(sets as PictureSet[])
        setPictureResults(pics as Picture[])

        // Fetch translations for sets in results
        const setIds = (sets || []).map((s: any) => s.id)
        if (setIds.length > 0) {
          const [{ data: enTrans }, { data: zhTrans }] = await Promise.all([
            supabase.from('picture_set_translations').select('picture_set_id, title, subtitle, description').eq('locale','en').in('picture_set_id', setIds),
            supabase.from('picture_set_translations').select('picture_set_id, title, subtitle, description').eq('locale','zh').in('picture_set_id', setIds),
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
            supabase.from('picture_translations').select('picture_id, title, subtitle, description').eq('locale','en').in('picture_id', picIds),
            supabase.from('picture_translations').select('picture_id, title, subtitle, description').eq('locale','zh').in('picture_id', picIds),
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
    fetchPictureSets()
  }, [])

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

  // Language preference persistence
  useEffect(() => {
    try {
      const saved = localStorage.getItem('portfolio_lang') as 'auto'|'en'|'zh'|null
      if (saved === 'auto' || saved === 'en' || saved === 'zh') setLang(saved)
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('portfolio_lang', lang) } catch {}
  }, [lang])

  const getText = (s: PictureSet, key: 'title'|'subtitle'|'description') => {
    const t = transMap[s.id]
    if (lang === 'zh') return t?.zh?.[key] || s[key]
    if (lang === 'en') return t?.en?.[key] || s[key]
    // auto: prefer zh if available
    return t?.zh?.[key] || s[key]
  }

  const getPicText = (p: Picture, key: 'title'|'subtitle'|'description') => {
    const t = pictureTransMap[p.id]
    if (lang === 'zh') return t?.zh?.[key] || (p as any)[key]
    if (lang === 'en') return t?.en?.[key] || (p as any)[key]
    return t?.zh?.[key] || (p as any)[key]
  }

  const baseUrl = process.env.NEXT_PUBLIC_BUCKET_URL || ''

  return (
    <div className="w-full mx-auto px-2 sm:px-4 py-8 sm:py-16 flex flex-col min-h-screen">
      <div className="relative mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-light text-center">Lijie&apos;s Galleries</h1>
        {/* Header controls (search, language toggle) */}
        <div className="absolute right-0 top-0 flex items-center gap-2">
          {/* Language toggle: click to switch between EN/Chinese */}
          <button
            onClick={() => setLang(prev => prev === 'zh' ? 'en' : 'zh')}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shadow-sm transition ${lang!=='auto' ? 'bg-black text-white' : 'bg-white text-gray-700'} hover:shadow`}
            title={`Language: ${lang==='zh' ? 'Chinese' : 'EN'} (Click to toggle)`}
            aria-label="Toggle language"
          >
            <span aria-hidden>🌐</span>
          </button>
          {/* Search panel trigger */}
          <button
            onClick={() => {
              setSearchOpen(true)
              setTimeout(() => searchInputRef.current?.focus(), 0)
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center text-lg shadow-sm bg-white text-gray-700 hover:shadow"
            title="Search"
            aria-label="Open search"
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
                  placeholder="Search sets or images (EN/Chinese, multi-word AND)"
                  className="flex-1 outline-none"
                />
                {searchQuery && (
                  <button className="text-sm text-gray-500 hover:text-gray-700" onClick={() => setSearchQuery("")}>Clear</button>
                )}
                <button className="text-xl" onClick={() => setSearchOpen(false)} aria-label="Close">×</button>
              </div>
              <div className="max-h-[70vh] overflow-auto p-3 sm:p-4">
                {/* Results list */}
                <div className="flex flex-col gap-8">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-base font-medium">Set Matches</h2>
                      {searchLoading && <span className="text-xs text-gray-500">Searching…</span>}
                    </div>
                    {(setResults?.length || 0) === 0 ? (
                      <p className="text-sm text-gray-500">No matching sets</p>
                    ) : (
                      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                        {(setResults || []).map((item) => (
                          <Link key={item.id} href={`/work/${item.id}`} className="group block relative overflow-hidden rounded-md bg-gray-100">
                            <Image src={item.cover_image_url ? `${baseUrl}${item.cover_image_url}` : "/placeholder.svg"} alt={getText(item,'title')} width={400} height={250} className="w-full h-auto object-cover transition-transform duration-300 ease-out group-hover:scale-105" />
                            <div className="p-2">
                              <div className="text-sm font-medium line-clamp-1">{getText(item,'title')}</div>
                              <div className="text-xs text-gray-500 line-clamp-1">{getText(item,'subtitle')}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-base font-medium">Picture Matches</h2>
                      {searchLoading && <span className="text-xs text-gray-500">Searching…</span>}
                    </div>
                    {(pictureResults?.length || 0) === 0 ? (
                      <p className="text-sm text-gray-500">No matching pictures</p>
                    ) : (
                      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                        {(pictureResults || []).map((p) => (
                          <Link key={p.id} href={`/work/${p.picture_set_id}`} className="group block relative overflow-hidden rounded-md bg-gray-100">
                            <Image src={p.image_url ? `${baseUrl}${p.image_url}` : "/placeholder.svg"} alt={getPicText(p,'title')} width={400} height={250} className="w-full h-auto object-cover transition-transform duration-300 ease-out group-hover:scale-105" />
                            <div className="p-2">
                              <div className="text-sm font-medium line-clamp-1">{getPicText(p,'title')}</div>
                              <div className="text-xs text-gray-500 line-clamp-1">{getPicText(p,'subtitle')}</div>
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

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-pulse">Loading galleries...</div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 sm:gap-12 flex-1">
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
                      href={`/work/${item.id}?t=${Date.now()}`}
                      className={`group relative aspect-[16/9] flex-none ${widthClass} min-w-[160px] sm:min-w-[200px] overflow-hidden bg-gray-100 gpu-accelerated rounded-md transition-transform duration-300 ease-out hover:scale-[1.02]`}
                    >
                      <Image
                        src={item.cover_image_url ? `${baseUrl}${item.cover_image_url}` : "/placeholder.svg"}
                        alt={item.title}
                        fill
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
                        href={`/work/${item.id}?t=${Date.now()}`}
                        className={`group relative aspect-[16/9] flex-none ${widthClass} min-w-[160px] sm:min-w-[200px] overflow-hidden bg-gray-100 gpu-accelerated rounded-md transition-transform duration-300 ease-out hover:scale-[1.02]`}
                      >
                        <Image
                          src={item.cover_image_url ? `${baseUrl}${item.cover_image_url}` : "/placeholder.svg"}
                          alt={item.title}
                          fill
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
                            {item.title}
                          </h2>
                          <p 
                            className="text-sm opacity-80 hidden sm:block transition-transform duration-300 ease-out group-hover:translate-y-1"
                          >
                            {item.subtitle}
                          </p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* 下部Masonry布局 */}
          {downPictureSets.length > 0 && (
            <div className="flex justify-center">
              <div className="w-full max-w-7xl columns-2 sm:columns-3 gap-2 sm:gap-4 transform scale-[0.9] sm:scale-[0.833] origin-center">
                {downPictureSets.map((item, index) => (
                  <div
                    key={item.id}
                    className="break-inside-avoid mb-2 sm:mb-4 transition-opacity duration-500 ease-out"
                    style={{ 
                      opacity: 1,
                      animationDelay: `${index * 100}ms`
                    }}
                  >
                    <Link
                      href={`/work/${item.id}?t=${Date.now()}`}
                      className="group block relative overflow-hidden gpu-accelerated rounded-lg transition-transform duration-300 ease-out hover:scale-[1.02]"
                    >
                      <Image
                        src={item.cover_image_url ? `${baseUrl}${item.cover_image_url}` : "/placeholder.svg"}
                        alt={item.title}
                        width={600}
                        height={800}
                        className="w-full h-auto object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                      />
                      
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 ease-out flex items-center justify-center">
                        <div className="text-white text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out p-4">
                          <h3 className="text-lg font-medium mb-1">{getText(item,'title')}</h3>
                          <p className="text-sm opacity-80">{getText(item,'subtitle')}</p>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
