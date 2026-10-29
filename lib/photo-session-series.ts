import { curationFeatured, curationAssetKey } from "./photo-curation"
import { bookingPortraits, sessionPhotoSources, portraitTitle } from "./booking-photo-presentation"
import { localizePlaceText } from "./portfolio-location-label"
import { photoSeries, preferSeriesPlace } from "./photo-series"
import type { CurationVisibility, CurationPortrait } from "./photo-curation"

export type SessionPhoto = {
  id: string
  src: string
  alt: string
  width?: number
  height?: number
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
  kind?: "highlights"
  hideCaption?: boolean
  photoCount?: number
  tags: string[]
  photos: MomentCard[]
  curated?: boolean
  replaces?: string[]
}

const bookingGroupLabels:Record<string,{title:string;place:string}>={
  "hongjia-helsinki":{title:"Hongjia",place:"Helsinki"},
  "jianji-xinyi":{title:"Jianji & Xinyi",place:"Croatia · Barcelona"},
  lijiang:{title:"Lijiang",place:""},
  appenzell:{title:"David",place:"Switzerland"},
}

export function bookingPortraitGroups(curation: CurationVisibility, bucket: string, photos=bookingPortraits(curation),locale:"zh"|"en"="en"): MomentGroup[] {
  const groups = new Map<string,MomentGroup>()
  for (const photo of photos) {
    if (!curationFeatured(curation,photo)) continue
    const tags = photo.tags || []
    const series = photoSeries(photo.setId || 0,"People","",tags)
    const placeTag=tags.find(t=>/^location:/i.test(t))?.slice(9) || ""
    const placeLabels:Record<string,string>={switzerland:"Switzerland",helsinki:"Helsinki",florence:"Florence",aalto:"Aalto"}
    const place=placeLabels[placeTag.toLowerCase()] || placeTag
    const shoot=tags.find(t=>/^series:/i.test(t)) || `set:${photo.setId}`
    const displayKey=tags.find(tag=>tag.startsWith("display:booking-group:"))?.slice("display:booking-group:".length)
    const display=displayKey?bookingGroupLabels[displayKey]:undefined
    const groupId = display ? `booking:${displayKey}` : series.portrait ? series.id : `session:${shoot}:${place.toLowerCase()}`
    const group = groups.get(groupId) || { id:groupId,title:display?.title || (series.portrait?series.title:place || "Portraits"),place:display?.place || series.subtitle,note:"",tags:[],photos:[],curated:true }
    group.place = display ? display.place : series.portrait ? preferSeriesPlace(group.place,series.subtitle) : ""
    const displaySource=sessionPhotoSources({id:photo.id,src:photo.src},bucket)
    group.photos.push({ id:`portrait-${photo.id}`,src:photo.src.startsWith("http")?photo.src:new URL(photo.src,bucket).href,previewSrc:displaySource.src,previewSrcSet:displaySource.srcSet,
      alt:portraitTitle(photo,locale,[series.portrait?series.title:group.title,localizePlaceText(series.subtitle || place,locale)].filter(Boolean).join(" · ")),title:series.portrait?series.title:group.title,place:series.subtitle || place,note:"",tags,
      width:displaySource.width || photo.width || undefined,height:displaySource.height || photo.height || undefined,
      sourceName:curationAssetKey(photo.src),featured:tags.includes("display:cover") })
    group.tags=[...new Set([...group.tags,...tags])]
    group.photoCount = group.photos.length
    groups.set(groupId,group)
  }
  const shoots=[...groups.values()]
  const order:Record<string,number>={Xiya:0,Hongjia:1,"Jianji & Xinyi":2,Lijiang:3,Rico:4,David:5}
  const series=shoots.filter(group=>group.photos.length>=2).sort((a,b)=>(order[a.title]??99)-(order[b.title]??99))
  const singles=shoots.filter(group=>group.photos.length===1).flatMap(group=>group.photos)
  // One frame cannot tell a whole shoot's story. Share single frames in one
  // selection, preserving each photo's own person and place for the viewer.
  if(singles.length>=2)series.push({id:"portrait-highlights",kind:"highlights",title:"Portraits",place:"",note:"",curated:true,
    photoCount:singles.length,tags:[...new Set(singles.flatMap(photo=>photo.tags))],photos:singles})
  return series.map(group=>({...group,title:localizePlaceText(group.title,locale),place:localizePlaceText(group.place,locale)}))
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
