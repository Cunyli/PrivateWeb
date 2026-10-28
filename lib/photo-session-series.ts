import { sessionMomentSeries } from "./photo-session-selection"
import { curationVisible } from "./photo-curation"
import type { CurationVisibility } from "./photo-curation"

export type SessionPhoto = {
  id: string
  src: string
  alt: string
}

export type MomentCard = SessionPhoto & {
  title: string
  place: string
  note: string
  featured?: boolean
  tags: string[]
  sourceName?: string
  width?: number
  height?: number
  previewSrc?: string
  previewSrcSet?: string
}

export type MomentGroup = {
  id: string
  title: string
  place: string
  note: string
  featured?: boolean
  hideCaption?: boolean
  photoCount?: number
  tags: string[]
  photos: MomentCard[]
  curated?: boolean
  replaces?: string[]
}

export function selectMomentSeries(groups: MomentGroup[], locale: "zh" | "en", curation: CurationVisibility): MomentGroup[] {
  const available = new Map(groups.flatMap(group => group.photos.map(photo => [photo.sourceName || photo.src.match(/DSC\d+/i)?.[0]?.toUpperCase(), photo] as const)))
  const curated = groups.filter(group => group.curated)
  const replaced = new Set(curated.flatMap(group => group.replaces || []))
  const selectedBySource = new Map<string, (typeof sessionMomentSeries)[number]["photos"][number]>(sessionMomentSeries.flatMap(series => series.photos.map(photo => [photo.sourceName,photo] as const)))
  const chosen: MomentGroup[] = curated.map(group => ({ ...group, photos: group.photos.filter(photo => curationVisible(curation,photo)).map(photo => {
    const original = selectedBySource.get(photo.sourceName || "")
    return { ...photo, alt: original?.alt[locale] || photo.alt }
  }) }))
  const baseline = sessionMomentSeries.map(series => {
    const group = groups.find(candidate => candidate.id === series.id)
    return { id: series.id, title: series.title, place: series.place, note: group?.note || "", tags: group?.tags || [],
      photoCount: series.photos.length,
      photos: series.photos.filter(photo => curationVisible(curation,photo)).map(item => {
        const {alt,...selected}=item
        const current=available.get(item.sourceName)
        return { ...current, ...selected, id: current?.id || item.id, src: current?.src || item.src,
          alt: alt[locale], title: series.title, place: series.place, note: current?.note || "", tags: current?.tags || [] }
      }),
    }
  })
  const combined = chosen.map(group => {
    const seen = new Set<string>()
    const photos = [...group.photos,...baseline.filter(previous => (group.replaces || []).includes(previous.id)).flatMap(previous=>previous.photos)].filter(photo=>{
      const key=photo.sourceName || photo.id
      if(seen.has(key))return false
      seen.add(key);return true
    })
    return {...group,photos}
  })
  return [...combined,...baseline.filter(group=>!replaced.has(group.id))].filter(group=>group.photos.length>0)
}
