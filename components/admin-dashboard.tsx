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

export function AdminDashboard() {
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
      console.log("Fetching picture sets...")
      const query = (typeof q === 'string' ? q : searchQuery).trim()

      let setsData: any[] | null = null
      let setsError: any = null

      if (query.length === 0) {
        // Base list
        const res = await supabase
          .from("picture_sets")
          .select("*")
          .order("updated_at", { ascending: false })
          .order("created_at", { ascending: false })
        setsData = res.data
        setsError = res.error
      } else {
        console.log(`Searching picture_sets for: ${query}`)
        // Try English websearch FTS first
        const fts = await supabase
          .from('picture_sets')
          .select('*')
          .textSearch('search_vector', query, { type: 'websearch', config: 'english' })
          .order('updated_at', { ascending: false })
          .limit(100)

        if (fts.error) {
          console.warn('FTS search error:', fts.error)
        }

        if (fts.data && fts.data.length > 0) {
          setsData = fts.data
        } else {
          // Fallback: AND all terms against search_text (supports zh + tags)
          const terms = query.split(/\s+/).filter(Boolean)
          let builder: any = supabase.from('picture_sets').select('*')
          for (const t of terms) {
            builder = builder.ilike('search_text', `%${t}%`)
          }
          const andRes = await builder
            .order('updated_at', { ascending: false })
            .limit(100)
          if (andRes.error) {
            setsError = andRes.error
          }
          setsData = andRes.data
        }
      }

      if (setsError) {
        console.error("Error fetching picture sets:", setsError)
        toast({
          title: "Error",
          description: "Failed to load picture sets",
          variant: "destructive",
        })
        return
      }

      console.log(`Found ${setsData?.length || 0} picture sets`)

      // Then fetch pictures for each set
      const sets = await Promise.all(
        (setsData || []).map(async (set) => {
          const { data: picturesData, error: picturesError } = await supabase
            .from("pictures")
            .select("*")
            .eq("picture_set_id", set.id)
            .order("order_index", { ascending: true })

          if (picturesError) {
            console.error(`Error fetching pictures for set ${set.id}:`, picturesError)
          }

          console.log(`Set ${set.id} has ${picturesData?.length || 0} pictures`)

          return {
            ...set,
            pictures: picturesData || [],
          }
        }),
      )

      setPictureSets(sets)

      // Don't automatically update editing state when fetching data
      // This prevents unwanted state changes after submit operations
    } catch (error) {
      console.error("Error in fetchPictureSets:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
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

  // --- Helpers: auto-translate missing zh fields from English/base ---
  const translateText = async (text: string, source: 'en'|'zh' = 'en', target: 'en'|'zh' = 'zh'): Promise<string> => {
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLang: source, targetLang: target }),
      })
      if (!res.ok) return ''
      const data = await res.json()
      return (data.translated as string) || ''
    } catch (e) {
      console.error('translateText error', e)
      return ''
    }
  }

  const autoFillTranslations = async (payload: PictureSetSubmitData) => {
    // base English candidates from main fields if en not provided
    const enTitleBase = payload.en?.title ?? payload.title ?? ''
    const enSubtitleBase = payload.en?.subtitle ?? payload.subtitle ?? ''
    const enDescBase = payload.en?.description ?? payload.description ?? ''

    // ensure en has values (copy from base if not supplied)
    const enOut = {
      title: payload.en?.title ?? enTitleBase ?? '',
      subtitle: payload.en?.subtitle ?? enSubtitleBase ?? '',
      description: payload.en?.description ?? enDescBase ?? '',
    }

    // only translate into zh if missing and we have english text
    const zhOut = {
      title: payload.zh?.title ?? '',
      subtitle: payload.zh?.subtitle ?? '',
      description: payload.zh?.description ?? '',
    }

    if (!zhOut.title && enOut.title) zhOut.title = await translateText(enOut.title, 'en', 'zh')
    if (!zhOut.subtitle && enOut.subtitle) zhOut.subtitle = await translateText(enOut.subtitle, 'en', 'zh')
    if (!zhOut.description && enOut.description) zhOut.description = await translateText(enOut.description, 'en', 'zh')

    return { en: enOut, zh: zhOut }
  }

  const autoFillPictureTranslations = async (p: any) => {
    const enOut = {
      title: p?.en?.title ?? p?.title ?? '',
      subtitle: p?.en?.subtitle ?? p?.subtitle ?? '',
      description: p?.en?.description ?? p?.description ?? '',
    }
    const zhOut = {
      title: p?.zh?.title ?? '',
      subtitle: p?.zh?.subtitle ?? '',
      description: p?.zh?.description ?? '',
    }
    if (!zhOut.title && enOut.title) zhOut.title = await translateText(enOut.title, 'en', 'zh')
    if (!zhOut.subtitle && enOut.subtitle) zhOut.subtitle = await translateText(enOut.subtitle, 'en', 'zh')
    if (!zhOut.description && enOut.description) zhOut.description = await translateText(enOut.description, 'en', 'zh')
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

  // Handle adding or updating a picture set
  const handleSubmitPictureSet = async (newPictureSet: PictureSetSubmitData, pictureSetId?: number) => {
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
        const { error: updateError } = await supabase
          .from("picture_sets")
          .update({
            title: newPictureSet.title,
            subtitle: newPictureSet.subtitle,
            description: newPictureSet.description,
            cover_image_url: newPictureSet.cover_image_url,
            position: newPictureSet.position,
            is_published: newPictureSet.is_published ?? true,
            primary_category_id: newPictureSet.primary_category_id ?? null,
            season_id: newPictureSet.season_id ?? null,
          })
          .eq("id", pictureSetId)

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
          toast({ title: 'Tag/translation error', description: '保存集合标签或翻译失败，请检查权限或网络。', variant: 'destructive' })
        }

        // Update or insert pictures
        for (const [index, picture] of newPictureSet.pictures.entries()) {
          if (picture.id) {
            // Find the existing picture to compare URLs
            const existingPicture = existingPictures?.find((p) => p.id === picture.id)

            // Update existing picture
            const { error: pictureUpdateError } = await supabase
              .from("pictures")
              .update({
                title: picture.title,
                subtitle: picture.subtitle,
                description: picture.description,
                image_url: picture.image_url || undefined,
                raw_image_url: picture.raw_image_url || undefined,
                season_id: picture.season_id ?? null,
                order_index: index,
              })
              .eq("id", picture.id)

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

            // Picture tags (auto-generate if missing)
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
              await setPictureTags(picture.id, pTagIds)
            } catch (e) {
              console.error('Error updating picture tags:', e)
              toast({ title: 'Tag error', description: `图片 #${picture.id} 标签保存失败，请检查权限或网络。`, variant: 'destructive' })
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
            // Insert new picture
            console.log(`Inserting new picture at index ${index}`)
            const { data: insertedPic, error: pictureInsertError } = await supabase.from("pictures").insert({
              picture_set_id: pictureSetId,
              order_index: index,
              title: picture.title,
              subtitle: picture.subtitle,
              description: picture.description,
              image_url: picture.image_url,
              raw_image_url: picture.raw_image_url,
              season_id: picture.season_id ?? null,
            }).select('id').single()

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
              await setPictureTags(insertedPic.id, pTagIds)
              } catch (e) {
                console.error('Error inserting picture tags:', e)
                toast({ title: 'Tag error', description: `新图片标签保存失败，请检查权限或网络。`, variant: 'destructive' })
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

        toast({
          title: "Success",
          description: "Picture set updated successfully",
        })

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
          toast({
            title: "Error",
            description: "Failed to create picture set",
            variant: "destructive",
          })
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
          toast({ title: 'Tag/translation error', description: '保存集合标签或翻译失败，请检查权限或网络。', variant: 'destructive' })
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
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  // Handle deleting a picture set
  const handleDeletePictureSet = async (id: number) => {
    try {
      console.log(`Deleting picture set with ID: ${id}`)

      // First get the picture set and its pictures to delete files from R2
      const { data: pictureSet, error: fetchError } = await supabase
        .from("picture_sets")
        .select("*, pictures(*)")
        .eq("id", id)
        .single()

      if (fetchError) {
        console.error(`Error fetching picture set ${id} for deletion:`, fetchError)
        toast({
          title: "Error",
          description: "Failed to fetch picture set data for deletion",
          variant: "destructive",
        })
        return
      }

      if (!pictureSet) {
        console.error(`Picture set ${id} not found for deletion`)
        toast({
          title: "Error",
          description: "Picture set not found",
          variant: "destructive",
        })
        return
      }

      console.log(`Found picture set with ${pictureSet.pictures?.length || 0} pictures`)

      // Delete cover image from R2
      if (pictureSet.cover_image_url) {
        console.log(`Deleting cover image: ${pictureSet.cover_image_url}`)
        const coverDeleted = await safeDeleteFromR2(pictureSet.cover_image_url)
        console.log(`Cover image deletion ${coverDeleted ? "successful" : "failed"}`)
      }

      // Delete all picture images from R2
      if (pictureSet.pictures && pictureSet.pictures.length > 0) {
        console.log(`Deleting ${pictureSet.pictures.length} pictures from R2`)

        for (const picture of pictureSet.pictures) {
          // Delete compressed image
          if (picture.image_url) {
            console.log(`Deleting compressed image for picture ${picture.id}: ${picture.image_url}`)
            const imageDeleted = await safeDeleteFromR2(picture.image_url)
            console.log(`Deleted compressed image for picture ${picture.id}: ${imageDeleted ? "Success" : "Failed"}`)
          }

          // Delete raw image
          if (picture.raw_image_url) {
            console.log(`Deleting raw image for picture ${picture.id}: ${picture.raw_image_url}`)
            const rawDeleted = await safeDeleteFromR2(picture.raw_image_url)
            console.log(`Deleted raw image for picture ${picture.id}: ${rawDeleted ? "Success" : "Failed"}`)
          }
        }
      }

      // Then delete from database (pictures will be deleted via CASCADE)
      const { error: deleteError } = await supabase.from("picture_sets").delete().eq("id", id)

      if (deleteError) {
        console.error("Error deleting picture set from database:", deleteError)
        toast({
          title: "Error",
          description: "Failed to delete picture set from database",
          variant: "destructive",
        })
        return
      }

      console.log(`Successfully deleted picture set ${id} from database`)

      toast({
        title: "Success",
        description: "Picture set deleted successfully",
      })

      // Refresh the picture sets
      await fetchPictureSets()
    } catch (error) {
      console.error("Error in handleDeletePictureSet:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred during deletion",
        variant: "destructive",
      })
    }
  }

  // Handle editing a picture set
  const handleEditPictureSet = async (pictureSet: PictureSet) => {
    try {
      console.log(`Preparing to edit picture set ${pictureSet.id}`)

      // Fetch the latest data for this picture set to ensure we have the most up-to-date information
      const { data: freshPictureSet, error } = await supabase
        .from("picture_sets")
        .select("*, pictures(*)")
        .eq("id", pictureSet.id)
        .single()

      if (error) {
        console.error("Error fetching picture set for editing:", error)
        toast({
          title: "Error",
          description: "Failed to load picture set data for editing",
          variant: "destructive",
        })
        return
      }

      console.log(
        `Loaded fresh data for picture set ${pictureSet.id} with ${freshPictureSet.pictures?.length || 0} pictures`,
      )

      // Load translations and tags for this set
      const [{ data: tEn }, { data: tZh }] = await Promise.all([
        supabase
          .from('picture_set_translations')
          .select('*')
          .eq('picture_set_id', pictureSet.id)
          .eq('locale', 'en')
          .maybeSingle(),
        supabase
          .from('picture_set_translations')
          .select('*')
          .eq('picture_set_id', pictureSet.id)
          .eq('locale', 'zh')
          .maybeSingle(),
      ])
      const { data: tagRows } = await supabase
        .from('picture_set_taggings')
        .select('tag_id, tags(name)')
        .eq('picture_set_id', pictureSet.id)

      // Load picture translations for all pictures in this set
      const picIds = (freshPictureSet.pictures || []).map((p: any) => p.id)
      let transMap: Record<number, { en?: any; zh?: any }> = {}
      if (picIds.length > 0) {
        const { data: pTrans } = await supabase
          .from('picture_translations')
          .select('*')
          .in('picture_id', picIds)
        for (const t of pTrans || []) {
          const entry = transMap[t.picture_id] || {}
          if (t.locale === 'en') entry.en = { title: t.title || '', subtitle: t.subtitle || '', description: t.description || '' }
          if (t.locale === 'zh') entry.zh = { title: t.title || '', subtitle: t.subtitle || '', description: t.description || '' }
          transMap[t.picture_id] = entry
        }
      }

      // Load picture tags for all pictures in this set
      let picTagMap: Record<number, string[]> = {}
      if (picIds.length > 0) {
        const { data: pTags } = await supabase
          .from('picture_taggings')
          .select('picture_id, tags(name)')
          .in('picture_id', picIds)
        for (const row of pTags || []) {
          const name = (row as any).tags?.name
          const pid = (row as any).picture_id
          if (!name || !pid) continue
          picTagMap[pid] = [...(picTagMap[pid] || []), name]
        }
      }

      // Load picture primary locations for all pictures
      let picLocMap: Record<number, { name?: string; latitude?: number | null; longitude?: number | null }> = {}
      if (picIds.length > 0) {
        const { data: pLocs } = await supabase
          .from('picture_locations')
          .select('picture_id, is_primary, locations(name, latitude, longitude)')
          .in('picture_id', picIds)
        for (const row of pLocs || []) {
          const pid = (row as any).picture_id
          const loc = (row as any).locations
          if (!pid || !loc) continue
          // prefer primary; otherwise any
          const prev = picLocMap[pid]
          if (!prev || (row as any).is_primary) {
            picLocMap[pid] = { name: loc.name, latitude: loc.latitude, longitude: loc.longitude }
          }
        }
      }

      const enriched = {
        ...freshPictureSet,
        en: tEn ? { title: tEn.title || '', subtitle: tEn.subtitle || '', description: tEn.description || '' } : undefined,
        zh: tZh ? { title: tZh.title || '', subtitle: tZh.subtitle || '', description: tZh.description || '' } : undefined,
        tags: (tagRows || []).map((r: any) => r.tags?.name).filter(Boolean),
        pictures: (freshPictureSet.pictures || [])
          .slice()
          .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
          .map((p: any) => ({
          ...p,
          en: transMap[p.id]?.en,
          zh: transMap[p.id]?.zh,
          tags: picTagMap[p.id] || [],
          location_name: picLocMap[p.id]?.name,
          location_latitude: picLocMap[p.id]?.latitude ?? null,
          location_longitude: picLocMap[p.id]?.longitude ?? null,
        })),
      }

      // Set the editing state with the enriched data
      setEditingPictureSet(enriched as PictureSet)
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
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      {/* Search Bar */}
      <div className="mb-6 flex gap-2 items-center">
        <Input
          placeholder="搜索集合：支持中文/英文，多词自动 AND 匹配"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <Button size="sm" variant="outline" onClick={() => setSearchQuery("")}>清空</Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="list">Picture Sets</TabsTrigger>
          <TabsTrigger value="form">{editingPictureSet ? "Edit Picture Set" : "Add New Picture Set"}</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <p>Loading picture sets...</p>
            </div>
          ) : (
            <PictureSetList pictureSets={pictureSets} onEdit={handleEditPictureSet} onDelete={handleDeletePictureSet} />
          )}
        </TabsContent>
        <TabsContent value="form">
          <PictureSetForm
            onSubmit={handleSubmitPictureSet}
            editingPictureSet={editingPictureSet}
            onCancel={handleCancelEdit}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
