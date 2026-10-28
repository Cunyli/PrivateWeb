import { curationFeatured } from "./photo-curation"
import type { CurationVisibility } from "./photo-curation"
import { showcasePortraits } from "./photo-session-series"

export type BookPhoto = { src: string; srcSet?: string; width: number; height: number; alt: { zh: string; en: string } }
export function curatedPortraitBookPages(curation: CurationVisibility, bucket: string): BookPhoto[][] {
  const photos=showcasePortraits(curation.keptPortraits.filter(photo=>curationFeatured(curation,photo)),12)
  const pool:BookPhoto[]=photos.map(photo=>({src:`/api/photo-texture?pictureId=${photo.id}&width=640`,srcSet:`/api/photo-texture?pictureId=${photo.id}&width=640 1x, /api/photo-texture?pictureId=${photo.id}&width=1280 2x`,
    width:photo.width || 640,height:photo.height || 426,alt:{zh:photo.title || "人像作品",en:photo.title || "Portrait photograph"}}))
  const pages:BookPhoto[][]=[]
  for(let index=0;index<pool.length;index+=3)pages.push(pool.slice(index,index+3))
  if(pages.length%2)pages.push([])
  return pages
}
