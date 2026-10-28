import { PHOTOGRAPHY_STYLES } from "./photography-styles"
import type { CurationCatalog } from "./photo-curation-catalog"
import type { InitialPortfolioPayload } from "./portfolioInitialData"

export type PictureTranslation = {
  title?: string | null
  subtitle?: string | null
  description?: string | null
}

export type StylePicture = {
  id: number
  width?: number | null
  height?: number | null
  pictureSetId: number
  imageUrl: string
  rawImageUrl: string | null
  orderIndex: number | null
  createdAt: string
  tags: string[]
  categories: string[]
  set: {
    id: number
    title: string
    subtitle: string
    coverImageUrl: string | null
    translations: {
      en: PictureTranslation
      zh: PictureTranslation
    }
  }
  translations: {
    en: PictureTranslation
    zh: PictureTranslation
  }
}

export type StyleApiResponse = {
  id: string
  tagName: string
  pictures: StylePicture[]
}

export function initialStylePreviews(catalog: CurationCatalog, initial: InitialPortfolioPayload, categories:Record<number,string[]>={}): Record<string,StyleApiResponse> {
  const used=new Set<number>()
  const hidden=new Set(catalog.ids)
  const photos=catalog.photos.filter(p=>p.setPublished && !hidden.has(p.id) && [...p.tags,...(categories[p.id]||[])].some(t=>/master|大师/i.test(t)))
    .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt) || b.order-a.order)
  const result: Record<string,StyleApiResponse>={}
  for(const style of PHOTOGRAPHY_STYLES){
    const aliases=[style.tagName,style.labels.en,style.labels.zh].map(t=>t.toLowerCase())
    const candidates=photos.filter(p=>style.id==="travel" || [...p.tags,...(categories[p.id]||[])].some(t=>aliases.includes(t.toLowerCase())))
    const landscape=candidates.filter(p=>p.width && p.height && p.width>=p.height)
    const eligible=landscape.length?landscape:candidates
    const photo=eligible.find(p=>!used.has(p.id)) || eligible[0]
    if(!photo)continue
    const set=initial.pictureSets.find(s=>s.id===photo.setId)
    if(!set)continue
    used.add(photo.id)
    result[style.id]={id:style.id,tagName:style.tagName,pictures:[{
      id:photo.id,width:photo.width,height:photo.height,pictureSetId:photo.setId,imageUrl:photo.src,rawImageUrl:null,
      orderIndex:photo.order,createdAt:photo.createdAt,tags:photo.tags,categories:categories[photo.id] || [],translations:{en:photo.translations.en || {},zh:photo.translations.zh || {}},
      set:{id:set.id,title:set.title,subtitle:set.subtitle,coverImageUrl:set.cover_image_url,translations:{
        en:initial.transMap[set.id]?.en || {},zh:initial.transMap[set.id]?.zh || {}}}
    }]}
  }
  return result
}
