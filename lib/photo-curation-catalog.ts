import { curationAssetFamily } from "./photo-curation"
import type { CurationPortrait, CurationAsset, CurationCover, CurationVisibility } from "./photo-curation"
import type { PictureSet } from "./pictureSet.types"

export type FeaturedPicture = CurationPortrait & {
  setId: number
  subtitle: string | null
  description: string | null
  createdAt: string
  order: number
  tags: string[]
  booking: boolean
  setPublished: boolean
  setCoverSrc: string | null
  translations: Record<string, { title?: string; subtitle?: string; description?: string }>
}
export type CurationCatalog = { ids: number[]; photos: FeaturedPicture[]; assets: CurationAsset[] }

export function catalogVisibility(catalog: CurationCatalog): CurationVisibility {
  const hidden = new Set(catalog.ids)
  const photos = catalog.photos.filter(photo => !hidden.has(photo.id))
  const assets = catalog.assets.filter(photo => !hidden.has(photo.id))
  const covers: Record<number, CurationCover> = {}
  const rank = (photo: FeaturedPicture) => curationAssetFamily(photo.src) === curationAssetFamily(photo.setCoverSrc || "") ? 0 : photo.tags.includes("display:cover") ? 1 : 2
  for (const photo of [...photos].sort((a,b) => rank(a)-rank(b) || a.order-b.order || a.id-b.id)) {
    if (photo.setPublished && !covers[photo.setId]) covers[photo.setId] = { id: photo.id, src: photo.src, width: photo.width, height: photo.height }
  }
  const portrait = photos.filter(photo => photo.booking).map(({id,src,title,width,height,setId,tags,order}) => ({id,src,title,width,height,setId,tags,order}))
  const selected = photos.find(photo => photo.setPublished) || portrait[0] || assets[0]
  return { ids: catalog.ids, featuredIds: [...photos,...assets].map(photo=>photo.id), covers, keptPortraits: portrait, featuredAssets: assets,
    selectedCover: selected ? {id:selected.id,src:selected.src,width:selected.width,height:selected.height} : null }
}

export function withFeaturedCovers<T extends { id: number; cover_image_url?: string | null; cover_image_variants?: unknown }>(sets: T[], curation: CurationVisibility): T[] {
  return sets.map(set => ({...set,cover_image_url:curation.covers[set.id]?.src || "",cover_image_variants:{},
    cover_image_width:curation.covers[set.id]?.width || undefined,cover_image_height:curation.covers[set.id]?.height || undefined}))
}

// Zero is a UI-only collection key, never a database ID.
export function selectedCollection(curation: CurationVisibility): PictureSet | null {
  if (!curation.selectedCover) return null
  return { id:0,title:"Selected",subtitle:"",description:"",cover_image_url:curation.selectedCover.src,created_at:"",updated_at:"",pictures:[],position:"up",is_published:true }
}
