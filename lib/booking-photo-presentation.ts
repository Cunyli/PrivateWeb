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
    return curationFeatured(curation,photo) && !personal && session && !tags.some(tag=>/^display:booking-intro-[123]$/.test(tag) || tag==="display:booking-process") && !tags.includes("display:exclude-booking")
  })
}

export function bookingPlacement(curation:CurationVisibility){
  const photos=bookingPortraits(curation)
  const hero=photos.find(p=>p.tags?.includes("display:booking-hero")) || photos.find(p=>p.tags?.some(t=>/^model:/i.test(t)))
  const intro=[1,2,3].flatMap(index=>{
    const photo=curation.keptPortraits.find(p=>p.tags?.includes(`display:booking-intro-${index}`) && curationFeatured(curation,p))
    return photo?[photo]:[]
  })
  const processOrder=(photo:CurationPortrait)=>Number(photo.tags?.find(tag=>/^display:booking-process-\d+$/.test(tag))?.slice("display:booking-process-".length) || 9999)
  const processPhotos=curation.keptPortraits.filter(p=>p.tags?.includes("display:booking-process") && curationFeatured(curation,p) && p.id!==hero?.id && !intro.some(photo=>photo.id===p.id))
    .sort((a,b)=>processOrder(a)-processOrder(b) || a.id-b.id)
  const gallery=photos.filter(p=>p.id!==hero?.id && !processPhotos.some(photo=>photo.id===p.id) && !p.tags?.includes("display:exclude-booking-gallery"))
  return {photos,hero,process:processPhotos[0],processPhotos,intro,gallery}
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
