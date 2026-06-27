"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, Copy, ExternalLink, EyeOff, RefreshCw, RotateCcw, Star } from "lucide-react"
import { adminFetch } from "@/utils/admin-auth-client"

type FeedKind = "deep-read" | "signal" | "theme" | "concept" | "paper" | "action"

type FeedLink = {
  label: string
  url: string
}

type FeedBlock = {
  id?: string
  fingerprints?: string[]
  kind: FeedKind
  title: string
  source: string
  sourceStatus?: string
  sourceWarning?: string
  summary: string
  why: string
  thought: string
  priority?: number
  links?: FeedLink[]
}

type FeedPayload = {
  date: string
  generatedAt?: string
  overview?: string
  sourceStatusLine?: string
  blocks: FeedBlock[]
}

type StateEntry = {
  status?: "dismissed" | "read" | "new"
  at?: string
  cleared?: boolean
  clearedAt?: string
}

type ExposureEntry = {
  at?: string
  feedStamp?: string
  blockId?: string
}

type PinnedEntry = {
  at?: string
  block: FeedBlock
}

type SharedState = {
  state?: Record<string, StateEntry>
  exposurePool?: Record<string, ExposureEntry>
  pinned?: Record<string, PinnedEntry>
}

const feedApiPath = "/api/ai-feed"
const stateKey = "ai-intel-feed-state-v1"
const exposurePoolKey = "ai-intel-feed-exposure-pool-v2"
const pinnedKey = "ai-intel-feed-pinned-v1"
const exposureTtlMs = 12 * 60 * 60 * 1000

const kindLabel: Record<FeedKind, string> = {
  "deep-read": "深读",
  signal: "信号",
  theme: "综合判断",
  concept: "概念",
  paper: "论文",
  action: "待处理",
}

const preferredOrder: Record<FeedKind, number> = {
  "deep-read": 0,
  signal: 1,
  theme: 2,
  concept: 3,
  paper: 4,
  action: 5,
}

function titleSignature(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)
}

function canonicalUrl(url: string) {
  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("file://")) return ""
  try {
    const parsed = new URL(url)
    if (parsed.hostname.toLowerCase() === "mail.google.com") {
      return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, "") || "/"}${parsed.search}${parsed.hash}`
    }
    const kept = new URLSearchParams()
    parsed.searchParams.forEach((value, key) => {
      if (key === "fbclid" || key === "gclid" || key === "mc_cid" || key === "mc_eid" || key === "ref" || key === "source") return
      if (key.startsWith("utm_")) return
      kept.append(key, value)
    })
    const query = kept.toString()
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, "") || "/"}${query ? `?${query}` : ""}`
  } catch {
    return ""
  }
}

function blockFingerprints(block: FeedBlock) {
  const values = new Set<string>(block.fingerprints || [])
  values.add(`title:${titleSignature(block.title)}`)
  for (const link of block.links || []) {
    const canonical = canonicalUrl(link.url)
    if (canonical) values.add(`url:${canonical}`)
  }
  return [...values].filter((value) => !value.endsWith(":"))
}

function blockKey(block: FeedBlock) {
  if (block.id) return block.id
  const firstUrl = block.links?.[0]?.url || ""
  return `${block.kind}:${titleSignature(block.title)}:${canonicalUrl(firstUrl)}`
}

function readJsonMap<T>(key: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}")
  } catch {
    return {}
  }
}

function writeJsonMap<T>(key: string, value: Record<string, T>) {
  localStorage.setItem(key, JSON.stringify(value))
}

function mergeByTime<T extends { at?: string; clearedAt?: string }>(base: Record<string, T>, incoming?: Record<string, T>) {
  const merged = { ...base }
  for (const [key, value] of Object.entries(incoming || {})) {
    const existing = merged[key]
    const oldAt = existing?.clearedAt || existing?.at || ""
    const newAt = value?.clearedAt || value?.at || ""
    if (!existing || newAt >= oldAt) merged[key] = value
  }
  return merged
}

function pruneExposurePool(pool: Record<string, ExposureEntry>) {
  const now = Date.now()
  return Object.fromEntries(
    Object.entries(pool).filter(([, value]) => {
      const at = Date.parse(value.at || "")
      return Number.isFinite(at) && now - at < exposureTtlMs
    }),
  )
}

function linkIsObsidian(url: string) {
  return url.startsWith("obsidian://")
}

function buildCopyText(block: FeedBlock) {
  const links = block.links?.map((link) => `- ${link.label}: ${link.url}`).join("\n") || "- 无链接"
  return [
    `请和我讨论这个 AI 信息流块：${block.title}`,
    `类型：${kindLabel[block.kind] || block.kind}`,
    `来源：${block.source}`,
    `来源状态：${block.sourceStatus || "未标注"}`,
    `摘要：${block.summary}`,
    `为什么重要：${block.why}`,
    `我该怎么想：${block.thought}`,
    "",
    "链接：",
    links,
  ].join("\n")
}

export function AiIntelFeed() {
  const [feed, setFeed] = useState<FeedPayload | null>(null)
  const [error, setError] = useState("")
  const [authNeeded, setAuthNeeded] = useState(false)
  const [state, setState] = useState<Record<string, StateEntry>>({})
  const [exposurePool, setExposurePool] = useState<Record<string, ExposureEntry>>({})
  const [pinned, setPinned] = useState<Record<string, PinnedEntry>>({})
  const [showDiscarded, setShowDiscarded] = useState(false)
  const [copiedId, setCopiedId] = useState("")
  const [toast, setToast] = useState("")

  const feedStamp = feed?.generatedAt || feed?.date || ""

  useEffect(() => {
    async function load() {
      const localState = readJsonMap<StateEntry>(stateKey)
      const localExposurePool = pruneExposurePool(readJsonMap<ExposureEntry>(exposurePoolKey))
      const localPinned = readJsonMap<PinnedEntry>(pinnedKey)

      const response = await adminFetch(feedApiPath, { cache: "no-store" })
      if (response.status === 401 || response.status === 403) {
        setAuthNeeded(true)
        return
      }
      if (!response.ok) throw new Error(`Feed request failed: ${response.status}`)
      const payload = (await response.json()) as { feed: FeedPayload; sharedState: SharedState }
      const shared = payload.sharedState || {}

      const nextState = mergeByTime(localState, shared.state)
      const nextExposurePool = pruneExposurePool(mergeByTime(localExposurePool, shared.exposurePool))
      const nextPinned = mergeByTime(localPinned, shared.pinned)
      setState(nextState)
      setExposurePool(nextExposurePool)
      setPinned(nextPinned)
      writeJsonMap(stateKey, nextState)
      writeJsonMap(exposurePoolKey, nextExposurePool)
      writeJsonMap(pinnedKey, nextPinned)

      setFeed(payload.feed)
    }

    load().catch((err: Error) => {
      if (err.message.includes("Missing admin session")) setAuthNeeded(true)
      else setError(err.message)
    })
  }, [])

  const blocks = useMemo(() => {
    return [...(feed?.blocks || [])].sort((a, b) => {
      const byOrder = preferredOrder[a.kind] - preferredOrder[b.kind]
      if (byOrder !== 0) return byOrder
      return (b.priority || 0) - (a.priority || 0)
    })
  }, [feed])

  const isDismissed = (block: FeedBlock) => {
    const entry = state[blockKey(block)]
    return entry?.status === "dismissed" || entry?.status === "read"
  }

  const isPoolSuppressed = (block: FeedBlock) => {
    return blockFingerprints(block).some((fingerprint) => {
      const entry = exposurePool[fingerprint]
      return entry && entry.feedStamp !== feedStamp
    })
  }

  const isPinned = (block: FeedBlock) => {
    return Object.values(pinned).some((entry) => {
      const entryFingerprints = new Set(blockFingerprints(entry.block))
      return blockKey(entry.block) === blockKey(block) || blockFingerprints(block).some((fingerprint) => entryFingerprints.has(fingerprint))
    })
  }

  const activeBlocks = blocks.filter((block) => !isDismissed(block) && !isPinned(block) && !isPoolSuppressed(block))
  const pinnedBlocks = Object.values(pinned)
    .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
    .map((entry) => blocks.find((block) => blockKey(block) === blockKey(entry.block)) || entry.block)
    .filter((block) => !isDismissed(block))
  const dismissedBlocks = blocks.filter((block) => isDismissed(block) && !state[blockKey(block)]?.cleared)
  const actionBlocks = activeBlocks.filter((block) => block.kind === "action").slice(0, 3)
  const nonActionBlocks = activeBlocks.filter((block) => block.kind !== "action")
  const topBlock = nonActionBlocks[0]
  const feedBlocks = nonActionBlocks.slice(1)
  const roundTotal = activeBlocks.length + dismissedBlocks.length + pinnedBlocks.length
  const handled = Math.max(0, roundTotal - activeBlocks.length)
  const progress = roundTotal ? Math.min(100, Math.round((handled / roundTotal) * 100)) : 0

  function persistState(nextState = state, nextExposurePool = exposurePool, nextPinned = pinned) {
    writeJsonMap(stateKey, nextState)
    writeJsonMap(exposurePoolKey, nextExposurePool)
    writeJsonMap(pinnedKey, nextPinned)
  }

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(""), 1800)
  }

  function dismissBlock(block: FeedBlock) {
    const key = blockKey(block)
    const nextState = { ...state, [key]: { status: "dismissed" as const, at: new Date().toISOString(), cleared: false } }
    const nextExposurePool = { ...exposurePool }
    for (const fingerprint of blockFingerprints(block)) {
      nextExposurePool[fingerprint] = { at: new Date().toISOString(), feedStamp, blockId: key }
    }
    const nextPinned = { ...pinned }
    delete nextPinned[key]
    setState(nextState)
    setExposurePool(nextExposurePool)
    setPinned(nextPinned)
    persistState(nextState, nextExposurePool, nextPinned)
  }

  function restoreBlock(block: FeedBlock) {
    const key = blockKey(block)
    const nextState = { ...state }
    delete nextState[key]
    const nextExposurePool = { ...exposurePool }
    for (const fingerprint of blockFingerprints(block)) delete nextExposurePool[fingerprint]
    setState(nextState)
    setExposurePool(nextExposurePool)
    persistState(nextState, nextExposurePool, pinned)
  }

  function clearRoundDismissed() {
    const nextState = { ...state }
    for (const block of blocks) {
      const key = blockKey(block)
      const entry = nextState[key]
      if (entry?.status === "dismissed" || entry?.status === "read") {
        nextState[key] = { ...entry, cleared: true, clearedAt: new Date().toISOString() }
      }
    }
    setState(nextState)
    persistState(nextState, exposurePool, pinned)
    showToast("本轮已丢弃列表已清空")
  }

  function togglePinned(block: FeedBlock) {
    const key = blockKey(block)
    const nextPinned = { ...pinned }
    if (isPinned(block)) {
      delete nextPinned[key]
      showToast("已取消钉住")
    } else {
      nextPinned[key] = { at: new Date().toISOString(), block }
      showToast("已钉住待看")
    }
    setPinned(nextPinned)
    persistState(state, exposurePool, nextPinned)
  }

  async function copyBlock(block: FeedBlock) {
    const key = blockKey(block)
    await navigator.clipboard.writeText(buildCopyText(block))
    setCopiedId(key)
    showToast("已复制给 Codex 讨论")
    window.setTimeout(() => setCopiedId(""), 1400)
  }

  function renderBlock(block: FeedBlock, compact = false) {
    const key = blockKey(block)
    const dismissed = isDismissed(block)
    const pinnedState = isPinned(block)
    return (
      <article
        key={key}
        className={`rounded-lg border bg-white shadow-[0_14px_36px_rgba(41,50,48,0.10)] ${
          compact ? "p-3 shadow-none" : "p-4 sm:p-[18px]"
        } ${pinnedState ? "border-[#b8d6cf] bg-[#fbfefd]" : "border-[#d7ddda]"} ${dismissed ? "opacity-70" : ""}`}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className={`${compact ? "text-[15px]" : "text-xl"} min-w-0 font-semibold leading-tight tracking-normal text-[#1c2526]`}>
            {block.title}
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            {!dismissed ? (
              <button
                type="button"
                onClick={() => togglePinned(block)}
                aria-label={pinnedState ? "取消钉住" : "钉住待看"}
                title={pinnedState ? "取消钉住" : "钉住待看"}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm ${
                  pinnedState ? "border-[#d9bdc4] bg-[#fff8fa] text-[#8b4b5a]" : "border-[#d7ddda] bg-white text-[#62706e]"
                }`}
              >
                <Star className={`h-4 w-4 ${pinnedState ? "fill-current" : ""}`} />
              </button>
            ) : null}
            <span className="whitespace-nowrap rounded-full border border-[#cfe2dd] bg-[#e9f2ef] px-2.5 py-1 text-xs text-[#2f6f66]">
              {block.sourceStatus || kindLabel[block.kind]}
            </span>
          </div>
        </div>

        <div className="mb-3 text-[13px] text-[#62706e]">{block.source}</div>
        {block.sourceWarning ? (
          <div className="mb-3 inline-flex rounded-lg border border-[#ead7a4] bg-[#fff7df] px-2 py-1 text-xs text-[#7a5b16]">
            {block.sourceWarning}
          </div>
        ) : null}

        {compact ? (
          <p className="m-0 text-sm leading-6 text-[#62706e]">{block.summary}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["它讲什么", block.summary],
              ["为什么重要", block.why],
              ["我该怎么想", block.thought],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 border-l-[3px] border-[#d7ddda] pl-3">
                <strong className="mb-1 block text-xs font-semibold text-[#62706e]">{label}</strong>
                <p className="m-0 text-sm leading-6 text-[#1c2526]">{value}</p>
              </div>
            ))}
          </div>
        )}

        {block.links?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {block.links.map((link) => (
              <a
                key={`${key}:${link.url}`}
                href={link.url}
                target={linkIsObsidian(link.url) ? undefined : "_blank"}
                rel={linkIsObsidian(link.url) ? undefined : "noreferrer"}
                className="inline-flex items-center gap-1.5 border-b border-[rgba(47,111,102,.35)] text-sm font-semibold text-[#2f6f66]"
              >
                {link.label}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {dismissed ? (
            <button
              type="button"
              onClick={() => restoreBlock(block)}
              className="inline-flex min-h-[38px] items-center rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm text-[#1c2526]"
            >
              恢复
            </button>
          ) : (
            <button
              type="button"
              onClick={() => dismissBlock(block)}
              className="inline-flex min-h-[38px] items-center rounded-lg border border-[#2f6f66] bg-[#2f6f66] px-3 py-2 text-sm text-white"
            >
              丢弃
            </button>
          )}
          <button
            type="button"
            onClick={() => copyBlock(block)}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm text-[#1c2526]"
          >
            {copiedId === key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            复制给 Codex 讨论
          </button>
        </div>
      </article>
    )
  }

  return (
    <main className="min-h-screen bg-[#f6f4ee] text-[#1c2526]">
      <div className="mx-auto w-[min(1120px,calc(100vw-32px))] py-7 sm:py-8">
        <header className="mb-5 grid items-end gap-4 border-b border-[#d7ddda] pb-4 md:grid-cols-[1fr_auto]">
          <div>
            <h1 className="m-0 mb-2 text-[clamp(30px,5vw,56px)] font-semibold leading-none tracking-normal">AI 信息流</h1>
            <div className="text-sm text-[#62706e]">
              {feed ? `生成于 ${feed.generatedAt || feed.date} · 每次同步后线上更新 · 来源 本地数据` : "正在读取 feed..."}
            </div>
            <div className="mt-1 max-w-3xl text-[13px] leading-5 text-[#62706e]">{feed?.sourceStatusLine}</div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <span className="inline-flex min-h-[38px] items-center rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm text-[#62706e]">
              Admin only
            </span>
            <button
              type="button"
              onClick={() => setShowDiscarded((value) => !value)}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm text-[#1c2526]"
            >
              <EyeOff className="h-4 w-4" />
              {showDiscarded ? "隐藏已丢弃" : "查看已丢弃"}
            </button>
            <button
              type="button"
              onClick={clearRoundDismissed}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm text-[#1c2526]"
            >
              <RotateCcw className="h-4 w-4" />
              清空本轮丢弃
            </button>
          </div>
        </header>

        {authNeeded ? (
          <div className="mb-4 rounded-lg border border-[#d7ddda] bg-white px-4 py-5 text-sm text-[#1c2526]">
            <div className="mb-2 font-semibold">需要登录后查看 AI 信息流。</div>
            <p className="mb-4 text-[#62706e]">这页现在通过 admin API 读取，不再暴露公开 JSON。</p>
            <Link href="/login" className="inline-flex min-h-[38px] items-center rounded-lg border border-[#2f6f66] bg-[#2f6f66] px-3 py-2 text-sm text-white">
              去登录
            </Link>
          </div>
        ) : null}
        {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-5">
            <section>
              <h2 className="mb-2 text-lg font-semibold tracking-normal">钉住待看</h2>
              <div className="grid gap-3">
                {pinnedBlocks.length ? pinnedBlocks.map((block) => renderBlock(block)) : <div className="text-[15px] text-[#62706e]">还没有钉住的块。遇到想看但没时间看的内容，可以点星标。</div>}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold tracking-normal">现在最值得看</h2>
              {topBlock ? renderBlock(topBlock) : <div className="text-[15px] text-[#62706e]">现在没有新的高优先级块。</div>}
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold tracking-normal">今日信息流</h2>
              <div className="grid gap-3">
                {feedBlocks.length ? feedBlocks.map((block) => renderBlock(block)) : <div className="text-[15px] text-[#62706e]">今日信息流已经被你接收得差不多了。</div>}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold tracking-normal">待处理</h2>
              <div className="grid gap-3">
                {actionBlocks.length ? actionBlocks.map((block) => renderBlock(block)) : <div className="text-[15px] text-[#62706e]">没有必须处理的行动项。</div>}
              </div>
            </section>

            {showDiscarded ? (
              <section className="border-t border-[#d7ddda] pt-5">
                <h2 className="mb-2 text-lg font-semibold tracking-normal">本轮已丢弃</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {dismissedBlocks.length ? dismissedBlocks.map((block) => renderBlock(block, true)) : <div className="text-[15px] text-[#62706e]">本轮已丢弃列表为空；跨轮丢弃仍会通过指纹池隐藏。</div>}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-5">
            <section className="rounded-lg border border-[#d7ddda] bg-white p-4 shadow-[0_14px_36px_rgba(41,50,48,0.10)]">
              <h2 className="mb-2 text-lg font-semibold tracking-normal">阅读状态</h2>
              <div className="text-sm text-[#62706e]">{handled} / {roundTotal} 个本轮已处理 · 剩余 {activeBlocks.length}</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5e1d7]">
                <div className="h-full bg-gradient-to-r from-[#2f6f66] to-[#8b4b5a] transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-4 border-t border-[#d7ddda] pt-3 text-[13px] leading-5 text-[#62706e]">
                <div className="mb-1 font-semibold">状态同步</div>
                <p className="m-0">
                  当前页会导入随 feed 同步来的共享状态快照，再用本浏览器状态继续记录新的丢弃/钉住。
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm text-[#1c2526]"
              >
                <RefreshCw className="h-4 w-4" />
                重新读取
              </button>
            </section>
          </aside>
        </div>
      </div>

      <div
        className={`fixed bottom-5 left-1/2 max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-lg bg-[#17211f] px-4 py-2 text-sm text-white transition-opacity ${
          toast ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {toast}
      </div>
    </main>
  )
}
