"use client"

import { useId, useRef, useState } from "react"
import type { FormEvent } from "react"
import { Archive, Check, CheckCheck, ExternalLink, NotebookPen, Pencil, Plus, RefreshCw, X } from "lucide-react"
import { adminFetch } from "@/utils/admin-auth-client"
import type { ShoppingCatalog, ShoppingMemo } from "@/lib/shopping-watch"
import styles from "./shopping-memos.module.css"

type MemoDraft = Pick<ShoppingMemo, "id" | "title" | "category" | "budget" | "details" | "url" | "status">
type Props = { memos: ShoppingMemo[]; categories: string[]; onChange: (catalog: ShoppingCatalog) => void }
const statusLabels: Record<ShoppingMemo["status"], string> = {
  wanted: "想买", researching: "正在比较", bought: "已买", archived: "已归档",
}

function draftFrom(memo: ShoppingMemo): MemoDraft {
  return { id: memo.id, title: memo.title, category: memo.category, budget: memo.budget, details: memo.details, url: memo.url, status: memo.status }
}

function safeProductUrl(value: string) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null
  } catch (error) {
    if (!(error instanceof TypeError)) throw error
    return null
  }
}

function memoDate(value: string) {
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Europe/Helsinki", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(time) : "未记录"
}

export function ShoppingMemos({ memos, categories, onChange }: Props) {
  const formId = useId()
  const titleRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<MemoDraft | null>(null)
  // Keep the revision from when editing began, even if the parent polls newer data.
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string | undefined>()
  const [showCompleted, setShowCompleted] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [conflict, setConflict] = useState(false)
  const active = memos.filter(memo => !["bought", "archived"].includes(memo.status))
  const ordered = (showCompleted ? memos : active).slice().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  const visible = showAll ? ordered : ordered.slice(0, 4)
  const options = [...new Set(["生活用品", ...categories])].filter(value => value && value !== "全部")
  const busy = saving || refreshing
  const atLimit = memos.length >= 500

  const focusTitle = () => requestAnimationFrame(() => titleRef.current?.focus())
  const newMemo = () => {
    setDraft({ id: crypto.randomUUID(), title: "", category: "生活用品", budget: "", details: "", url: "", status: "wanted" })
    setBaseUpdatedAt(undefined)
    setError(""); setMessage(""); setConflict(false)
    focusTitle()
  }
  const editMemo = (memo: ShoppingMemo) => {
    setDraft(draftFrom(memo)); setBaseUpdatedAt(memo.updatedAt)
    setError(""); setMessage(""); setConflict(false)
    focusTitle()
  }
  const changeField = <K extends keyof MemoDraft>(field: K, value: MemoDraft[K]) => {
    setDraft(current => current ? { ...current, [field]: value } : current)
  }

  const saveMemo = async (memo: MemoDraft, expectedUpdatedAt?: string, closeEditor = false) => {
    setSaving(true); setError(""); setMessage(""); setConflict(false)
    try {
      const response = await adminFetch("/api/shopping", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: { ...memo, title: memo.title.trim(), category: memo.category.trim() || "生活用品", budget: memo.budget.trim(), details: memo.details.trim(), url: memo.url.trim() }, expectedUpdatedAt }),
      })
      const data = await response.json()
      if (response.status === 409) {
        // A quick status action also becomes an editable draft after a conflict.
        if (!draft || draft.id === memo.id) { setDraft(memo); setBaseUpdatedAt(expectedUpdatedAt) }
        setConflict(true)
        setError("这条备忘录已有更新。请读取最新清单，核对后再保存；你的草稿已保留。")
        return
      }
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "服务器未能保存备忘录。")
      if (!data.catalog || data.persisted !== true) throw new Error("服务器尚未确认保存，草稿已保留。")
      onChange(data.catalog)
      if (closeEditor) { setDraft(null); setBaseUpdatedAt(undefined) }
      setMessage(memo.status === "bought" ? "已标记为已买。" : memo.status === "archived" ? "已归档。打开“显示已买和归档”可以找回。" : "备忘录已保存。")
    } catch (caught) {
      setError(caught instanceof Error ? `${caught.message} 草稿未清除；可以读取最新清单核对保存结果。` : "保存结果未确认，草稿已保留。请读取最新清单后核对。")
      if (!draft || draft.id === memo.id) { setDraft(memo); setBaseUpdatedAt(expectedUpdatedAt) }
    } finally { setSaving(false) }
  }

  const refreshLatest = async () => {
    setRefreshing(true); setError(""); setMessage("")
    try {
      const response = await adminFetch("/api/shopping", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "最新清单暂时无法读取。")
      if (!data.catalog) throw new Error("服务器没有返回采购清单。")
      const catalog = data.catalog as ShoppingCatalog
      onChange(catalog)
      if (draft) setBaseUpdatedAt(catalog.memos?.find(memo => memo.id === draft.id)?.updatedAt)
      setConflict(false)
      setMessage("已读取最新清单，草稿仍保留。请与下面的最新记录核对，再点保存。")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "读取最新清单失败，草稿仍保留。")
    } finally { setRefreshing(false) }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (draft?.title.trim() && !busy && !conflict) void saveMemo(draft, baseUpdatedAt, true)
  }

  return <section className={styles.section} aria-labelledby={`${formId}-heading`}>
    <div className={styles.heading}>
      <div><span className={styles.eyebrow}><NotebookPen size={14} /> 我的生活清单</span><h2 id={`${formId}-heading`}>想买的，先记下来 <small>{active.length}</small></h2><p>记下用途、尺寸和预算，之后再慢慢比较。</p></div>
      <button type="button" className={styles.primaryButton} onClick={newMemo} disabled={busy || Boolean(draft) || atLimit}><Plus size={15} />新增想买的物品</button>
    </div>
    <p className={styles.privacy}>登录后跨设备保存；采购篮与逐商品备注仍在当前浏览器</p>
    {atLimit && <p className={styles.limit}>已达到500条备忘录上限；现有记录仍可编辑。</p>}
    {(error || message) && <div className={`${styles.notice} ${error ? styles.error : ""}`} role={error ? "alert" : "status"}>
      <span>{error || message}</span>
      {error && <button type="button" onClick={() => void refreshLatest()} disabled={busy}><RefreshCw size={13} />{refreshing ? "读取中…" : "读取最新，保留草稿"}</button>}
    </div>}
    {draft && <form className={styles.form} onSubmit={submit} aria-label={baseUpdatedAt ? "编辑采购备忘录" : "新增采购备忘录"}>
      <div className={styles.formHeading}><h3>{baseUpdatedAt ? "编辑物品" : "新增物品"}</h3><button type="button" className={styles.textButton} disabled={busy} onClick={() => { setDraft(null); setBaseUpdatedAt(undefined); setConflict(false); setError(""); setMessage("") }}><X size={14} />取消编辑</button></div>
      <fieldset disabled={busy} className={styles.fields}>
        <label className={styles.fullWidth} htmlFor={`${formId}-title`}>想买什么 <span>必填</span><input ref={titleRef} id={`${formId}-title`} required maxLength={150} value={draft.title} placeholder="例如：床头灯、收纳盒、雨鞋" onChange={event => changeField("title", event.target.value)} /></label>
        <label htmlFor={`${formId}-category`}>分类<input id={`${formId}-category`} maxLength={60} list={`${formId}-categories`} value={draft.category} onChange={event => changeField("category", event.target.value)} /><datalist id={`${formId}-categories`}>{options.map(value => <option key={value} value={value} />)}</datalist></label>
        <label htmlFor={`${formId}-budget`}>预算 <span>可写文字</span><input id={`${formId}-budget`} maxLength={100} value={draft.budget} placeholder="例如：€50以内，合适可以再加一点" onChange={event => changeField("budget", event.target.value)} /></label>
        <label className={styles.fullWidth} htmlFor={`${formId}-details`}>用途、尺寸和想法<textarea id={`${formId}-details`} rows={3} maxLength={4000} value={draft.details} placeholder="放在哪里、需要多大、想试哪一款，都可以先记下来。" onChange={event => changeField("details", event.target.value)} /></label>
        <label className={styles.fullWidth} htmlFor={`${formId}-url`}>商品链接 <span>选填</span><input id={`${formId}-url`} type="url" maxLength={2000} value={draft.url} placeholder="https://…" onChange={event => changeField("url", event.target.value)} /></label>
        <label htmlFor={`${formId}-status`}>目前状态<select id={`${formId}-status`} value={draft.status} onChange={event => changeField("status", event.target.value as ShoppingMemo["status"])}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className={styles.submitRow}><button className={styles.primaryButton} type="submit" disabled={busy || !draft.title.trim() || conflict}>{saving ? <RefreshCw size={15} className={styles.spinning} /> : <Check size={15} />}{saving ? "保存中…" : "保存备忘录"}</button></div>
      </fieldset>
    </form>}
    <div className={styles.listHeading}><span>{showCompleted ? `全部 ${memos.length} 条` : `待购 ${active.length} 条`}</span><label><input type="checkbox" checked={showCompleted} onChange={event => setShowCompleted(event.target.checked)} />显示已买和归档</label></div>
    {!visible.length ? <div className={styles.empty}>{memos.length ? "待购清单已经清空。打开上面的选项，可以查看已买和归档物品。" : "还没有备忘录。想到什么想买的，就先记在这里。"}</div> : <div className={styles.grid}>{visible.map(memo => {
      const link = safeProductUrl(memo.url)
      const disabled = busy || Boolean(draft)
      return <article key={memo.id} className={`${styles.card} ${["bought", "archived"].includes(memo.status) ? styles.completed : ""}`}>
        <div className={styles.cardTop}><span>{memo.category || "生活用品"}</span><span className={`${styles.status} ${styles[memo.status]}`}>{statusLabels[memo.status]}</span></div>
        <h3>{memo.title}</h3>
        {memo.budget && <p className={styles.budget}>预算 <strong>{memo.budget}</strong></p>}
        {memo.details && <p className={styles.details}>{memo.details}</p>}
        {link && <a href={link} target="_blank" rel="noopener noreferrer" className={styles.productLink}>查看商品链接 <ExternalLink size={13} /></a>}
        <div className={styles.cardActions}>
          <button type="button" disabled={disabled} onClick={() => editMemo(memo)} aria-label={`编辑 ${memo.title}`}><Pencil size={13} />编辑</button>
          {!["bought", "archived"].includes(memo.status) && <button type="button" disabled={disabled} onClick={() => void saveMemo({ ...draftFrom(memo), status: "bought" }, memo.updatedAt)} aria-label={`将 ${memo.title} 标记为已买`}><CheckCheck size={14} />已买</button>}
          {memo.status !== "archived" ? <button type="button" disabled={disabled} onClick={() => void saveMemo({ ...draftFrom(memo), status: "archived" }, memo.updatedAt)} aria-label={`归档 ${memo.title}`}><Archive size={13} />归档</button> : <button type="button" disabled={disabled} onClick={() => void saveMemo({ ...draftFrom(memo), status: "wanted" }, memo.updatedAt)} aria-label={`将 ${memo.title} 恢复为待购`}><RefreshCw size={13} />恢复待购</button>}
          <time dateTime={memo.updatedAt}>更新于 {memoDate(memo.updatedAt)}</time>
        </div>
      </article>
    })}</div>}
    {ordered.length > 4 && <button type="button" className={styles.textButton} onClick={() => setShowAll(value => !value)}>{showAll ? "收起清单" : `展开其余 ${ordered.length - 4} 条备忘录`}</button>}
  </section>
}
