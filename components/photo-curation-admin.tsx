"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { ArrowLeft, ArrowRight, RotateCcw, Search, X } from "lucide-react"
import { adminFetch } from "@/utils/admin-auth-client"
import type { CurationChange, CurationGroup, CurationPhoto, CurationState } from "@/lib/photo-curation"
import styles from "./photo-curation-admin.module.css"

type Library = { items: CurationPhoto[]; groups: CurationGroup[]; draftKey: string }
type Rating = 0 | 1 | null
type View = "all" | CurationState
const PAGE_SIZE = 60
const savedRating = (photo: CurationPhoto): Rating => photo.state === "trash" ? 0 : photo.state === "keep" ? 1 : null

export function PhotoCurationAdmin() {
  const router = useRouter()
  const imageSizes = useRef<Record<number, { width: number; height: number }>>({})
  const [library, setLibrary] = useState<Library | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState("")
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [draft, setDraft] = useState<Record<number, Rating>>({})
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [groupId, setGroupId] = useState("")
  const [view, setView] = useState<View>("all")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [plan, setPlan] = useState<CurationChange[] | null>(null)
  const [lastDeleted, setLastDeleted] = useState<number[]>([])

  const fetchLibrary = useCallback(async () => {
    const response = await adminFetch("/api/admin/photo-curation", { cache: "no-store" })
    if (response.status === 401) { router.replace("/login?next=/admin/curation"); throw new Error("请重新登录。") }
    const payload = await response.json()
    if (!response.ok) throw new Error(response.status === 403 ? "这个账号没有选片权限，请使用管理员账号登录。" : payload.error || "照片没有载入，请重试。")
    return payload as Library
  }, [router])

  useEffect(() => {
    let active = true
    fetchLibrary().then(next => {
      if (!active) return
      let saved: Record<number, Rating> = {}
      try { saved = JSON.parse(localStorage.getItem(next.draftKey) || "{}") } catch { /* A broken local draft must not block the library. */ }
      const ids = new Set(next.items.map(item => item.id))
      const valid = Object.fromEntries(Object.entries(saved).filter(([id, value]) => ids.has(Number(id)) && [0,1,null].includes(value)))
      setDraft(valid); setLibrary(next); setGroupId(next.groups[0]?.id || "all"); setInitialLoading(false)
    }).catch(error => {
      if (!active) return
      if (error instanceof Error && error.message === "Missing admin session") router.replace("/login?next=/admin/curation")
      else { setFatal(error instanceof Error ? error.message : "照片没有载入。"); setInitialLoading(false) }
    })
    return () => { active = false }
  }, [fetchLibrary, router])

  useEffect(() => {
    if (!library) return
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(library.draftKey, JSON.stringify(draft)) }
      catch { setNotice({ text: "浏览器没有保存本机草稿，请在离开前点击保存标记。", error: true }) }
    }, 250)
    return () => clearTimeout(timer)
  }, [draft, library?.draftKey])

  const rating = useCallback((photo: CurationPhoto): Rating => Object.hasOwn(draft,photo.id) ? draft[photo.id] : savedRating(photo), [draft])
  const matchesView = useCallback((photo: CurationPhoto) => view === "all"
    ? photo.state !== "trash" || (Object.hasOwn(draft,photo.id) && draft[photo.id] !== 0)
    : view === "trash" ? rating(photo) === 0 : view === "keep" ? rating(photo) === 1 : rating(photo) === null, [view,draft,rating])
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const photo of library?.items || []) if (matchesView(photo)) counts.set(photo.groupId, (counts.get(photo.groupId) || 0) + 1)
    return counts
  }, [library, matchesView])
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return (library?.items || []).filter(photo => matchesView(photo) && (groupId === "all" || photo.groupId === groupId) && (!needle || `${photo.filename} ${photo.title} ${photo.groupTitle} ${photo.groupSubtitle}`.toLocaleLowerCase().includes(needle)))
  }, [library,groupId,matchesView,query])
  const pageCount = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))
  const currentPage = Math.min(page,pageCount-1)
  const shown = filtered.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE)
  const selected = shown.filter(photo => picked.has(photo.id))
  const activeGroup = library?.groups.find(group => group.id === groupId)
  const previewIndex = shown.findIndex(photo => photo.id === previewId)
  const preview = shown[previewIndex]

  const changeFor = (photo: CurationPhoto, next: Rating): CurationChange => ({
    pictureId:photo.id,decision:next===0?"trash":next===1?"keep":"restore",
    expectedUpdatedAt:photo.updatedAt,expectedReviewedAt:photo.reviewedAt,
    ...(imageSizes.current[photo.id] || (photo.width && photo.height ? {width:photo.width,height:photo.height} : {})),
  })
  const pendingPhotos = (library?.items || []).filter(photo => Object.hasOwn(draft,photo.id) && rating(photo)!==savedRating(photo))
  const pendingZero = pendingPhotos.filter(photo => rating(photo)===0).length
  const pendingOne = pendingPhotos.filter(photo => rating(photo)===1).length
  const pendingClear = pendingPhotos.filter(photo => rating(photo)===null).length
  const planPhotos = useMemo(() => {
    const deleting = new Set(plan?.filter(change=>change.decision==="trash").map(change=>change.pictureId))
    return (library?.items || []).filter(photo=>deleting.has(photo.id))
  }, [plan,library])

  const mark = (photos: CurationPhoto[], next: Rating) => {
    if(busy)return
    setDraft(previous=>({...previous,...Object.fromEntries(photos.map(photo=>[photo.id,next]))}))
  }
  const changeGroup = (id: string) => { if(!busy){setGroupId(id);setPage(0);setPicked(new Set());setPreviewId(null)} }
  const changeView = (next: View) => { if(!busy){setView(next);setPage(0);setPicked(new Set());if(next==="trash")setGroupId("all")} }
  const movePreview = useCallback((direction: number) => {
    if(shown.length)setPreviewId(shown[(previewIndex+direction+shown.length)%shown.length].id)
  }, [shown,previewIndex])
  const markAndNext = (next: Rating) => {
    if(!preview)return
    mark([preview],next)
    if(previewIndex<shown.length-1)setPreviewId(shown[previewIndex+1].id)
  }
  useEffect(() => {
    if(!preview)return
    const images=[shown[(previewIndex+1)%shown.length],shown[(previewIndex-1+shown.length)%shown.length]].map(photo=>{
      const image=new Image();image.decoding="async";image.src=photo.detailUrl;return image
    })
    return ()=>{images.forEach(image=>{image.src=""})}
  }, [preview?.id])

  const refresh = async () => {
    if(busy)return
    setBusy(true)
    try{setLibrary(await fetchLibrary());setNotice({text:"照片状态已刷新，本机标记保留。"})}
    catch(error){setNotice({text:error instanceof Error?error.message:"刷新失败。",error:true})}
    finally{setBusy(false)}
  }
  const save = async (changes: CurationChange[]) => {
    if(busy||!changes.length)return
    setBusy(true);setNotice(null)
    try{
      const response=await adminFetch("/api/admin/photo-curation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({changes})})
      const payload=await response.json()
      if(!response.ok)throw new Error(payload.error||"保存失败，请重试。")
      setPlan(null);setPreviewId(null)
      const changedIds=new Set(changes.map(change=>change.pictureId))
      const deleted=changes.filter(change=>change.decision==="trash").map(change=>change.pictureId)
      const excellent=changes.filter(change=>change.decision==="keep").length
      const cleared=changes.filter(change=>change.decision==="restore").length
      setLastDeleted(deleted)
      setLibrary(await fetchLibrary())
      setDraft(previous=>Object.fromEntries(Object.entries(previous).filter(([id])=>!changedIds.has(Number(id)))))
      setPicked(new Set())
      setNotice({text:[deleted.length?`0 · ${deleted.length} 张已移入回收站`:"",excellent?`1 · ${excellent} 张标为很好`:"",cleared?`${cleared} 张恢复为不标记、保留`:""].filter(Boolean).join("；")+"。未标记照片保持不变。"})
    }catch(error){setPlan(null);setNotice({text:error instanceof Error?error.message:"保存没有完成，请刷新核对状态。",error:true})}
    finally{setBusy(false)}
  }
  const saveDraft = () => {
    const changes=pendingPhotos.map(photo=>changeFor(photo,rating(photo)))
    if(changes.some(change=>change.decision==="trash"))setPlan(changes)
    else void save(changes)
  }

  if(initialLoading)return <main className={`${styles.page} ${styles.loading}`} aria-busy="true"><p>正在载入你的照片库…</p></main>
  if(fatal||!library)return <main className={`${styles.page} ${styles.loading}`}><p role="alert">{fatal||"照片没有载入。"}</p><Link href="/login?next=/admin/curation">登录管理员账号</Link><Link href="/admin">返回后台</Link></main>

  return <main className={styles.page} data-photo-curation aria-busy={busy}>
    <header className={styles.header}><div className={styles.brand}><h1>选片</h1><span>{library.items.length} 张 · {library.groups.length} 个系列</span></div><nav><button type="button" onClick={()=>void refresh()} disabled={busy} className={styles.button}><RotateCcw size={13}/>刷新</button><Link href="/admin">后台</Link><a href="/portfolio" target="_blank" rel="noreferrer">查看网站 ↗</a></nav></header>
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="照片系列"><p>不标记保留 · 0 删除 · 1 很好</p><button type="button" className={styles.group} data-active={groupId==="all"} onClick={()=>changeGroup("all")}><strong>全部照片</strong><span>{library.items.filter(matchesView).length}</span></button>{library.groups.map(group=><button type="button" key={group.id} className={styles.group} data-active={groupId===group.id} aria-pressed={groupId===group.id} onClick={()=>changeGroup(group.id)} disabled={busy}><strong>{group.title}</strong><small>{group.subtitle}</small><span>{groupCounts.get(group.id)||0}</span></button>)}</aside>
      <section className={styles.content} aria-label="系列照片">
        <label className={styles.mobileSeries}><span>系列</span><select aria-label="选择照片系列" value={groupId} disabled={busy} onChange={event=>changeGroup(event.target.value)}><option value="all">全部照片</option>{library.groups.map(group=><option key={group.id} value={group.id}>{group.title}{group.subtitle?` · ${group.subtitle}`:""} ({groupCounts.get(group.id)||0})</option>)}</select></label>
        <div className={styles.titlebar}><div><h2>{groupId==="all"?"全部照片":activeGroup?.title}</h2><p>{groupId==="all"?"逐个系列，慢慢挑。":activeGroup?.subtitle}</p></div><span>不标记的照片保留原样</span></div>
        {notice&&<div role={notice.error?"alert":"status"} className={styles.notice} data-error={!!notice.error}>{notice.text}{!notice.error&&lastDeleted.length>0&&<button type="button" disabled={busy} onClick={()=>void save(library.items.filter(photo=>lastDeleted.includes(photo.id)&&photo.state==="trash").map(photo=>changeFor(photo,null)))} className={styles.button}>恢复刚才删除的照片</button>}</div>}
        <div className={styles.filters} role="group" aria-label="照片状态">{([['all','全部'],['unreviewed','未标记'],['keep','1 · 很好'],['trash','0 · 删除 / 回收站']] as const).map(([value,text])=><button type="button" key={value} data-active={view===value} aria-pressed={view===value} onClick={()=>changeView(value)} disabled={busy}>{text}</button>)}<label><Search size={14}/><span className="sr-only">查找照片</span><input type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(0)}} placeholder="名字、地点或文件名"/></label></div>
        <div className={styles.utility}><span>{filtered.length?`${currentPage*PAGE_SIZE+1}–${Math.min((currentPage+1)*PAGE_SIZE,filtered.length)} / ${filtered.length} 张`:"0 张"}</span><div><button type="button" disabled={busy||!shown.length} onClick={()=>setPicked(new Set(shown.map(photo=>photo.id)))}>全选本页</button><button type="button" disabled={busy||!picked.size} onClick={()=>setPicked(new Set())}>清空选择</button></div></div>
        {shown.length?<div className={styles.grid}>{shown.map(photo=><article key={photo.id} className={styles.card} data-photo-id={photo.id} data-selected={picked.has(photo.id)} data-rating={rating(photo)??"none"} data-pending={Object.hasOwn(draft,photo.id)&&rating(photo)!==savedRating(photo)}>
          <button type="button" className={styles.image} onClick={()=>setPreviewId(photo.id)} aria-label={`放大 ${photo.filename}`}><img src={photo.previewUrl} alt={photo.title||photo.filename} width={photo.width} height={photo.height} loading="lazy" decoding="async" onLoad={({currentTarget})=>{imageSizes.current[photo.id]={width:currentTarget.naturalWidth,height:currentTarget.naturalHeight}}}/></button>
          <label className={styles.check}><input type="checkbox" checked={picked.has(photo.id)} disabled={busy} onChange={()=>setPicked(previous=>{const next=new Set(previous);if(next.has(photo.id))next.delete(photo.id);else next.add(photo.id);return next})} aria-label={`选择 ${photo.filename}，编号 ${photo.id}`}/></label>
          <div className={styles.caption}><span>{photo.filename}</span><div className={styles.rating} role="group" aria-label={`${photo.filename} 的标记`}><button type="button" data-value="0" data-active={rating(photo)===0} aria-pressed={rating(photo)===0} aria-label={`0 删除 ${photo.filename}，编号 ${photo.id}`} title="0：删除" disabled={busy} onClick={()=>mark([photo],rating(photo)===0?null:0)}>0</button><button type="button" data-value="1" data-active={rating(photo)===1} aria-pressed={rating(photo)===1} aria-label={`1 很好 ${photo.filename}，编号 ${photo.id}`} title="1：很好" disabled={busy} onClick={()=>mark([photo],rating(photo)===1?null:1)}>1</button>{rating(photo)!==null&&<button type="button" onClick={()=>mark([photo],null)} aria-label={`清除 ${photo.filename} 的标记`} title="不标记：保留"><X size={11}/></button>}</div></div>
        </article>)}</div>:<div className={styles.empty}>这一组没有符合条件的照片。可以切换状态，或继续下一个系列。</div>}
        <div className={styles.utility} style={{marginTop:24}}><button type="button" className={styles.button} onClick={()=>{setPage(Math.max(0,currentPage-1));window.scrollTo({top:0})}} disabled={busy||currentPage===0}>上一页</button><span>{currentPage+1} / {pageCount}</span><button type="button" className={styles.button} onClick={()=>{setPage(Math.min(pageCount-1,currentPage+1));window.scrollTo({top:0})}} disabled={busy||currentPage===pageCount-1}>下一页</button></div>
      </section>
    </div>
    <footer className={styles.footer}><div><strong>待保存 {pendingPhotos.length} 项：0 · 删除 {pendingZero} 张，1 · 很好 {pendingOne} 张{pendingClear>0?`，不标记 / 恢复 ${pendingClear} 张`:""}</strong><p>标记自动存到本机。点击保存才更新网站；不标记的照片保持不变，删除可恢复。</p></div><div className={styles.actions}>
      {selected.length>0&&<><span className={styles.selectedCount}>已选 {selected.length} 张</span><button type="button" className={`${styles.button} ${styles.delete}`} disabled={busy||!selected.length} onClick={()=>mark(selected,0)}>0 删除</button><button type="button" className={styles.button} disabled={busy||!selected.length} onClick={()=>mark(selected,1)}>1 很好</button><button type="button" className={styles.button} disabled={busy||!selected.length} onClick={()=>mark(selected,null)}>不标记</button></>}<button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy||!pendingPhotos.length||pendingPhotos.length>2000} onClick={saveDraft}>{busy?"正在保存…":`保存标记 ${pendingPhotos.length}`}<ArrowRight size={14}/></button>
    </div></footer>
    <Dialog.Root open={!!preview} onOpenChange={open=>{if(!open)setPreviewId(null)}}><Dialog.Portal><Dialog.Overlay className={styles.overlay}/><Dialog.Content className={`${styles.dialog} ${styles.preview}`} aria-describedby={undefined} onKeyDown={event=>{
      if(event.key==="ArrowLeft"){event.preventDefault();movePreview(-1)}
      if(event.key==="ArrowRight"){event.preventDefault();movePreview(1)}
      if(event.key==="0"||event.key==="1"){event.preventDefault();markAndNext(Number(event.key) as 0|1)}
      if(event.key==="Backspace"&&preview){event.preventDefault();mark([preview],null)}
    }}><Dialog.Title className="sr-only">{preview?.filename}，照片预览</Dialog.Title><Dialog.Close className={styles.close} aria-label="关闭预览"><X size={18}/></Dialog.Close>{preview&&<><figure><img src={preview.detailUrl} alt={preview.title||preview.filename} decoding="async"/></figure><footer><div><button type="button" onClick={()=>movePreview(-1)} aria-label="上一张"><ArrowLeft size={17}/></button><button type="button" onClick={()=>movePreview(1)} aria-label="下一张"><ArrowRight size={17}/></button><span>{previewIndex+1} / {shown.length} · {preview.filename}</span></div><div className={styles.previewRatings}><span>0 / 1 标记并下一张</span><button type="button" className={styles.selectedButton} data-selected={rating(preview)===0} onClick={()=>markAndNext(0)}>0 删除</button><button type="button" className={styles.selectedButton} data-selected={rating(preview)===1} onClick={()=>markAndNext(1)}>1 很好</button><button type="button" className={styles.selectedButton} onClick={()=>mark([preview],null)}>不标记</button></div></footer></>}</Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={!!plan} onOpenChange={open=>{if(!open&&!busy)setPlan(null)}}><Dialog.Portal><Dialog.Overlay className={styles.overlay}/><Dialog.Content className={`${styles.dialog} ${styles.confirm}`} onEscapeKeyDown={event=>{if(busy)event.preventDefault()}} onInteractOutside={event=>{if(busy)event.preventDefault()}}><Dialog.Title>保存标记，删除这 {planPhotos.length} 张？</Dialog.Title><Dialog.Description>标记为 0 的这些照片将移入回收站，公开页面停止展示；标记为 1 的照片记为很好。没有标记的照片全部保留，不受影响。原图保留，可恢复。</Dialog.Description><div className={styles.confirmImages}>{planPhotos.slice(0,7).map(photo=><img key={photo.id} src={photo.previewUrl} alt={photo.filename}/>)}{planPhotos.length>7&&<span>+{planPhotos.length-7}</span>}</div><div className={styles.confirmActions}><Dialog.Close className={styles.button} disabled={busy}>再看看</Dialog.Close><button type="button" disabled={busy||!plan?.length} className={`${styles.button} ${styles.primary}`} onClick={()=>plan&&void save(plan)}>{busy?"正在保存…":"保存，并把 0 移入回收站"}</button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </main>
}
