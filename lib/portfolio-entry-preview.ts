import { curationAssetFamily, curationFeatured } from "./photo-curation"
import type { CurationCover, CurationVisibility } from "./photo-curation"

// Navigation uses current approved covers, never a second static photo pool.
export function portfolioEntryPhotos(curation:CurationVisibility,limit=3):Array<CurationCover & {setId:number}> {
  const portraitIds=new Set(curation.keptPortraits.map(photo=>photo.id))
  const preferred=[110,98,95,101,108]
  const rank=(id:number)=>preferred.includes(id)?preferred.indexOf(id):preferred.length
  const seen=new Set<string>()
  return Object.entries(curation.covers)
    .map(([setId,photo])=>({...photo,setId:Number(setId)}))
    .filter(photo=>photo.id>0 && curationFeatured(curation,photo) && !portraitIds.has(photo.id) && !(photo.width && photo.height && photo.width<photo.height))
    .sort((a,b)=>rank(a.setId)-rank(b.setId) || b.setId-a.setId)
    .filter(photo=>{const family=curationAssetFamily(photo.src);if(seen.has(family))return false;seen.add(family);return true})
    .slice(0,limit)
}
