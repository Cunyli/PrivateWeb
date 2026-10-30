import { curationFeatured } from "./photo-curation"
import type { CurationVisibility } from "./photo-curation"
import { bookingPortraits, portraitTitle } from "./booking-photo-presentation"
import { showcasePortraits } from "./photo-session-series"

export type BookPhoto = { src: string; srcSet?: string; width: number; height: number; alt: { zh: string; en: string } }
export function curatedPortraitBookPages(curation: CurationVisibility, bucket: string): BookPhoto[][] {
  const photos=showcasePortraits(bookingPortraits(curation),12)
  const pool:BookPhoto[]=photos.map(photo=>{
    const width=photo.width || 640,height=photo.height || 426
    const scale=Math.min(1,width/height)
    return {src:`/api/photo-texture?pictureId=${photo.id}&width=640`,srcSet:`/api/photo-texture?pictureId=${photo.id}&width=640 ${Math.round(640*scale)}w, /api/photo-texture?pictureId=${photo.id}&width=1280 ${Math.round(1280*scale)}w`,
    width,height,alt:{zh:portraitTitle(photo,"zh","人像作品"),en:portraitTitle(photo,"en","Portrait photograph")}}
  })
  const pages:BookPhoto[][]=[]
  for(let index=0;index<pool.length;index+=3)pages.push(pool.slice(index,index+3))
  if(pages.length%2)pages.push([])
  return pages
}
