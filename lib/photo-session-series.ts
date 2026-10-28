import { curationFeatured, curationAssetKey } from "./photo-curation"
import { photoSource } from "./portfolio-photo-source"
import { photoSeries, preferSeriesPlace } from "./photo-series"
import type { CurationVisibility, CurationPortrait } from "./photo-curation"

export type SessionPhoto = {
  id: string
  src: string
  alt: string
}

export type MomentCard = SessionPhoto & {
  title: string
  place: string
  note: string
  featured?: boolean
  tags: string[]
  sourceName?: string
  width?: number
  height?: number
  previewSrc?: string
  previewSrcSet?: string
}

export type MomentGroup = {
  id: string
  title: string
  place: string
  note: string
  featured?: boolean
  hideCaption?: boolean
  photoCount?: number
  tags: string[]
  photos: MomentCard[]
  curated?: boolean
  replaces?: string[]
}

export function bookingPortraitGroups(curation: CurationVisibility, bucket: string): MomentGroup[] {
  const groups = new Map<string,MomentGroup>()
  for (const photo of curation.keptPortraits) {
    if (!curationFeatured(curation,photo)) continue
    const tags = photo.tags || []
    const series = photoSeries(photo.setId || 0,"People","",tags)
    const groupId = series.portrait ? series.id : "portrait-pool"
    const group = groups.get(groupId) || { id:groupId,title:series.portrait?series.title:"Portraits",place:series.subtitle,note:"",tags:[],photos:[],curated:true }
    group.place = series.portrait ? preferSeriesPlace(group.place,series.subtitle) : ""
    group.photos.push({ id:`portrait-${photo.id}`,src:photoSource(photo.src,bucket,1280),previewSrc:photoSource(photo.src,bucket,640),
      alt:photo.title || `${group.title} portrait`,title:group.title,place:group.place,note:"",tags,
      width:photo.width || undefined,height:photo.height || undefined,
      sourceName:curationAssetKey(photo.src),featured:tags.includes("display:cover") })
    group.photoCount = group.photos.length
    groups.set(groupId,group)
  }
  return [...groups.values()]
}

export function showcasePortraits(photos: CurationPortrait[], limit: number): CurationPortrait[] {
  const groups = new Map<string,CurationPortrait[]>()
  for(const photo of photos) {
    const series=photoSeries(photo.setId || 0,"Portraits","",photo.tags || [])
    const key=series.portrait?series.id:`pool:${photo.setId || 0}`
    const list=groups.get(key) || [];list.push(photo);groups.set(key,list)
  }
  for(const list of groups.values())list.sort((a,b)=>Number((b.tags || []).includes("display:cover"))-Number((a.tags || []).includes("display:cover")) || (a.order || 0)-(b.order || 0) || a.id-b.id)
  const result:CurationPortrait[]=[]
  for(let position=0;result.length<limit;position++) {
    let found=false
    for(const list of groups.values())if(list[position]){result.push(list[position]);found=true;if(result.length===limit)break}
    if(!found)break
  }
  return result
}

export function selectMomentSeries(groups: MomentGroup[], _locale: "zh" | "en", curation: CurationVisibility): MomentGroup[] {
  return groups.filter(group=>group.curated).map(group=>({...group,photos:group.photos.filter(photo=>curationFeatured(curation,photo))})).filter(group=>group.photos.length>0)
}
