import { photoRenditionKey } from "./photo-rendition-key.mjs"
import renditionData from "@/data/photo-display-renditions.json"
import { photoSource } from "./portfolio-photo-source"

type Rendition={width:number;height:number;key:string}
const renditions=renditionData as Record<string,Rendition>
type Photo={id?:string|number|null;url:string;displayUrl?:string|null}
export function viewerPhotoDimensions(photo:Photo): Rendition|undefined {
  const known=renditions[String(photo.id || "").replace(/^portrait-/,"")]
  return known?.key===photoRenditionKey(photo.url)?known:undefined
}
export function viewerPhotoSource(photo:Photo,bucket:string,viewport:{width:number;height:number;density?:number}) {
  const dimensions=viewerPhotoDimensions(photo)
  const ratio=dimensions?dimensions.width/dimensions.height:1.5
  const width=Math.min(viewport.width*.97,viewport.height*.98*ratio)
  const edge=(dimensions?Math.max(width,width/ratio):Math.max(viewport.width*.97,viewport.height*.98))*Math.min(viewport.density||1,2)
  const small=photoSource(photo.url,bucket,1280)
  if(edge<=1280 || (dimensions && Math.max(dimensions.width,dimensions.height)<=1280) || (!dimensions && !photo.displayUrl))return small
  return photo.displayUrl?new URL(photo.displayUrl,bucket).href:small.replace(/\/w(?:640|1280)\.webp(?=[?#]|$)/,"/w2560.webp")
}
