import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { fetchObservation } from "./parse-source.mjs"
import { createStorage } from "./storage.mjs"
import { campaignSourceHash } from "./campaign-source.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const args = process.argv.slice(2)
const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1] }
const envPath = option("--env") || resolve(root, ".env")
process.loadEnvFile(envPath)
const now = new Date().toISOString()
const storage = createStorage()
const noWrite = args.includes("--dry-run")
const seed = JSON.parse(await readFile(resolve(root, "data/shopping-watch/catalog.json"), "utf8"))

function validate(catalog) {
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.items) || !Array.isArray(catalog.campaigns)) throw new Error("Invalid catalog")
  const ids = new Set()
  for (const item of catalog.items) {
    if (!item.id || ids.has(item.id)) throw new Error("Missing or duplicate product ID")
    ids.add(item.id)
    if (item.currency !== "EUR" || (item.price !== null && (!Number.isFinite(item.price) || item.price <= 0))) throw new Error(`Invalid price/currency ${item.id}`)
    if (new URL(item.url).protocol !== "https:") throw new Error(`Invalid product URL ${item.id}`)
  }
}

// Only merchant-owned campaign URLs from the curated list may be checked.
const campaignHosts = new Set(["eu.sihoo.com", "www.hbada.eu", "hbada.eu", "www.masku.com", "www.ikea.com", "www.verkkokauppa.com", "www.prisma.fi", "www.helsinkioutlet.fi", "scandinavianoutdoor.fi", "www.haglofs.com", "www.norrona.com", "eu.patagonia.com", "arcteryx.com", "varuste.net", "www.varuste.net"])
async function campaignObservation(campaign) {
  if (!campaignHosts.has(new URL(campaign.url).hostname)) throw new Error("活动来源需人工复核")
  const signal = AbortSignal.timeout(10000)
  let currentUrl = new URL(campaign.url), response
  for (let redirects = 0; redirects <= 3; redirects++) {
    response = await fetch(currentUrl, { redirect: "manual", signal, headers: { "User-Agent": "PersonalShoppingWatch/1.0" } })
    if (![301, 302, 303, 307, 308].includes(response.status)) break
    await response.body?.cancel()
    if (redirects === 3) throw new Error("活动页面跳转过多，需复核")
    const location = response.headers.get("location")
    if (!location) throw new Error("活动跳转缺少目标地址")
    const next = new URL(location, currentUrl)
    if (next.protocol !== "https:" || next.username || next.password || next.hostname.replace(/^www\./, "") !== currentUrl.hostname.replace(/^www\./, "")) throw new Error("活动跳转至不同商家，需人工复核")
    currentUrl = next
  }
  if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}，未绕过访问限制`) }
  const reader = response.body.getReader(), chunks = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new Error("活动页面超过2MiB，需人工复核") }
      chunks.push(Buffer.from(value))
    }
  } finally { reader.releaseLock() }
  const html = Buffer.concat(chunks).toString("utf8")
  if (/<title[^>]*>[^<]*(captcha|access denied|just a moment)/i.test(html)) throw new Error("活动页面访问验证，未绕过")
  return campaignSourceHash(html)
}

try {
  const current = await storage.read()
  if (!current.catalog && !seed.items.length) throw new Error("Private catalog is not provisioned; refusing to write the empty public template")
  let catalog = current.catalog || seed
  validate(catalog)
  const exported = option("--export")
  if (exported) {
    await mkdir(dirname(resolve(exported)), { recursive: true }); await writeFile(resolve(exported), JSON.stringify(catalog, null, 2) + "\n")
    console.log(JSON.stringify({ exported: resolve(exported), items: catalog.items.length }));
  } else {
    const curation = option("--apply-curation")
    if (curation) {
      catalog = JSON.parse(await readFile(resolve(curation), "utf8")); validate(catalog)
      if (current.catalog?.updatedAt && catalog.updatedAt !== current.catalog.updatedAt) throw new Error("Catalog advanced; export current state and reconcile before applying curation")
      // Visibility is user-owned state. Curation can only change shopping evidence.
      if (current.catalog?.dismissals) catalog.dismissals = current.catalog.dismissals
      else delete catalog.dismissals
      catalog.curatedAt = now
    } else {
      const results = [], pending = [...catalog.items]
      // Three workers bound traffic and keep the whole run well below ten minutes.
      await Promise.all(Array.from({ length: 3 }, async () => {
        while (pending.length) {
          const item = pending.shift()
          if (item.monitor.kind === "manual") {
            item.observation = { status: "manual", attemptedAt: now }
            continue
          }
          if (item.observation?.retryAfter && Date.parse(item.observation.retryAfter) > Date.now()) continue
          try {
            const observation = await fetchObservation(item)
            if (item.price !== null && (observation.price < item.price * .4 || observation.price > item.price * 2.5)) throw new Error("价格变动超出自动采信范围，需复核型号、货币或规格")
            const changed = item.price !== observation.price
            if (changed) {
              item.history.push({ at: now, price: observation.price, source: item.monitor.endpoint || item.url })
              item.judgment = "wait"
              item.reason = `新观察价 ${observation.price.toFixed(2)} EUR；价格已变化，需结合到手价与规格重新判断。`
            }
            item.history = item.history.slice(-120)
            if (new URL(item.url).hostname.endsWith("ikea.com")) {
              observation.stockStatus = "unknown"
              observation.stockNote = "国家商品页可售标记；具体地址与门店库存待确认。"
            }
            Object.assign(item, observation, { checkedAt: now, priceVerifiedAt: now, sourceKind: item.monitor.kind === "shopify" ? "official_api" : "official_page", observation: { status: "ok", attemptedAt: now } })
            results.push({ id: item.id, ok: true, changed })
          } catch (error) {
            item.observation = { status: "error", attemptedAt: now, error: error instanceof Error ? error.message.slice(0, 240) : String(error) }
            if (/HTTP (403|429)|CAPTCHA|access challenge/i.test(item.observation.error)) item.observation.retryAfter = new Date(Date.now() + 6 * 3600000).toISOString()
            results.push({ id: item.id, ok: false, error: item.observation.error })
          }
        }
      }))
      const campaignChanges = []
      for (const campaign of catalog.campaigns) {
        try {
          const hash = await campaignObservation(campaign)
          const changed = Boolean(campaign.observation?.version === 2 && campaign.observation.hash !== hash)
          campaign.observation = { attemptedAt: now, status: "ok", hash, version: 2, changed: changed || Boolean(campaign.observation?.changed) }
          if (changed) campaignChanges.push(campaign.id)
        } catch (error) {
          campaign.observation = { ...campaign.observation, attemptedAt: now, status: "error", error: error instanceof Error ? error.message.slice(0, 200) : String(error) }
        }
      }
      catalog.run = { attempted: results.length, succeeded: results.filter(result => result.ok).length, failed: results.filter(result => !result.ok).length, changed: results.filter(result => result.changed).map(result => result.id), campaignChanges }
      catalog.lastAttemptAt = now
      if (catalog.run.succeeded) catalog.lastSuccessAt = now
    }
    catalog.updatedAt = now
    validate(catalog)
    if (!noWrite) {
      await storage.write(catalog, current.etag)
      const persisted = await storage.read()
      if (persisted.catalog?.updatedAt !== now) throw new Error("Storage readback did not match the completed update")
    }
    const summary = { at: now, dryRun: noWrite, persisted: !noWrite, items: catalog.items.length, ...catalog.run }
    await mkdir(resolve(root, "logs/shopping-watch"), { recursive: true })
    await mkdir(resolve(root, "outputs/shopping-watch"), { recursive: true })
    await appendFile(resolve(root, `logs/shopping-watch/${now.slice(0, 10)}.jsonl`), JSON.stringify(summary) + "\n")
    await writeFile(resolve(root, "outputs/shopping-watch/latest-catalog.json"), JSON.stringify(catalog, null, 2) + "\n")
    console.log(JSON.stringify(summary))
  }
} finally { storage.close() }
