"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown, ArrowUpRight, Check, CheckCheck, Clock3, ExternalLink, Heart, RefreshCw, RotateCcw, Search, ShoppingBag, SlidersHorizontal, X } from "lucide-react"
import { adminFetch } from "@/utils/admin-auth-client"
import { useDocumentTitle } from "@/lib/use-document-title"
import { campaignStatus, itemJudgment, verifiedSaving } from "@/lib/shopping-watch"
import type { ShoppingCatalog, ShoppingItem } from "@/lib/shopping-watch"
import { isShoppingItemDismissed, shoppingDismissalQuote } from "@/lib/shopping-dismissal.mjs"
import styles from "./shopping-watch.module.css"
import { ShoppingMemos } from "./shopping-memos"

type LocalState = { saved: string[]; purchased: string[]; targets: Record<string, number | null>; notes: Record<string, string> }
const initialLocal: LocalState = { saved: [], purchased: [], targets: {}, notes: {} }
const storageKey = "lijie-shopping-watch-v1"
const verdicts = { consider: "值得考虑", wait: "继续等", skip: "先跳过" }
const statusLabels = { active: "进行中", upcoming: "即将开始", ended: "已结束", unknown: "待复核" }
const money = (value: number | null) => value === null ? "待报价" : new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value)
const stamp = (value?: string | null) => value ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Europe/Helsinki", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "尚未核实"
function age(value: string | undefined, now: number) {
  if (!value) return "尚未运行"
  const mins = Math.max(0, Math.floor((now - Date.parse(value)) / 60000))
  return mins < 1 ? "刚刚" : mins < 60 ? `${mins} 分钟前` : `${Math.floor(mins / 60)} 小时前`
}

export function ShoppingWatch() {
  useDocumentTitle("黑五与新家采购 · Lijie Li")
  const [catalog, setCatalog] = useState<ShoppingCatalog | null>(null)
  const [warning, setWarning] = useState("")
  const [error, setError] = useState("")
  const [authNeeded, setAuthNeeded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [local, setLocal] = useState<LocalState>(initialLocal)
  const [localReady, setLocalReady] = useState(false)
  const [category, setCategory] = useState("全部")
  const [query, setQuery] = useState("")
  const [view, setView] = useState("all")
  const [sort, setSort] = useState("priority")
  const [drawer, setDrawer] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [notice, setNotice] = useState("")
  const [pendingDismissal, setPendingDismissal] = useState<string | null>(null)
  const dismissalBusy = useRef(false)
  const dismissalFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (pendingDismissal !== null) return
    dismissalFocus.current?.focus()
    dismissalFocus.current = null
  }, [pendingDismissal])
  const acceptCatalog = useCallback((next: ShoppingCatalog) => setCatalog(current => {
    if (current && Date.parse(current.updatedAt || current.curatedAt) > Date.parse(next.updatedAt || next.curatedAt)) return current
    return next
  }), [])
  const pageRef = useRef<HTMLElement>(null)
  const drawerRef = useRef<HTMLElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await adminFetch("/api/shopping", { cache: "no-store" })
      if (response.status === 401 || response.status === 403) { setAuthNeeded(true); setCatalog(null); return }
      if (!response.ok) throw new Error("采购清单暂时无法读取。")
      const data = await response.json()
      acceptCatalog(data.catalog); setWarning(data.warning || ""); setError(""); setAuthNeeded(false)
    } catch (caught) {
      if (caught instanceof Error && /Missing admin session|Two-factor/.test(caught.message)) {
        setAuthNeeded(true); setCatalog(null)
      } else setError("更新读取失败，已保留上次显示的清单。")
    } finally { setLoading(false) }
  }, [acceptCatalog])

  useEffect(() => { void load(); const timer = setInterval(() => { setNow(Date.now()); if (document.visibilityState === "visible") void load() }, 60000); return () => clearInterval(timer) }, [load])
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed.saved) && Array.isArray(parsed.purchased)) setLocal({ ...initialLocal, ...parsed })
      }
    } catch { setNotice("浏览器收藏未能读取；当前仍可浏览商品。") }
    setLocalReady(true)
  }, [])
  useEffect(() => {
    if (!localReady) return
    try { localStorage.setItem(storageKey, JSON.stringify(local)) }
    catch { setNotice("浏览器存储不可用，采购篮无法在关闭页面后保留。") }
  }, [local, localReady])
  useEffect(() => {
    if (!drawer || !drawerRef.current) return
    const panel = drawerRef.current
    const previousFocus = document.activeElement as HTMLElement | null
    const oldOverflow = document.body.style.overflow
    const backgrounds = Array.from(pageRef.current?.children || []).filter(child => !child.contains(panel)) as HTMLElement[]
    backgrounds.forEach(element => { element.inert = true })
    document.body.style.overflow = "hidden"
    panel.querySelector<HTMLButtonElement>("button")?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setDrawer(false) }
      if (event.key !== "Tab") return
      const controls = Array.from(panel.querySelectorAll<HTMLElement>("a[href],button:not(:disabled),input,textarea,select"))
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener("keydown", keyboard)
    return () => { backgrounds.forEach(element => { element.inert = false }); document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", keyboard); previousFocus?.focus() }
  }, [drawer])

  const toggle = (field: "saved" | "purchased", id: string) => setLocal(state => ({ ...state, [field]: state[field].includes(id) ? state[field].filter(value => value !== id) : [...state[field], id] }))
  const items = catalog?.items || []
  const dismissals = useMemo(() => new Map((catalog?.dismissals || []).map(entry => [entry.itemId, entry])), [catalog?.dismissals])
  const availableItems = items.filter(item => !isShoppingItemDismissed(item, dismissals.get(item.id), now))
  const hiddenCount = items.length - availableItems.length
  const countedItems = view === "hidden" ? items.filter(item => isShoppingItemDismissed(item, dismissals.get(item.id), now)) : availableItems
  const changeDismissal = async (item: ShoppingItem, action: "dismiss" | "restore") => {
    if (dismissalBusy.current) return
    const trigger = document.activeElement as HTMLElement | null
    const hadFocus = trigger?.getAttribute("data-dismiss-item") === item.id
    dismissalBusy.current = true; setPendingDismissal(item.id)
    try {
      const response = await adminFetch("/api/shopping", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissal: { itemId: item.id, action, expectedDismissedAt: dismissals.get(item.id)?.dismissedAt ?? null, expectedQuote: shoppingDismissalQuote(item) } }),
      })
      const data = await response.json()
      if (!response.ok || !data.catalog || data.persisted !== true) {
        if (response.status === 409) await load()
        throw new Error(typeof data.error === "string" ? data.error : "隐藏状态尚未确认保存，请重试。")
      }
      if (hadFocus && (document.activeElement === document.body || document.activeElement === trigger)) {
        const card = trigger?.closest("article")
        const adjacent = card?.nextElementSibling || card?.previousElementSibling
        const nextFocus = adjacent?.querySelector<HTMLButtonElement>("button[data-dismiss-item]") || pageRef.current?.querySelector<HTMLButtonElement>('[data-shopping-view="hidden"]')
        dismissalFocus.current = nextFocus || null
      }
      acceptCatalog(data.catalog); setNow(Date.now())
      setNotice(action === "restore" ? "已恢复显示。" : shoppingDismissalQuote(item) ? "已隐藏并同步。只有核实到更低价格才会重新显示，也可在“已隐藏”中恢复。" : "已隐藏并同步。当前没有可比较的报价，将保持隐藏；可在“已隐藏”中恢复。")
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "隐藏状态保存失败，请重试。")
    } finally {
      if (hadFocus && document.activeElement === document.body && !dismissalFocus.current && trigger?.isConnected) dismissalFocus.current = trigger
      dismissalBusy.current = false; setPendingDismissal(null)
    }
  }
  const categories = ["全部", ...Array.from(new Set([...(catalog?.requirements || []).map(item => item.category), ...items.map(item => item.category)]))]
  const saved = items.filter(item => local.saved.includes(item.id) && !local.purchased.includes(item.id))
  const sum = saved.reduce((value, item) => value + (item.price || 0), 0)
  const findings = availableItems.filter(item => verifiedSaving(item, now) !== null && item.stockStatus !== "out_of_stock").slice(0, 3)
  const visible = useMemo(() => items.filter(item => {
    const hidden = isShoppingItemDismissed(item, dismissals.get(item.id), now)
    if (view === "hidden" ? !hidden : hidden) return false
    if (category !== "全部" && category !== item.category) return false
    if (query && !`${item.name} ${item.brand} ${item.category} ${item.variant}`.toLowerCase().includes(query.toLowerCase())) return false
    const purchased = local.purchased.includes(item.id)
    if (view === "hidden") return true
    if (view === "purchased") return purchased
    if (purchased) return false
    if (view === "saved") return local.saved.includes(item.id)
    if (["consider", "wait", "skip"].includes(view)) return itemJudgment(item, now) === view
    return true
  }).sort((a, b) => sort === "price" ? (a.price ?? Infinity) - (b.price ?? Infinity) : sort === "latest" ? Date.parse(b.priceVerifiedAt || "1970") - Date.parse(a.priceVerifiedAt || "1970") : a.priority - b.priority), [items, category, query, view, sort, local, now, dismissals])

  const copyBasket = async () => {
    const text = saved.map(item => `${item.brand} ${item.name} ${item.variant}\n${money(item.price)} · ${item.shippingNote}\n${item.url}`).join("\n\n")
    try { await navigator.clipboard.writeText(text); setNotice("采购篮已复制。") }
    catch { setNotice("复制失败，请从商品卡片打开商家。") }
  }

  const renderCard = (item: ShoppingItem) => {
    const verdict = itemJudgment(item, now), saving = verifiedSaving(item, now)
    const isSaved = local.saved.includes(item.id), purchased = local.purchased.includes(item.id)
    const target = Object.prototype.hasOwnProperty.call(local.targets, item.id) ? local.targets[item.id] : (item.category === "电视" ? catalog?.preferences?.tvTarget ?? null : null)
    const stale = !item.priceVerifiedAt || now - Date.parse(item.priceVerifiedAt) > 86400000
    const failed = item.observation?.status === "error"
    const hidden = isShoppingItemDismissed(item, dismissals.get(item.id), now)
    const reached = target !== null && item.price !== null && item.shipping !== null && item.price + item.shipping <= target && !stale && !failed
    return <article className={styles.card} key={item.id}>
      <div className={styles.cardTop}><span className={styles.categoryTag}>{item.category} <span> / {item.brand}{item.purchaseRegion ? ` · ${item.purchaseRegion}` : ""}</span></span><div className={styles.cardTools}><button type="button" className={styles.heart} aria-label={`${isSaved ? "移出" : "加入"}采购篮 ${item.name}`} aria-pressed={isSaved} onClick={() => toggle("saved", item.id)}><Heart size={18} fill={isSaved ? "currentColor" : "none"} /></button><button type="button" className={styles.dismissButton} data-dismiss-item={item.id} aria-label={`${hidden ? "恢复显示" : "隐藏"} ${item.name}`} title={hidden ? "恢复显示" : "隐藏，价格更低时再显示"} disabled={pendingDismissal !== null} aria-busy={pendingDismissal === item.id} onClick={() => void changeDismissal(item, hidden ? "restore" : "dismiss")}>{pendingDismissal === item.id ? <RefreshCw size={17} className={styles.spinning} /> : hidden ? <RotateCcw size={17} /> : <X size={17} />}</button></div></div>
      <div className={styles.productHead}><div className={styles.productMark} aria-hidden="true">{item.brand.slice(0, 2).toUpperCase()}</div><div><h3>{item.name}</h3><p>{item.variant}</p></div></div>
      <div className={styles.priceRow}><strong>{money(item.price)}</strong><span className={`${styles.verdict} ${styles[verdict]}`}>{verdicts[verdict]}</span></div>
      {item.foreignQuote && <p className={styles.foreignQuote}>{new Intl.NumberFormat("zh-CN", {style:"currency", currency:item.foreignQuote.currency}).format(item.foreignQuote.amount)} · {item.foreignQuote.note}</p>}
      <div className={styles.delivery}>{item.shipping === null ? "到手价待运费确认" : `已知到手价 ${money(item.price === null ? null : item.price + item.shipping)}`}<span>{item.shippingNote}</span></div>
      <div className={styles.badges}>{dismissals.has(item.id) && !hidden && <span className={styles.saving}>低于隐藏时的价格</span>}{hidden && <span>已隐藏 · 降价后再看</span>}{saving !== null && <span className={styles.saving}>较所示30天低价低 {saving}%</span>}{item.low30 !== null && saving === null && <span>所示30天低价 {money(item.low30)} · {stamp(item.low30VerifiedAt)}</span>}{reached && <span className={styles.saving}>已知到手价达到目标</span>}{failed && <span className={styles.caution}>本轮未核实</span>}{stale && <span className={styles.caution}>报价待更新</span>}</div>
      <p className={styles.reason}>{item.reason}</p>
      <div className={styles.stock}><span className={`${styles.stockDot} ${item.stockStatus === "in_stock" ? styles.inStock : ""}`} /><span>{item.stockNote}</span></div>
      <div className={styles.cardActions}><a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.shopLink}>去商家看 <ArrowUpRight size={16} /></a><button type="button" onClick={() => toggle("saved", item.id)} className={isSaved ? styles.savedButton : styles.saveButton}>{isSaved ? <Check size={14} /> : <ShoppingBag size={14} />}{isSaved ? "已入采购篮" : "加入采购篮"}</button></div>
      <details className={styles.details}><summary>价格依据与我的计划 <SlidersHorizontal size={13} /></summary><div className={styles.detailBody}>
        <p>报价核实：{stamp(item.priceVerifiedAt)} EET · {item.sourceKind === "comparison" ? "比价线索" : item.sourceKind === "official_api" ? "商家产品接口" : "商家页面"}</p>
        <p>{item.evidenceNote}</p>{item.observation?.error && <p className={styles.caution}>最近采集：{item.observation.error} · {stamp(item.observation.attemptedAt)}</p>}
        {item.saleEndsAt && <p>所示活动截止：{stamp(item.saleEndsAt)} EET</p>}
        {item.baseline && <p>参考基线 {money(item.baseline.price)}：{item.baseline.note}</p>}
        {item.history.length > 0 && <div className={styles.history}>{item.history.slice(-4).map((entry, index) => <div key={`${entry.at}-${index}`}><span>{stamp(entry.at)}</span><b>{money(entry.price)}</b></div>)}</div>}
        <label>我的到手目标价 €<input type="number" min="0" step="1" placeholder="未设置" value={target ?? ""} onChange={event => { const value = event.target.value; setLocal(state => ({ ...state, targets: { ...state.targets, [item.id]: value === "" ? null : Number(value) } })) }} /></label>
        <label>尺寸、颜色或试坐记录<textarea rows={2} value={local.notes[item.id] || ""} placeholder="例如：先量窗宽，再决定片数" onChange={event => setLocal(state => ({ ...state, notes: { ...state.notes, [item.id]: event.target.value } }))} /></label>
        <button type="button" onClick={() => toggle("purchased", item.id)} className={styles.purchasedButton}><CheckCheck size={14} />{purchased ? "恢复到待购" : "标记已购买"}</button>
      </div></details>
    </article>
  }

  return <main className={styles.page} ref={pageRef}>
    <header className={styles.header}><Link href="/" className={styles.wordmark}>LIJIE <span>生活采购</span></Link><nav aria-label="页面导航"><Link href="/ai-feed">信息流</Link><Link href="/admin">管理</Link><button type="button" onClick={() => setDrawer(true)}><ShoppingBag size={17} />采购篮 <span>{saved.length}</span></button></nav></header>
    <div className={styles.container}>
      <section className={styles.hero}><div><div className={styles.eyebrow}><span /> {catalog?.preferences?.locationLabel || "SHOPPING WATCH"} · {catalog?.preferences?.seasonLabel || "采购清单"}</div><h1>{catalog?.preferences?.headline || "采购价格观察"}</h1><p>{catalog?.preferences?.subtitle || "把候选留在这里，比较商品、规格与到手价。"}</p><div className={styles.heroLinks}><span>报价与活动持续观察</span><span>欧元 EUR</span></div></div><div className={styles.heroAside}><span>采购计划</span><strong>{catalog?.preferences?.priorityTitle || "好用，也买得值。"}</strong><p>{catalog?.preferences?.priorityLines?.map((line, index) => <span key={index}>{line}<br /></span>) || "登录后查看关注项目。"}</p></div></section>
      <div className={styles.statusbar}><div><span className={styles.liveDot} /><b>最近采集 {age(catalog?.lastAttemptAt, now)}</b><span>· 成功核实 {catalog?.run?.succeeded ?? "—"}/{catalog?.run?.attempted ?? "—"} 项</span><span>· 采集计划每10分钟，页面每分钟读取</span></div><button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? styles.spinning : ""} />读取最新</button></div>
      {(warning || error || notice) && <div className={styles.notice} role="status">{[warning, error, notice].filter(Boolean).join(" ")}{notice && <button type="button" aria-label="关闭提示" onClick={() => setNotice("")}><X size={14} /></button>}</div>}
      {authNeeded ? <section className={styles.auth}><ShoppingBag size={32} /><h2>登录后查看采购清单</h2><p>使用个人网站已有账号与两步验证。</p><Link href="/login?next=/shopping">登录并返回采购页 <ArrowUpRight size={16} /></Link></section> : !catalog ? <div className={styles.empty}>{loading ? "正在读取采购清单…" : "暂时无法读取清单，请重试。"}</div> : <>
      <ShoppingMemos memos={catalog.memos || []} categories={categories.filter(value => value !== "全部")} onChange={acceptCatalog} />
      {findings.length > 0 && <section className={styles.findings} aria-label="已核查的降价"><div className={styles.sectionTitle}><h2>这一轮值得看</h2><span>同款与商家所示30天最低价比较</span></div><div className={styles.findingGrid}>{findings.map(item => <button type="button" key={item.id} onClick={() => { setQuery(item.name); setCategory("全部"); setView("all"); document.getElementById("shopping-products")?.scrollIntoView({ behavior: "smooth" }) }}><div><span>{item.category}</span><h3>{item.name}</h3></div><strong>{money(item.price)}<small><ArrowDown size={12} />{verifiedSaving(item, now)}%</small></strong></button>)}</div></section>}
      <section className={styles.campaignSection}><div className={styles.sectionTitle}><h2>品牌与活动日历</h2><span>开始时间、有效期和待核实的预告</span></div><div className={styles.campaigns}>{catalog.campaigns.filter(campaign => !campaign.linkedItemId || availableItems.some(item => item.id === campaign.linkedItemId)).map(campaign => { const state = campaignStatus(campaign, now, items); return <a key={campaign.id} href={campaign.url} target="_blank" rel="noopener noreferrer" className={styles.campaign}><div><b>{campaign.brand}</b><span className={`${styles.campaignStatus} ${styles[state]}`}>{statusLabels[state]}</span></div><h3>{campaign.title}</h3><p>{campaign.note}</p><footer>{campaign.startsAt ? stamp(campaign.startsAt) : "活动入口"}<ExternalLink size={13} /></footer></a> })}</div></section>
      <section className={styles.products} id="shopping-products"><aside className={styles.sidebar}><span className={styles.overline}>采购分类</span><div>{categories.map(value => <button type="button" key={value} className={value === category ? styles.selectedCategory : ""} onClick={() => setCategory(value)}>{value}<span>{value === "全部" ? countedItems.length : countedItems.filter(item => item.category === value).length}</span></button>)}</div><div className={styles.sidebarNote}><Clock3 size={18} /><b>真正值得买，再出手。</b><p>运费、库存、尺码和过期活动，会一起影响判断。</p>{catalog.preferences?.logisticsNote && <p>{catalog.preferences.logisticsNote}</p>}</div></aside>
      <div className={styles.productMain}><div className={styles.productHeading}><div><span className={styles.overline}>MY WATCHLIST</span><h2>{category === "全部" ? "所有采购候选" : category}<small>{visible.length}</small></h2></div><label className={styles.search}><Search size={17} /><input type="search" placeholder="搜索品牌、商品、品类" aria-label="搜索商品" value={query} onChange={event => setQuery(event.target.value)} /></label></div><div className={styles.toolbar}><div className={styles.tabs}>{[["all", "全部"], ["consider", "值得考虑"], ["wait", "继续等"], ["skip", "先跳过"], ["saved", "采购篮"], ["purchased", "已购买"], ["hidden", `已隐藏${hiddenCount ? ` ${hiddenCount}` : ""}`]].map(([value, label]) => <button type="button" key={value} data-shopping-view={value} className={view === value ? styles.activeTab : ""} onClick={() => setView(value)}>{label}</button>)}</div><select value={sort} onChange={event => setSort(event.target.value)} aria-label="商品排序"><option value="priority">按采购优先级</option><option value="price">按商品价从低到高</option><option value="latest">按最近核实</option></select></div><div className={styles.cardGrid}>{visible.map(renderCard)}</div>{!visible.length && <div className={styles.empty}>这里暂时没有商品。试试其他分类或筛选。</div>}</div></section>
      <section className={styles.needs}><h2>还需要确认的选择</h2><div>{catalog.requirements.map((requirement, index) => <article key={`${requirement.category}-${index}`}><b>{requirement.category}</b><p>{requirement.need}</p><small>{requirement.note}</small></article>)}</div></section>
      <footer className={styles.footer}><p>“值得考虑”是采购判断；只有查到同款近期价格，才标实际降价。报价以商家结算页为准。</p><p>商品右上角 × 可隐藏候选；核实到更低价格后才重新显示。隐藏状态在设备间同步；运费已知时按到手价比较，未知时只比较商品价。</p><p>采购篮、目标价和备注保存在当前浏览器。加入采购篮后，点击“去商家”选规格并下单。</p><span>清单整理于 {stamp(catalog.curatedAt)} EET · 最新成功核实 {age(catalog.lastSuccessAt, now)}</span></footer>
      </>}
    </div>
    {drawer && <div className={styles.drawerBackdrop} onClick={() => setDrawer(false)}><section ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="basket-title" onClick={event => event.stopPropagation()}><header><div><span className={styles.overline}>MY BASKET</span><h2 id="basket-title">采购篮 <small>{saved.length}</small></h2></div><button type="button" onClick={() => setDrawer(false)} aria-label="关闭采购篮"><X size={22} /></button></header><p className={styles.basketHint}>收藏候选，比较后再到商家下单。</p><div className={styles.basketItems}>{saved.length ? saved.map(item => <article key={item.id}><div><b>{item.name}</b><small>{item.variant}</small><strong>{money(item.price)}</strong><span>{item.shippingNote}</span></div><div><a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`到商家查看 ${item.name}`}><ArrowUpRight size={18} /></a><button type="button" aria-label={`移除 ${item.name}`} onClick={() => toggle("saved", item.id)}><X size={15} /></button></div></article>) : <p>点击商品卡片的“加入采购篮”，把候选放在一起比较。</p>}</div><div className={styles.basketTotal}><span>已知商品价合计</span><strong>{money(sum)}</strong><p>另加已知运费 {money(saved.reduce((value, item) => value + (item.shipping || 0), 0))}；{saved.filter(item => item.shipping === null).length} 件运费待确认，{saved.filter(item => item.price === null).length} 件待报价。</p></div><button type="button" className={styles.copyBasket} disabled={!saved.length} onClick={() => void copyBasket()}>复制采购清单</button><small className={styles.basketHint}>收藏仅保存在当前浏览器。</small></section></div>}
  </main>
}
