import { curationAssetFamily } from "./photo-curation"

type PhotoRow = { id?: number; image_url?: string | null; raw_image_url?: string | null }
// Match the exact storage family, never a DSC filename that may recur in another shoot.
export function planPictureSync<T extends PhotoRow, E extends PhotoRow & {id:number}>(incoming: T[], existing: E[]) {
  const used=new Set<number>(), requested=new Set<number>()
  const families=(photo:PhotoRow)=>[photo.image_url,photo.raw_image_url].filter((source):source is string=>Boolean(source)).map(curationAssetFamily)
  const rows=incoming.filter(photo=>typeof photo.image_url==="string"&&photo.image_url.length>0).map(photo=>{
    if(photo.id!=null&&requested.has(photo.id))throw new Error("照片编号重复，请刷新后重试。")
    if(photo.id!=null)requested.add(photo.id)
    const sources=new Set(families(photo))
    const own=photo.id!=null?existing.find(row=>row.id===photo.id):undefined
    if(photo.id!=null&&!own)throw new Error("照片编号已变化，请刷新相册后重试。")
    const matches=existing.filter(row=>!used.has(row.id)&&families(row).some(source=>sources.has(source)))
    const retained=own&&matches.includes(own)?own:photo.id!=null?undefined:matches.length===1?matches[0]:undefined
    if(photo.id==null&&matches.length>1)throw new Error("这组照片含重复素材，请刷新后台后再保存。")
    if(retained)used.add(retained.id)
    return {photo,existing:retained}
  })
  return {rows,omitted:existing.filter(photo=>!used.has(photo.id))}
}
