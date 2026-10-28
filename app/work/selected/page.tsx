import { Suspense } from "react"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import PortfolioDetail from "@/components/portfolio-detail"
import { ViewerPhotoPreload } from "@/components/viewer-photo-preload"
import { getPhotoCurationCatalog } from "@/lib/photo-curation.server"

export const revalidate=0
export const metadata={title:"Selected · Lijie Li"}
export default async function SelectedWorkPage({searchParams}:{searchParams:Promise<{origin?:string}>}) {
  const [catalog,params,requestHeaders]=await Promise.all([getPhotoCurationCatalog(),searchParams,headers()])
  const host=requestHeaders.get("host") || "localhost:3000"
  const base=`${host.startsWith("localhost")||host.startsWith("127.0.0.1")?"http":"https"}://${host}`
  const hidden=new Set(catalog.ids)
  const photos=catalog.photos.filter(photo=>!hidden.has(photo.id))
  const assets=catalog.assets.filter(photo=>!hidden.has(photo.id))
  const images=[...photos.map(photo=>({id:photo.id,setId:photo.setPublished?photo.setId:undefined,url:photo.src,translations:{
    en:{title:photo.translations.en?.title || photo.title || "",subtitle:photo.translations.en?.subtitle || photo.subtitle || "",description:photo.translations.en?.description || photo.description || ""},
    zh:{title:photo.translations.zh?.title || photo.title || "",subtitle:photo.translations.zh?.subtitle || photo.subtitle || "",description:photo.translations.zh?.description || photo.description || ""}}})),
    ...assets.map(photo=>({id:photo.id,url:new URL(photo.src,base).href,translations:{en:{title:photo.title},zh:{title:photo.title}}}))]
  if(!images.length)notFound()
  return <><ViewerPhotoPreload image={images[0]}/><Suspense fallback={<div className="min-h-screen"/>}><PortfolioDetail id="selected" images={images}
    translations={{en:{title:"Selected",subtitle:"",description:""},zh:{title:"精选",subtitle:"",description:""}}}
    returnContext={{type:"portfolio",homePath:params.origin==="home"?"/":"/portfolio",returnSetId:0}}/></Suspense></>
}
