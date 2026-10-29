import { curationFeatured } from "./photo-curation"
import type { CurationPortrait, CurationVisibility } from "./photo-curation"
import { photoSource } from "./portfolio-photo-source"
import { viewerPhotoDimensions, viewerPhotoSource } from "./viewer-photo-source"

export function bookingPortraits(curation:CurationVisibility): CurationPortrait[] {
  return curation.keptPortraits.filter(photo=>{
    const tags=photo.tags || []
    const personal=tags.some(tag=>/^model:\s*lijie(?:\s+li)?$/i.test(tag))
    // The old generic master-photo pool is not a client shoot. Session/model
    // metadata gives the booking page a real story instead of a mixed grab bag.
    const session=tags.some(tag=>/^series:|^model:/i.test(tag))
    return curationFeatured(curation,photo) && !personal && session && !tags.includes("display:exclude-booking")
  })
}

export function bookingPlacement(curation:CurationVisibility){
  const photos=bookingPortraits(curation)
  const hero=photos.find(p=>p.tags?.includes("display:booking-hero")) || photos.find(p=>p.tags?.some(t=>/^model:/i.test(t)))
  const process=photos.find(p=>p.id!==hero?.id && p.tags?.includes("display:booking-process"))
  const gallery=photos.filter(p=>p.id!==hero?.id && p.id!==process?.id)
  return {photos,hero,process,gallery}
}

export function sessionPhotoSources(photo:{id?:string|number;src:string},bucket:string){
  const id=String(photo.id || "").replace(/^portrait-/,"")
  const image={id,url:photo.src}
  const dimensions=viewerPhotoDimensions(image)
  const src=photoSource(photo.src,bucket,1280)
  if(!dimensions)return {src,srcSet:undefined,width:undefined,height:undefined}
  const max=Math.max(dimensions.width,dimensions.height)
  const variants=new Map<number,string>()
  for(const edge of [640,1280])variants.set(Math.round(dimensions.width*Math.min(1,edge/max)),photoSource(photo.src,bucket,edge))
  const large=viewerPhotoSource(image,bucket,{width:2560,height:2560,density:2})
  variants.set(dimensions.width,large)
  return {src,srcSet:[...variants].sort(([a],[b])=>a-b).map(([width,url])=>`${url} ${width}w`).join(", "),width:dimensions.width,height:dimensions.height}
}
