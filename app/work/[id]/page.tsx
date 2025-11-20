import { notFound } from "next/navigation"
import { Suspense } from "react"
import PortfolioDetail from "@/components/portfolio-detail"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

const looksZh = (text?: string | null) => /[\u4e00-\u9fff]/.test(String(text || ""))

export const revalidate = 0 // Disable caching for this route

export default async function WorkPage({ params }: { params: { id: string } }) {
  console.log(`Fetching pictures for set ID: ${params.id}`)

  // Fetch pictures based on picture_set_id
  const { data: pictures, error: pictureError } = await supabaseAdmin
    .from("pictures")
    .select("*")
    .eq("picture_set_id", params.id)
    .order("order_index", { ascending: true })

  if (pictureError) {
    console.error("Error fetching pictures:", pictureError)
    notFound()
  }

  console.log(`Found ${pictures?.length || 0} pictures for set ID: ${params.id}`)

  if (!pictures || pictures.length === 0) {
    console.log("No pictures found, returning 404")
    notFound()
  }

  const pictureIds = pictures.map((p) => p.id)

  const { data: pictureTranslations } = pictureIds.length
    ? await supabaseAdmin
        .from('picture_translations')
        .select('picture_id, locale, title, subtitle, description')
        .in('picture_id', pictureIds)
    : { data: [] }

  const pictureTranslationsMap = new Map<number, { en: { title?: string | null; subtitle?: string | null; description?: string | null }; zh: { title?: string | null; subtitle?: string | null; description?: string | null } }>()

  for (const pic of pictures) {
    pictureTranslationsMap.set(pic.id, {
      en: {
        title: pic.title ?? '',
        subtitle: pic.subtitle ?? '',
        description: pic.description ?? '',
      },
      zh: {
        title: '',
        subtitle: '',
        description: '',
      },
    })
  }

  for (const row of pictureTranslations || []) {
    const entry = pictureTranslationsMap.get(row.picture_id)
    if (!entry) continue
    const target = row.locale === 'zh' ? entry.zh : entry.en
    if (row.title) target.title = row.title
    if (row.subtitle) target.subtitle = row.subtitle
    if (row.description) target.description = row.description
  }

  for (const pic of pictures) {
    const entry = pictureTranslationsMap.get(pic.id)
    if (!entry) continue
    const baseTitle = pic.title ?? ''
    const baseSubtitle = pic.subtitle ?? ''
    const baseDescription = pic.description ?? ''

    if (!entry.en.title && !looksZh(baseTitle)) entry.en.title = baseTitle
    if (!entry.en.subtitle && !looksZh(baseSubtitle)) entry.en.subtitle = baseSubtitle
    if (!entry.en.description && !looksZh(baseDescription)) entry.en.description = baseDescription

    if (!entry.zh.title && looksZh(baseTitle)) entry.zh.title = baseTitle
    if (!entry.zh.subtitle && looksZh(baseSubtitle)) entry.zh.subtitle = baseSubtitle
    if (!entry.zh.description && looksZh(baseDescription)) entry.zh.description = baseDescription
  }

  const images = pictures.map((pic) => {
    const translationEntry = pictureTranslationsMap.get(pic.id) || { en: {}, zh: {} }
    return {
      url: pic.image_url || "/placeholder.svg",
      rawUrl: pic.raw_image_url || pic.image_url,
      translations: {
        en: {
          title: translationEntry.en.title || '',
          subtitle: translationEntry.en.subtitle || '',
          description: translationEntry.en.description || '',
        },
        zh: {
          title: translationEntry.zh.title || '',
          subtitle: translationEntry.zh.subtitle || '',
          description: translationEntry.zh.description || '',
        },
      },
    }
  })

  const { data: pictureSet } = await supabaseAdmin
    .from('picture_sets')
    .select('title, subtitle, description, primary_location_name, primary_location_latitude, primary_location_longitude')
    .eq('id', params.id)
    .single()

  const { data: setTranslations } = await supabaseAdmin
    .from('picture_set_translations')
    .select('locale, title, subtitle, description')
    .eq('picture_set_id', params.id)

  const setEntry = {
    en: {
      title: pictureSet?.title ?? '',
      subtitle: pictureSet?.subtitle ?? '',
      description: pictureSet?.description ?? '',
    },
    zh: {
      title: '',
      subtitle: '',
      description: '',
    },
  }

  for (const row of setTranslations || []) {
    const target = row.locale === 'zh' ? setEntry.zh : setEntry.en
    if (row.title) target.title = row.title
    if (row.subtitle) target.subtitle = row.subtitle
    if (row.description) target.description = row.description
  }

  if (!setEntry.zh.title && looksZh(pictureSet?.title)) setEntry.zh.title = pictureSet?.title ?? ''
  if (!setEntry.zh.subtitle && looksZh(pictureSet?.subtitle)) setEntry.zh.subtitle = pictureSet?.subtitle ?? ''
  if (!setEntry.zh.description && looksZh(pictureSet?.description)) setEntry.zh.description = pictureSet?.description ?? ''

  const { data: setLocationRows, error: setLocationError } = await supabaseAdmin
    .from('picture_set_locations')
    .select('id, is_primary, location:locations(name, name_en, name_zh, latitude, longitude)')
    .eq('picture_set_id', params.id)

  if (setLocationError) {
    console.warn('Failed to fetch set locations:', setLocationError)
  }

  const locations =
    setLocationRows
      ?.map((row) => {
        const loc = (row as any).location || (row as any).locations
        if (!loc) return null
        return {
          id: row.id,
          isPrimary: row.is_primary,
          name: loc.name as string | null | undefined,
          name_en: loc.name_en as string | null | undefined,
          name_zh: loc.name_zh as string | null | undefined,
          latitude: typeof loc.latitude === 'number' ? loc.latitude : Number(loc.latitude),
          longitude: typeof loc.longitude === 'number' ? loc.longitude : Number(loc.longitude),
        }
      })
      .filter(Boolean) ?? []

  const resolvedLocations = [...locations]
  if (resolvedLocations.length === 0 && pictureSet?.primary_location_name) {
    resolvedLocations.push({
      id: `primary-${params.id}`,
      isPrimary: true,
      name: pictureSet.primary_location_name,
      name_en: pictureSet.primary_location_name,
      name_zh: pictureSet.primary_location_name,
      latitude: pictureSet.primary_location_latitude ?? null,
      longitude: pictureSet.primary_location_longitude ?? null,
    })
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <PortfolioDetail
        id={params.id}
        images={images}
        translations={setEntry}
        locations={resolvedLocations}
      />
    </Suspense>
  )
}
