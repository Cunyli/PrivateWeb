import { photoSource } from "@/lib/portfolio-photo-source"
import { viewerPhotoDimensions, viewerPhotoSource } from "@/lib/viewer-photo-source"

export function ViewerPhotoPreload({image}:{image:{id?:string|number|null;url:string;displayUrl?:string|null}}){
  const bucket=process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top"
  const small=photoSource(image.url,bucket,1280)
  const info=viewerPhotoDimensions(image)
  if(!info)return <link rel="preload" as="image" href={small}/>
  const large=viewerPhotoSource(image,bucket,{width:2560,height:2560,density:2})
  if(small===large)return <link rel="preload" as="image" href={small}/>
  const ratio=info.width/info.height
  const smallWidth=Math.round(info.width*Math.min(1,1280/Math.max(info.width,info.height)))
  const horizontal="calc(97vw - clamp(34.92px,7.372vw,124.16px))"
  const fitted=(chrome:number)=>`min(${horizontal},calc(${98*ratio}dvh - ${chrome*.98*ratio}px))`
  const sizes=`(max-height: 520px) ${fitted(112)}, (max-width: 767px) ${fitted(156)}, ${fitted(152)}`
  return <link rel="preload" as="image" href={large} imageSrcSet={`${small} ${smallWidth}w, ${large} ${info.width}w`} imageSizes={sizes}/>
}
