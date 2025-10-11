"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase"
import { PictureSetForm } from "./picture-set-form"
import { PictureSetList } from "./picture-set-list"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import type { PictureSet, Picture } from "@/lib/pictureSet.types"
import type { PictureFormData, PictureSetSubmitData } from "@/lib/form-types"
import { deleteFileFromR2 } from "@/utils/r2-helpers"
import { useI18n } from "@/lib/i18n"

export function AdminDashboard() {
  const { t } = useI18n()
  const [pictureSets, setPictureSets] = useState<PictureSet[]>([])
  const [editingPictureSet, setEditingPictureSet] = useState<PictureSet | null>(null)
  const [activeTab, setActiveTab] = useState("list")
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchPictureSets()
  }, [])

  // Debounced search for robustness
  useEffect(() => {
    const t = setTimeout(() => {
      fetchPictureSets(searchQuery)
    }, 350)
    return () => clearTimeout(t)
  }, [searchQuery])

  const fetchPictureSets = async (q?: string) => {
    try {
      setIsLoading(true)
      const query = (typeof q === 'string' ? q : searchQuery).trim()
      const url = query ? `/api/admin/picture-sets?q=${encodeURIComponent(query)}` : '/api/admin/picture-sets'
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('loadSetsFail'))
      const items = Array.isArray(data?.items) ? data.items : []
      setPictureSets(items)
    } catch (error) {
      console.error('Error in fetchPictureSets(server):', error)
      toast({ title: t('error'), description: t('loadSetsFail'), variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  // 使用服务端 API 写库，优先确保 set / 图片描述类字段能保存
  const handleSubmitPictureSetServer = async (newPictureSet: PictureSetSubmitData, pictureSetId?: number) => {
    try {
      if (pictureSetId) {
        const res = await fetch(`/api/admin/picture-sets/${pictureSetId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPictureSet)
        })
        const data = await res.json().catch(()=> ({}))
        if (!res.ok) {
          console.error('API update picture-set failed:', data)
          toast({ title: t('error'), description: data?.error || t('updateSetFail'), variant: 'destructive' })
          return
        }
        toast({ title: t('success'), description: t('updateSetSuccess') })
        setEditingPictureSet(null)
        setActiveTab('list')
        setTimeout(async ()=> { await fetchPictureSets() }, 0)
      } else {
        const res = await fetch('/api/admin/picture-sets', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPictureSet)
        })
        const data = await res.json().catch(()=> ({}))
        if (!res.ok) {
          console.error('API create picture-set failed:', data)
          toast({ title: t('error'), description: data?.error || t('createSetFail'), variant: 'destructive' })
          return
        }
        toast({ title: t('success'), description: t('createSetSuccess') })
        setActiveTab('list')
        await fetchPictureSets()
      }
    } catch (e) {
      console.error('Error in handleSubmitPictureSetServer:', e)
      toast({ title: t('error'), description: t('unexpectedError'), variant: 'destructive' })
    }
  }

  // --- Helpers: translations and tags for picture_set ---
  const upsertSetTranslation = async (
    picture_set_id: number,
    locale: 'en' | 'zh',
    t?: { title?: string; subtitle?: string; description?: string }
  ) => {
    if (!t) return
    const payload = {
      picture_set_id,
      locale,
      title: t.title || '',
      subtitle: t.subtitle || null,
      description: t.description || null,
    }
    const { error } = await supabase
      .from('picture_set_translations')
      .upsert(payload, { onConflict: 'picture_set_id,locale' })
    if (error) throw error
  }

  const upsertPictureTranslation = async (
    picture_id: number,
    locale: 'en' | 'zh',
    t?: { title?: string; subtitle?: string; description?: string }
  ) => {
    if (!t) return
    const payload = {
      picture_id,
      locale,
      title: t.title || '',
      subtitle: t.subtitle || null,
      description: t.description || null,
    }
    const { error } = await supabase
      .from('picture_translations')
      .upsert(payload, { onConflict: 'picture_id,locale' })
    if (error) throw error
  }

  // --- Helpers: auto-translate missing fields with language detection ---
  const translateText = async (
    text: string,
    source: 'en' | 'zh' | 'auto' = 'auto',
    target: 'en' | 'zh' = 'zh',
  ): Promise<string> => {
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLang: source, targetLang: target }),
      })
      if (!res.ok) return ''
      const data = await res.json()
      const translated = (data.translated as string) || ''
      const cleaned = translated.trim()
      const hasCJK = /[\u4e00-\u9fff]/.test(cleaned)
      if (target === 'zh') {
        return hasCJK ? cleaned : ''
      }
      if (target === 'en') {
        return hasCJK ? '' : cleaned
      }
      return cleaned
    } catch (e) {
      console.error('translateText error', e)
      return ''
    }
  }

  const autoFillTranslations = async (payload: PictureSetSubmitData) => {
    // Base fields
    const base = {
      title: payload.title ?? '',
      subtitle: payload.subtitle ?? '',
      description: payload.description ?? '',
    }

    const enOut = {
      title: payload.en?.title ?? '',
      subtitle: payload.en?.subtitle ?? '',
      description: payload.en?.description ?? '',
    }
    const zhOut = {
      title: payload.zh?.title ?? '',
      subtitle: payload.zh?.subtitle ?? '',
      description: payload.zh?.description ?? '',
    }

    // Helper to detect if a string looks Chinese
    const isZh = (s?: string) => /[\u4e00-\u9fff]/.test(String(s || ''))

    // For each field, fill both sides using base and detection
    for (const key of ['title', 'subtitle', 'description'] as const) {
      const b = base[key]
      let enVal = enOut[key] || ''
      let zhVal = zhOut[key] || ''

      if (!enVal && !zhVal && b) {
        if (isZh(b)) {
          zhVal = b
          enVal = await translateText(b, 'auto', 'en')
        } else {
          enVal = b
          zhVal = await translateText(b, 'auto', 'zh')
        }
      } else if (!enVal && zhVal) {
        enVal = await translateText(zhVal, 'auto', 'en')
      } else if (!zhVal && enVal) {
        zhVal = await translateText(enVal, 'auto', 'zh')
      }

      enOut[key] = enVal
      zhOut[key] = zhVal
    }

    return { en: enOut, zh: zhOut }
  }

  const autoFillPictureTranslations = async (p: any) => {
    const base = {
      title: p?.title ?? '',
      subtitle: p?.subtitle ?? '',
      description: p?.description ?? '',
    }
    const enOut: { title: string; subtitle: string; description: string } = {
      title: p?.en?.title ?? '',
      subtitle: p?.en?.subtitle ?? '',
      description: p?.en?.description ?? '',
    }
    const zhOut: { title: string; subtitle: string; description: string } = {
      title: p?.zh?.title ?? '',
      subtitle: p?.zh?.subtitle ?? '',
      description: p?.zh?.description ?? '',
    }

    const isZh = (s?: string) => /[\u4e00-\u9fff]/.test(String(s || ''))

    for (const key of ['title', 'subtitle', 'description'] as const) {
      const b = base[key]
      let enVal = enOut[key] || ''
      let zhVal = zhOut[key] || ''

      if (!enVal && !zhVal && b) {
        if (isZh(b)) {
          zhVal = b
          enVal = await translateText(b, 'auto', 'en')
        } else {
          enVal = b
          zhVal = await translateText(b, 'auto', 'zh')
        }
      } else if (!enVal && zhVal) {
        enVal = await translateText(zhVal, 'auto', 'en')
      } else if (!zhVal && enVal) {
        zhVal = await translateText(enVal, 'auto', 'zh')
      }

      enOut[key] = enVal
      zhOut[key] = zhVal
    }

    return { en: enOut, zh: zhOut }
  }

  // Safely reorder pictures by desired IDs order to avoid unique conflicts
  const reorderPicturesSafely = async (picture_set_id: number, desiredIdsInOrder: number[]) => {
    try {
      const { data: dbPics, error: dbErr } = await supabase
        .from('pictures')
        .select('id, order_index')
        .eq('picture_set_id', picture_set_id)
      if (dbErr) {
        console.warn('reorderPicturesSafely: fetch failed', dbErr)
        return
      }
      if (!dbPics || dbPics.length === 0) return

      // Log current and desired
      console.log('Reorder(safe): current DB order:', dbPics.map(p => ({ id: p.id, oi: p.order_index })))
      console.log('Reorder(safe): desired order IDs:', desiredIdsInOrder)

      // First pass: bump indices to avoid collisions
      for (const p of dbPics) {
        const { error: up1 } = await supabase
          .from('pictures')
          .update({ order_index: (p.order_index ?? 0) + 1000 })
          .eq('id', p.id)
        if (up1) console.warn('Reorder(safe): bump failed for', p.id, up1)
      }

      // Second pass: set final indices following desired order
      for (const [idx, id] of desiredIdsInOrder.entries()) {
        const { error: up2 } = await supabase
          .from('pictures')
          .update({ order_index: idx })
          .eq('id', id)
        if (up2) console.warn('Reorder(safe): final set failed for', id, up2)
      }

      // Log final
      const { data: finalPics } = await supabase
        .from('pictures')
        .select('id, order_index')
        .eq('picture_set_id', picture_set_id)
        .order('order_index', { ascending: true })
      if (finalPics) console.log('Reorder(safe): final DB order:', finalPics.map(p => ({ id: p.id, oi: p.order_index })))
    } catch (e) {
      console.warn('reorderPicturesSafely error', e)
    }
  }

  const ensureTagIds = async (names: string[] = [], type: string = 'topic'): Promise<number[]> => {
    const uniq = Array.from(new Set(names.map(n => n.trim()).filter(Boolean)))
    if (uniq.length === 0) return []
    // compute simple slugs and upsert on slug unique
    const toInsert = uniq.map(name => ({
      name,
      type,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
    }))
    const up = await supabase.from('tags').upsert(toInsert, { onConflict: 'slug' })
    if (up.error) {
      console.error('Upsert tags failed:', up.error)
      // continue to try select existing tag ids even if upsert failed (e.g., RLS)
    }
    const { data, error } = await supabase
      .from('tags')
      .select('id, name')
      .in('name', uniq)
      .eq('type', type)
    if (error) {
      console.error('Select tags failed:', error)
      throw error
    }
    return (data || []).map(d => d.id)
  }

  const setSetTags = async (picture_set_id: number, tagIds: number[]) => {
    const { data: existing } = await supabase
      .from('picture_set_taggings')
      .select('tag_id')
      .eq('picture_set_id', picture_set_id)
    const oldIds = new Set((existing || []).map(r => r.tag_id))
    const newIds = new Set(tagIds)
    const toAdd = [...newIds].filter(id => !oldIds.has(id)).map(id => ({ picture_set_id, tag_id: id }))
    const toRemove = [...oldIds].filter(id => !newIds.has(id))
    if (toAdd.length) await supabase.from('picture_set_taggings').insert(toAdd)
    if (toRemove.length) await supabase.from('picture_set_taggings').delete().in('tag_id', toRemove).eq('picture_set_id', picture_set_id)
  }

  const setPictureTags = async (picture_id: number, tagIds: number[]) => {
    const { data: existing } = await supabase
      .from('picture_taggings')
      .select('tag_id')
      .eq('picture_id', picture_id)
    const oldIds = new Set((existing || []).map(r => r.tag_id))
    const newIds = new Set(tagIds)
    const toAdd = [...newIds].filter(id => !oldIds.has(id)).map(id => ({ picture_id, tag_id: id }))
    const toRemove = [...oldIds].filter(id => !newIds.has(id))
    if (toAdd.length) await supabase.from('picture_taggings').insert(toAdd)
    if (toRemove.length) await supabase.from('picture_taggings').delete().in('tag_id', toRemove).eq('picture_id', picture_id)
  }

  // Simple client-side geocode via our API; returns { lat, lon } or null
  const geocodeByName = async (q?: string): Promise<{ lat: number; lon: number } | null> => {
    try {
      if (!q || !q.trim()) return null
      const res = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, limit: 1 }) })
      if (!res.ok) return null
      const data = await res.json()
      const g = data?.results?.[0]
      if (g && typeof g.lat === 'number' && typeof g.lon === 'number') return { lat: g.lat, lon: g.lon }
    } catch {}
    return null
  }

  // Helper function to delete a file from R2 with proper error handling and logging
  const safeDeleteFromR2 = async (url: string | null | undefined): Promise<boolean> => {
    if (!url) {
      console.log("No URL provided to safeDeleteFromR2, skipping")
      return true // Nothing to delete
    }

    try {
      console.log(`Attempting to delete file from R2: ${url}`)

      // Directly call deleteFileFromR2 with the URL
      const success = await deleteFileFromR2(url)

      if (success) {
        console.log(`Successfully deleted file from R2: ${url}`)
      } else {
        console.error(`Failed to delete file from R2: ${url}`)
      }

      return success
    } catch (error) {
      console.error(`Error in safeDeleteFromR2 for URL (${url}):`, error)
      return false
    }
  }

  // Helper function to compare pictures and find ones to delete
  const findPicturesToDelete = (
    existingPictures: Picture[] | null | undefined,
    updatedPictures: PictureFormData[],
  ): Picture[] => {
    if (!existingPictures || existingPictures.length === 0) {
      return []
    }

    // Get IDs of pictures in the updated set
    const updatedIds = updatedPictures.filter((p) => p.id !== undefined).map((p) => p.id as number)

    // Find pictures that exist in the database but not in the updated set
    return existingPictures.filter((p) => !updatedIds.includes(p.id))
  }

  /* LEGACY_DISABLED: client-side submit (replaced by server API)
  const handleSubmitPictureSet = async (newPictureSet: PictureSetSubmitData, pictureSetId?: number) => {
    // Simple helpers for transient errors (e.g., 429 Too Many Requests)
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))
    const withRetry = async <T extends { data?: any; error?: any }>(fn: () => Promise<T>, tries: number = 3): Promise<T> => {
      let last: T | undefined
      for (let i = 0; i < tries; i++) {
        const res = await fn()
        if (!res?.error) return res
        const err = res.error
        const msg = String(err?.message || err || '')
        const code = String(err?.code || '')
        if (code === '429' || /too many requests|rate/i.test(msg)) {
          await sleep(400 * Math.pow(2, i))
          last = res
          continue
        }
        return res
      }
      return last as T
    }
    try {
      console.log("Submitting picture set with position:", newPictureSet.position)
      console.log(`Picture set has ${newPictureSet.pictures.length} pictures`)

      if (pictureSetId) {
        // EDITING EXISTING PICTURE SET
        console.log(`Editing existing picture set with ID: ${pictureSetId}`)

        // Get the existing picture set to compare and handle file deletions
        const { data: existingSet, error: fetchError } = await supabase
          .from("picture_sets")
          .select("cover_image_url")
          .eq("id", pictureSetId)
          .single()

        if (fetchError) {
          console.error(`Error fetching picture set ${pictureSetId}:`, fetchError)
          toast({
            title: "Error",
            description: "Failed to fetch picture set data",
            variant: "destructive",
          })
          return
        }

        // Get existing pictures
        const { data: existingPictures, error: picturesError } = await supabase
          .from("pictures")
          .select("*")
          .eq("picture_set_id", pictureSetId)

        if (picturesError) {
          console.error(`Error fetching pictures for set ${pictureSetId}:`, picturesError)
          toast({
            title: "Error",
            description: "Failed to fetch picture data",
            variant: "destructive",
          })
          return
        }

        console.log(`Found ${existingPictures?.length || 0} existing pictures in database`)

        // Find pictures to delete (in existing but not in updated)
        const picturesToDelete = findPicturesToDelete(existingPictures, newPictureSet.pictures)
        const idsToDelete = picturesToDelete.map((p) => p.id)

        console.log(`Found ${picturesToDelete.length} pictures to delete:`, idsToDelete)

        // Delete removed pictures from R2 storage first
        for (const picture of picturesToDelete) {
          console.log(`Processing deletion for picture ${picture.id}`)

          // Delete compressed image
          if (picture.image_url) {
            console.log(`Deleting compressed image: ${picture.image_url}`)
            const imageDeleted = await safeDeleteFromR2(picture.image_url)
            console.log(`Deleted compressed image for picture ${picture.id}: ${imageDeleted ? "Success" : "Failed"}`)
          } else {
            console.log(`No compressed image URL for picture ${picture.id}`)
          }

          // Delete raw image
          if (picture.raw_image_url) {
            console.log(`Deleting raw image: ${picture.raw_image_url}`)
            const rawDeleted = await safeDeleteFromR2(picture.raw_image_url)
            console.log(`Deleted raw image for picture ${picture.id}: ${rawDeleted ? "Success" : "Failed"}`)
          } else {
            console.log(`No raw image URL for picture ${picture.id}`)
          }
        }

        // Then delete from database
        if (idsToDelete.length > 0) {
          console.log(`Deleting ${idsToDelete.length} pictures from database:`, idsToDelete)
          const { error: deleteError } = await supabase.from("pictures").delete().in("id", idsToDelete)

          if (deleteError) {
            console.error("Error deleting pictures from database:", deleteError)
            toast({
              title: "Error",
              description: "Failed to delete pictures from database",
              variant: "destructive",
            })
          } else {
            console.log(`Successfully deleted ${idsToDelete.length} pictures from database`)
          }
        }

        // If cover image was changed, delete the old one from R2
        if (
          existingSet &&
          existingSet.cover_image_url &&
          existingSet.cover_image_url !== newPictureSet.cover_image_url
        ) {
          console.log(`Cover image changed. Deleting old cover: ${existingSet.cover_image_url}`)
          await safeDeleteFromR2(existingSet.cover_image_url)
        }

        // Update existing picture set
        const upd = await withRetry(() => supabase
          .from("picture_sets").update({
            title: newPictureSet.title,
            subtitle: newPictureSet.subtitle,
            description: newPictureSet.description,
            cover_image_url: newPictureSet.cover_image_url,
            position: newPictureSet.position,
            is_published: newPictureSet.is_published ?? true,
            primary_category_id: newPictureSet.primary_category_id ?? null,
            season_id: newPictureSet.season_id ?? null,
          }).eq("id", pictureSetId))
        const updateError = upd.error

        if (updateError) {
          console.error("Error updating picture set:", updateError)
          toast({
            title: "Error",
            description: "Failed to update picture set",
            variant: "destructive",
          })
          return
        }

        // Update sections assignments (multi)
        try {
          let desiredSectionIds = Array.from(new Set(newPictureSet.section_ids || []))
          // also add a section by derived position if no explicit mapping
          const { data: secs } = await supabase.from('sections').select('id,name')
          const findBy = (want: 'up'|'down') => {
            const re = want === 'down' ? /\bdown\b|bottom|下|底/i : /\bup\b|top|上|顶/i
            return (secs || []).find((s:any)=> re.test(String(s.name||'')))?.id as number | undefined
          }
          const pos = (newPictureSet.position||'').trim().toLowerCase()
          const autoId = pos === 'down' ? findBy('down') : findBy('up')
          if (autoId && !desiredSectionIds.includes(autoId)) desiredSectionIds = [...desiredSectionIds, autoId]

          const { data: existingAssigns } = await supabase
            .from('picture_set_section_assignments')
            .select('section_id')
            .eq('picture_set_id', pictureSetId)
          const existingIds = new Set((existingAssigns || []).map((r:any)=>r.section_id))
          const toAdd = desiredSectionIds.filter(id => !existingIds.has(id)).map(id => ({ picture_set_id: pictureSetId, section_id: id, page_context: 'default', display_order: 0 }))
          const toRemove = [...existingIds].filter(id => !desiredSectionIds.includes(id))
          if (toAdd.length) await supabase.from('picture_set_section_assignments').insert(toAdd)
          if (toRemove.length) await supabase.from('picture_set_section_assignments').delete().eq('picture_set_id', pictureSetId).in('section_id', toRemove)
        } catch (e) {
          console.warn('Update sections failed', e)
        }

        // Upsert primary location if provided (geocode if lat/lng missing)
        try {
          const nm = newPictureSet.primary_location_name?.trim()
          let lat = newPictureSet.primary_location_latitude as number | null
          let lng = newPictureSet.primary_location_longitude as number | null
          if (nm && (lat == null || lng == null)) {
            const g = await geocodeByName(nm)
            if (g) { lat = g.lat; lng = g.lon }
          }
          if (nm && typeof lat === 'number' && typeof lng === 'number') {
            // find existing identical location or create
            let locationId: number | undefined
            const { data: found } = await supabase
              .from('locations')
              .select('id')
              .eq('name', nm)
              .eq('latitude', lat)
              .eq('longitude', lng)
              .maybeSingle()
            if (found?.id) locationId = found.id
            else {
              const { data: created, error: locErr } = await supabase
                .from('locations')
                .insert({ name: nm, latitude: lat, longitude: lng })
                .select('id')
                .single()
              if (locErr) throw locErr
              locationId = created.id
            }
            if (locationId) {
              // ensure only one primary location: delete then insert
              await supabase.from('picture_set_locations').delete().eq('picture_set_id', pictureSetId)
              await supabase.from('picture_set_locations').insert({ picture_set_id: pictureSetId, location_id: locationId, is_primary: true })
            }
          }
        } catch (e) {
          console.warn('Upsert primary location failed', e)
        }

        // Auto-fill translations (translate missing zh from English), then upsert; and set tags for the set
        try {
          const filled = await autoFillTranslations(newPictureSet)
          await upsertSetTranslation(pictureSetId, 'en', filled.en)
          await upsertSetTranslation(pictureSetId, 'zh', filled.zh)
          // Auto-generate set tags if none provided
          let setTags = newPictureSet.tags || []
          if (!setTags || setTags.length === 0) {
            const coverUrl = newPictureSet.cover_image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${newPictureSet.cover_image_url}` : undefined
            const firstPic = (newPictureSet.pictures || []).find(p => p.image_url)
            const fallbackUrl = firstPic?.image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${firstPic.image_url}` : undefined
            try {
              const res = await fetch('/api/analyze-image', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: coverUrl || fallbackUrl, analysisType: 'tags' })
              })
              const data = await res.json()
              if (res.ok && data?.success) {
                setTags = Array.from(new Set(String(data.result).replace(/\n/g, ',').split(/[,，;；]/).map((s: string)=>s.trim().toLowerCase()).filter(Boolean)))
              }
            } catch {}
          }
          // topic tags
          const topicTagIds = await ensureTagIds(setTags || [], 'topic')
          // category tags from selected category IDs
          let categoryTagIds: number[] = []
          const selectedCategoryIds = Array.from(new Set(newPictureSet.category_ids || []))
          if (selectedCategoryIds.length) {
            const { data: catRows } = await supabase.from('categories').select('id,name').in('id', selectedCategoryIds)
            const catNames = (catRows || []).map((r:any)=> r.name).filter(Boolean)
            categoryTagIds = await ensureTagIds(catNames, 'category')
          }
          // season tags from selected season IDs
          let seasonTagIds: number[] = []
          const selectedSeasonIds = Array.from(new Set(newPictureSet.season_ids || []))
          if (selectedSeasonIds.length) {
            const { data: seaRows } = await supabase.from('seasons').select('id,name').in('id', selectedSeasonIds)
            const seaNames = (seaRows || []).map((r:any)=> r.name).filter(Boolean)
            seasonTagIds = await ensureTagIds(seaNames, 'season')
          }
          const combined = Array.from(new Set([...(topicTagIds||[]), ...(categoryTagIds||[]), ...(seasonTagIds||[])]))
          await setSetTags(pictureSetId, combined)
        } catch (e) {
          console.error('Error updating translations/tags for set:', e)
          toast({ title: t('error'), description: 'Failed to save set tags/translations. Check permissions or network.', variant: 'destructive' })
        }

        // Precompute single-select category/season for propagation to pictures
        let __singleSeasonId: number | null = null
        let __singleSeasonTagIds: number[] = []
        let __singleCategoryTagIds: number[] = []
        try {
          const selSeasons = Array.from(new Set(newPictureSet.season_ids || []))
          if (selSeasons.length === 1) {
            __singleSeasonId = selSeasons[0]
            const { data: seaRows } = await supabase.from('seasons').select('id,name').in('id', selSeasons)
            const seaNames = (seaRows || []).map((r:any)=> r.name).filter(Boolean)
            if (seaNames.length === 1) __singleSeasonTagIds = await ensureTagIds(seaNames, 'season')
          }
          const selCats = Array.from(new Set(newPictureSet.category_ids || []))
          if (selCats.length === 1) {
            const { data: catRows } = await supabase.from('categories').select('id,name').in('id', selCats)
            const catNames = (catRows || []).map((r:any)=> r.name).filter(Boolean)
            if (catNames.length === 1) __singleCategoryTagIds = await ensureTagIds(catNames, 'category')
          }
        } catch (e) { console.warn('Precompute per-picture propagated tags failed', e) }

        const allowApplySetProps = !!(newPictureSet.fill_missing_from_set ?? newPictureSet.apply_set_props_to_pictures)
        const allowOverrideExisting = !!newPictureSet.override_existing_picture_props
        const allowPropagateCategories = !!newPictureSet.propagate_categories_to_pictures
        const autoGenTitlesSubtitles = !!newPictureSet.autogen_titles_subtitles

        // Update or insert pictures
        for (const [index, picture] of newPictureSet.pictures.entries()) {
          if (picture.id) {
            // Find the existing picture to compare URLs
            const existingPicture = existingPictures?.find((p) => p.id === picture.id)

            // Auto-generate title/subtitle if requested and missing (update path)
            try {
              if (autoGenTitlesSubtitles) {
                if (!picture.title?.trim()) {
                  const picUrl = picture.image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${picture.image_url}` : undefined
                  if (picUrl) {
                    const res = await fetch('/api/analyze-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: picUrl, analysisType: 'title' }) })
                    const data = await res.json(); if (res.ok && data?.success) picture.title = String(data.result).trim()
                  }
                }
                if (!picture.subtitle?.trim()) {
                  const picUrl = picture.image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${picture.image_url}` : undefined
                  if (picUrl) {
                    const res = await fetch('/api/analyze-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: picUrl, analysisType: 'subtitle' }) })
                    const data = await res.json(); if (res.ok && data?.success) picture.subtitle = String(data.result).trim()
                  }
                }
              }
            } catch {}

            // Update existing picture
            const upPic = await withRetry(() => supabase
              .from("pictures").update({
                title: picture.title,
                subtitle: picture.subtitle,
                description: picture.description,
                image_url: picture.image_url || undefined,
                raw_image_url: picture.raw_image_url || undefined,
                season_id: (allowApplySetProps
                  ? (allowOverrideExisting ? (__singleSeasonId ?? picture.season_id ?? null)
                    : (picture.season_id ?? (__singleSeasonId ?? null)))
                  : (picture.season_id ?? null)),
                order_index: index,
              }).eq("id", picture.id))
            const pictureUpdateError = upPic.error

            if (pictureUpdateError) {
              console.error(`Error updating picture ${picture.id}:`, pictureUpdateError)
              continue
            }

            // Picture translations (auto-fill zh)
            try {
              const filled = await autoFillPictureTranslations(picture)
              await upsertPictureTranslation(picture.id, 'en', filled.en)
              await upsertPictureTranslation(picture.id, 'zh', filled.zh)
            } catch (e) {
              console.error('Error upserting picture translations (update):', e)
            }

            // Picture tags (auto-generate if missing) and propagate category/season tags
            try {
              let pTags = picture.tags || []
              if (!pTags || pTags.length === 0) {
                const picUrl = picture.image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${picture.image_url}` : undefined
                try {
                  const res = await fetch('/api/analyze-image', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageUrl: picUrl, analysisType: 'tags' })
                  })
                  const data = await res.json()
                  if (res.ok && data?.success) {
                    pTags = Array.from(new Set(String(data.result).replace(/\n/g, ',').split(/[,，;；]/).map((s: string)=>s.trim().toLowerCase()).filter(Boolean)))
                  }
                } catch {}
              }
              const pTagIds = await ensureTagIds(pTags || [], 'topic')
              let catTagIds: number[] = []
              const picCatIds = Array.isArray((picture as any).picture_category_ids) ? (picture as any).picture_category_ids as number[] : []
              if (picCatIds.length) {
                const { data: catRows } = await supabase.from('categories').select('id,name').in('id', picCatIds)
                const names = (catRows || []).map((r:any)=> r.name).filter(Boolean)
                catTagIds = await ensureTagIds(names, 'category')
              } else if (allowPropagateCategories) {
                catTagIds = Array.from(new Set([...(__singleCategoryTagIds||[]), ...(__singleSeasonTagIds||[])]))
              }
              const combined = Array.from(new Set([...(pTagIds||[]), ...catTagIds]))
              await setPictureTags(picture.id, combined)
            } catch (e) {
              console.error('Error updating picture tags:', e)
              toast({ title: 'Tag error', description: `Failed to save tags for picture #${picture.id}. Check permissions or network.`, variant: 'destructive' })
            }

            // Upsert picture primary location (optional; geocode if needed)
            try {
              const nm = (picture as any).location_name?.trim()
              let plat = (picture as any).location_latitude as number | null
              let plng = (picture as any).location_longitude as number | null
              if (nm && (plat == null || plng == null)) {
                const g = await geocodeByName(nm)
                if (g) { plat = g.lat; plng = g.lon }
              }
              if (nm && typeof plat === 'number' && typeof plng === 'number') {
                let locationId: number | undefined
                const { data: found } = await supabase
                  .from('locations')
                  .select('id')
                  .eq('name', nm)
                  .eq('latitude', plat)
                  .eq('longitude', plng)
                  .maybeSingle()
                if (found?.id) locationId = found.id
                else {
                  const { data: created, error: locErr } = await supabase
                    .from('locations')
                    .insert({ name: nm, latitude: plat, longitude: plng })
                    .select('id')
                    .single()
                  if (locErr) throw locErr
                  locationId = created.id
                }
                if (locationId) {
                  // replace existing mapping with new primary
                  await supabase.from('picture_locations').delete().eq('picture_id', picture.id)
                  await supabase.from('picture_locations').insert({ picture_id: picture.id, location_id: locationId, is_primary: true })
                }
              }
            } catch (e) {
              console.warn('Upsert picture primary location failed', e)
            }

            // Delete old images if they were replaced
            if (existingPicture) {
              if (existingPicture.image_url && existingPicture.image_url !== picture.image_url) {
                console.log(
                  `Image URL changed for picture ${picture.id}. Deleting old image: ${existingPicture.image_url}`,
                )
                await safeDeleteFromR2(existingPicture.image_url)
              }
              if (existingPicture.raw_image_url && existingPicture.raw_image_url !== picture.raw_image_url) {
                console.log(
                  `Raw image URL changed for picture ${picture.id}. Deleting old raw image: ${existingPicture.raw_image_url}`,
                )
                await safeDeleteFromR2(existingPicture.raw_image_url)
              }
            }
          } else {
            // Insert new picture (auto-generate title/subtitle if requested and missing)
            try {
              if (autoGenTitlesSubtitles) {
                if (!picture.title?.trim()) {
                  const picUrl = picture.image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${picture.image_url}` : undefined
                  if (picUrl) {
                    const res = await fetch('/api/analyze-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: picUrl, analysisType: 'title' }) })
                    const data = await res.json(); if (res.ok && data?.success) picture.title = String(data.result).trim()
                  }
                }
                if (!picture.subtitle?.trim()) {
                  const picUrl = picture.image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${picture.image_url}` : undefined
                  if (picUrl) {
                    const res = await fetch('/api/analyze-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: picUrl, analysisType: 'subtitle' }) })
                    const data = await res.json(); if (res.ok && data?.success) picture.subtitle = String(data.result).trim()
                  }
                }
              }
            } catch {}
            // Insert new picture
            console.log(`Inserting new picture at index ${index}`)
            const insPic = await withRetry(() => supabase.from("pictures").insert({
              picture_set_id: pictureSetId,
              order_index: index,
              title: picture.title,
              subtitle: picture.subtitle,
              description: picture.description,
              image_url: picture.image_url,
              raw_image_url: picture.raw_image_url,
              season_id: (allowApplySetProps
                ? (allowOverrideExisting ? (__singleSeasonId ?? picture.season_id ?? null)
                  : (picture.season_id ?? (__singleSeasonId ?? null)))
                : (picture.season_id ?? null)),
            }).select('id').single())
            const insertedPic = insPic.data
            const pictureInsertError = insPic.error

            if (pictureInsertError) {
              console.error("Error inserting new picture:", pictureInsertError)
            } else if (insertedPic?.id) {
              try {
                const filled = await autoFillPictureTranslations(picture)
                await upsertPictureTranslation(insertedPic.id, 'en', filled.en)
                await upsertPictureTranslation(insertedPic.id, 'zh', filled.zh)
              } catch (e) {
                console.error('Error upserting picture translations (insert):', e)
              }

              try {
                let pTags = picture.tags || []
                if (!pTags || pTags.length === 0) {
                  const picUrl = picture.image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${picture.image_url}` : undefined
                  try {
                    const res = await fetch('/api/analyze-image', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ imageUrl: picUrl, analysisType: 'tags' })
                    })
                    const data = await res.json()
                    if (res.ok && data?.success) {
                      pTags = Array.from(new Set(String(data.result).replace(/\n/g, ',').split(/[,，;；]/).map((s: string)=>s.trim().toLowerCase()).filter(Boolean)))
                    }
                  } catch {}
                }
                const pTagIds = await ensureTagIds(pTags || [], 'topic')
                const extra = (!allowPropagateCategories || (pTags && pTags.length > 0)) ? [] : Array.from(new Set([...
                  (__singleCategoryTagIds||[]), ...(__singleSeasonTagIds||[])]))
                const combined = Array.from(new Set([...(pTagIds||[]), ...extra]))
                await setPictureTags(insertedPic.id, combined)
              } catch (e) {
                console.error('Error inserting picture tags:', e)
                toast({ title: t('error'), description: 'Failed to save tags for the new picture. Check permissions or network.', variant: 'destructive' })
              }

              // Picture primary location (optional; geocode if needed)
              try {
                const nm = (picture as any).location_name?.trim()
                let plat = (picture as any).location_latitude as number | null
                let plng = (picture as any).location_longitude as number | null
                if (nm && (plat == null || plng == null)) {
                  const g = await geocodeByName(nm)
                  if (g) { plat = g.lat; plng = g.lon }
                }
                if (nm && typeof plat === 'number' && typeof plng === 'number') {
                  let locationId: number | undefined
                  const { data: found } = await supabase
                    .from('locations')
                    .select('id')
                    .eq('name', nm)
                    .eq('latitude', plat)
                    .eq('longitude', plng)
                    .maybeSingle()
                  if (found?.id) locationId = found.id
                  else {
                    const { data: created, error: locErr } = await supabase
                      .from('locations')
                      .insert({ name: nm, latitude: plat, longitude: plng })
                      .select('id')
                      .single()
                    if (locErr) throw locErr
                    locationId = created.id
                  }
                  if (locationId) {
                    await supabase.from('picture_locations').insert({ picture_id: insertedPic.id, location_id: locationId, is_primary: true })
                  }
                }
              } catch (e) {
                console.warn('Insert picture primary location failed', e)
              }
            }
          }
        }

        // Robust reorder: two-pass bump then set to avoid collisions
        try {
          // Build desired order by IDs; for new images that were updated (should have id), we will refetch to resolve
          const { data: dbPicsAll } = await supabase
            .from('pictures')
            .select('id, image_url')
            .eq('picture_set_id', pictureSetId)

          // Map image_url -> id as fallback
          const urlToId = new Map<string, number>()
          for (const r of dbPicsAll || []) {
            if (r.image_url) urlToId.set(r.image_url, r.id)
          }

          const desiredIds: number[] = []
          for (const p of newPictureSet.pictures) {
            if (typeof p.id === 'number') desiredIds.push(p.id)
            else if (p.image_url && urlToId.has(p.image_url)) desiredIds.push(urlToId.get(p.image_url) as number)
          }
          if (desiredIds.length > 0) await reorderPicturesSafely(pictureSetId, desiredIds)
        } catch (verr) {
          console.warn('Safe reorder encountered an error:', verr)
        }

        toast({ title: t('success'), description: t('updateSetSuccess') })

        // Reset edit mode first - 立即重置编辑状态
        const currentEditingPictureSet = editingPictureSet
        setEditingPictureSet(null)
        setActiveTab("list")
        
        // Refresh the picture sets to update the UI
        // 使用 setTimeout 确保状态重置完成后再刷新数据
        setTimeout(async () => {
          await fetchPictureSets()
        }, 0)
      } else {
        // CREATING NEW PICTURE SET
        console.log("Creating new picture set")

        // Insert new picture set
        const { data: pictureSetData, error: pictureSetError } = await supabase
          .from("picture_sets")
          .insert({
            title: newPictureSet.title,
            subtitle: newPictureSet.subtitle,
            description: newPictureSet.description,
            cover_image_url: newPictureSet.cover_image_url,
            position: newPictureSet.position,
            is_published: newPictureSet.is_published ?? true,
            primary_category_id: newPictureSet.primary_category_id ?? null,
            season_id: newPictureSet.season_id ?? null,
          })
          .select()

        if (pictureSetError) {
          console.error("Error inserting picture set:", pictureSetError)
          toast({ title: t('error'), description: t('createSetFail'), variant: 'destructive' })
          return
        }

        const pictureSetId = pictureSetData[0].id
        console.log(`Created new picture set with ID: ${pictureSetId}`)

        // Sections assignments (ensure top/bottom by derived position if missing)
        try {
          let desiredSectionIds = Array.from(new Set(newPictureSet.section_ids || []))
          // try to find top/bottom section IDs
          const { data: secs } = await supabase.from('sections').select('id,name')
          const findBy = (want: 'up'|'down') => {
            const re = want === 'down' ? /\bdown\b|bottom|下|底/i : /\bup\b|top|上|顶/i
            return (secs || []).find((s:any)=> re.test(String(s.name||'')))?.id as number | undefined
          }
          const pos = (newPictureSet.position||'').trim().toLowerCase()
          const autoId = pos === 'down' ? findBy('down') : findBy('up')
          if (autoId && !desiredSectionIds.includes(autoId)) desiredSectionIds = [...desiredSectionIds, autoId]
          if (desiredSectionIds.length) {
            const rows = desiredSectionIds.map((id:number)=>({ picture_set_id: pictureSetId, section_id: id, page_context: 'default', display_order: 0 }))
            await supabase.from('picture_set_section_assignments').insert(rows)
          }
        } catch (e) {
          console.warn('Insert sections failed', e)
        }

        // Primary location (optional; geocode if lat/lng missing)
        try {
          const nm = newPictureSet.primary_location_name?.trim()
          let lat = newPictureSet.primary_location_latitude as number | null
          let lng = newPictureSet.primary_location_longitude as number | null
          if (nm && (lat == null || lng == null)) {
            const g = await geocodeByName(nm)
            if (g) { lat = g.lat; lng = g.lon }
          }
          if (nm && typeof lat === 'number' && typeof lng === 'number') {
            let locationId: number | undefined
            const { data: found } = await supabase
              .from('locations')
              .select('id')
              .eq('name', nm)
              .eq('latitude', lat)
              .eq('longitude', lng)
              .maybeSingle()
            if (found?.id) locationId = found.id
            else {
              const { data: created, error: locErr } = await supabase
                .from('locations')
                .insert({ name: nm, latitude: lat, longitude: lng })
                .select('id')
                .single()
              if (locErr) throw locErr
              locationId = created.id
            }
            if (locationId) {
              await supabase.from('picture_set_locations').insert({ picture_set_id: pictureSetId, location_id: locationId, is_primary: true })
            }
          }
        } catch (e) {
          console.warn('Insert primary location failed', e)
        }

        // translations and tags for the set (auto-fill zh)
        try {
          const filled = await autoFillTranslations(newPictureSet)
          await upsertSetTranslation(pictureSetId, 'en', filled.en)
          await upsertSetTranslation(pictureSetId, 'zh', filled.zh)
          // Auto-generate set tags if none provided
          let setTags = newPictureSet.tags || []
          if (!setTags || setTags.length === 0) {
            const coverUrl = newPictureSet.cover_image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${newPictureSet.cover_image_url}` : undefined
            const firstPic = (newPictureSet.pictures || []).find(p => p.image_url)
            const fallbackUrl = firstPic?.image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${firstPic.image_url}` : undefined
            try {
              const res = await fetch('/api/analyze-image', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: coverUrl || fallbackUrl, analysisType: 'tags' })
              })
              const data = await res.json()
              if (res.ok && data?.success) {
                setTags = Array.from(new Set(String(data.result).replace(/\n/g, ',').split(/[,，;；]/).map((s: string)=>s.trim().toLowerCase()).filter(Boolean)))
              }
            } catch {}
          }
          const topicTagIds = await ensureTagIds(setTags || [], 'topic')
          // from multi-select categories/seasons, set typed tags
          let categoryTagIds: number[] = []
          const selectedCategoryIds = Array.from(new Set(newPictureSet.category_ids || []))
          if (selectedCategoryIds.length) {
            const { data: catRows } = await supabase.from('categories').select('id,name').in('id', selectedCategoryIds)
            const catNames = (catRows || []).map((r:any)=> r.name).filter(Boolean)
            categoryTagIds = await ensureTagIds(catNames, 'category')
          }
          let seasonTagIds: number[] = []
          const selectedSeasonIds = Array.from(new Set(newPictureSet.season_ids || []))
          if (selectedSeasonIds.length) {
            const { data: seaRows } = await supabase.from('seasons').select('id,name').in('id', selectedSeasonIds)
            const seaNames = (seaRows || []).map((r:any)=> r.name).filter(Boolean)
            seasonTagIds = await ensureTagIds(seaNames, 'season')
          }
          const combined = Array.from(new Set([...(topicTagIds||[]), ...(categoryTagIds||[]), ...(seasonTagIds||[])]))
          await setSetTags(pictureSetId, combined)
        } catch (e) {
          console.error('Error inserting translations/tags for set:', e)
          toast({ title: 'Tag/translation error', description: 'Failed to save set tags/translations. Check permissions or network.', variant: 'destructive' })
        }

        // Insert all pictures (with season/location support)
        for (const [index, picture] of newPictureSet.pictures.entries()) {
          console.log(`Inserting picture at index ${index}`)
          const { data: insertedPic, error: pictureError } = await supabase.from("pictures").insert({
            picture_set_id: pictureSetId,
            order_index: index,
            title: picture.title,
            subtitle: picture.subtitle,
            description: picture.description,
            image_url: picture.image_url,
            raw_image_url: picture.raw_image_url,
            season_id: picture.season_id ?? null,
          }).select('id').single()

          if (pictureError) {
            console.error(`Error inserting picture at index ${index}:`, pictureError)
          } else if (insertedPic?.id) {
            // per-picture primary location
            try {
              const nm = (picture as any).location_name?.trim()
              let plat = (picture as any).location_latitude as number | null
              let plng = (picture as any).location_longitude as number | null
              if (nm && (plat == null || plng == null)) {
                const g = await geocodeByName(nm)
                if (g) { plat = g.lat; plng = g.lon }
              }
              if (nm && typeof plat === 'number' && typeof plng === 'number') {
                let locationId: number | undefined
                const { data: found } = await supabase
                  .from('locations')
                  .select('id')
                  .eq('name', nm)
                  .eq('latitude', plat)
                  .eq('longitude', plng)
                  .maybeSingle()
                if (found?.id) locationId = found.id
                else {
                  const { data: created, error: locErr } = await supabase
                    .from('locations')
                    .insert({ name: nm, latitude: plat, longitude: plng })
                    .select('id')
                    .single()
                  if (locErr) throw locErr
                  locationId = created.id
                }
                if (locationId) {
                  await supabase.from('picture_locations').insert({ picture_id: insertedPic.id, location_id: locationId, is_primary: true })
                }
              }
            } catch (e) {
              console.warn('Insert picture location failed (create)', e)
            }
          }
        }

        // Robust reorder for new set as well
        try {
          const { data: dbPicsAll } = await supabase
            .from('pictures')
            .select('id, image_url')
            .eq('picture_set_id', pictureSetId)
          const urlToId = new Map<string, number>()
          for (const r of dbPicsAll || []) {
            if (r.image_url) urlToId.set(r.image_url, r.id)
          }
          const desiredIds: number[] = []
          for (const p of newPictureSet.pictures) {
            if (typeof p.id === 'number') desiredIds.push(p.id)
            else if (p.image_url && urlToId.has(p.image_url)) desiredIds.push(urlToId.get(p.image_url) as number)
          }
          if (desiredIds.length > 0) await reorderPicturesSafely(pictureSetId, desiredIds)
        } catch (e) {
          console.warn('Safe reorder (create) encountered an error:', e)
        }

        toast({
          title: "Success",
          description: "Picture set created successfully",
        })

        // 新建成功后也切换到列表视图
        setActiveTab("list")
        
        // Refresh the picture sets to update the UI
        await fetchPictureSets()
      }
    } catch (error) {
      console.error("Error in handleSubmitPictureSet:", error)
      toast({
        title: t('error'),
        description: t('unexpectedError'),
        variant: "destructive",
      })
    }
  }
  */

  // Handle deleting a picture set (服务端删除，规避 RLS 并同步删 R2 文件)
  const handleDeletePictureSet = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/picture-sets/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(()=> ({}))
      if (!res.ok) {
        console.error('Delete set failed:', data)
          toast({ title: t('error'), description: data?.error || t('deleteSetFail'), variant: 'destructive' })
        return
      }
      toast({ title: t('success'), description: t('deleteSetSuccess') })
      await fetchPictureSets()
    } catch (error) {
      console.error('Error in handleDeletePictureSet(server):', error)
      toast({ title: t('error'), description: t('unexpectedDeleteError'), variant: 'destructive' })
    }
  }

  // Handle editing a picture set
  const handleEditPictureSet = async (pictureSet: PictureSet) => {
    try {
      console.log(`Preparing to edit picture set ${pictureSet.id}`)

      // 改为服务端读取完整详情
      const res = await fetch(`/api/admin/picture-sets/${pictureSet.id}`)
      const data = await res.json()
      if (!res.ok) {
        console.error('Load set detail failed:', data)
        toast({ title: t('error'), description: data?.error || t('loadSetDataFail'), variant: 'destructive' })
        return
      }
      setEditingPictureSet(data.item as PictureSet)
      setActiveTab("form")
    } catch (error) {
      console.error("Error in handleEditPictureSet:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  // Handle canceling edit mode
  const handleCancelEdit = () => {
    setEditingPictureSet(null)
    setActiveTab("list")
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">{t('adminDashboard')}</h1>

      {/* Search Bar */}
      <div className="mb-6 flex gap-2 items-center">
        <Input
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <Button size="sm" variant="outline" onClick={() => setSearchQuery("")}>{t('clear')}</Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="list">{t('pictureSetsTab')}</TabsTrigger>
          <TabsTrigger value="form">{editingPictureSet ? t('editSetTab') : t('addNewSetTab')}</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <p>{t('loadingSets')}</p>
            </div>
          ) : (
            <PictureSetList pictureSets={pictureSets} onEdit={handleEditPictureSet} onDelete={handleDeletePictureSet} />
          )}
        </TabsContent>
        <TabsContent value="form">
          <PictureSetForm
            onSubmit={handleSubmitPictureSetServer}
            editingPictureSet={editingPictureSet}
            onCancel={handleCancelEdit}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
