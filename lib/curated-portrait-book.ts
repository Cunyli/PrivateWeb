import { portraitBookPages } from "./portrait-book-content"
import { curationVisible, curationBoundId } from "./photo-curation"
import type { CurationVisibility } from "./photo-curation"
import { photoSource } from "./portfolio-photo-source"

export type BookPhoto = { src: string; srcSet?: string; width: number; height: number; alt: { zh: string; en: string } }


export function curatedPortraitBookPages(curation: CurationVisibility, bucket: string): BookPhoto[][] {
    if (!curation.ids.length && !curation.keptPortraits.length) return portraitBookPages.map(page => [...page]) as BookPhoto[][]
    const picks: Array<BookPhoto & { id?: number }> = curation.keptPortraits.map(photo => ({
      id: photo.id, src: photoSource(photo.src, bucket, 640), srcSet: `${photoSource(photo.src,bucket,640)} 1x, ${photoSource(photo.src,bucket,1280)} 2x`,
      width: photo.width || 640, height: photo.height || 426, alt: { zh: photo.title || "人像作品", en: "Portrait photograph" },
    }))
    const originals = portraitBookPages.flat().filter(photo => curationVisible(curation,photo))
    const seen = new Set<string>()
    const pool = [...picks,...originals].filter(photo => {
      const id = "id" in photo ? photo.id : curationBoundId(photo.src)
      const key = id !== undefined ? `id:${id}` : photo.src
      if (seen.has(key)) return false
      seen.add(key); return true
    }).slice(0,12)
    const next: BookPhoto[][] = []
    for(let index=0;index<pool.length;index+=3)next.push(pool.slice(index,index+3))
    if(next.length%2)next.push([])
    return next
}
