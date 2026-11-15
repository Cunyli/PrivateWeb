import { fetchObservation } from "./parse-source.mjs"

const future = (value, now) => Number.isFinite(Date.parse(value)) && Date.parse(value) > now
const host = item => new URL(item.monitor?.endpoint || item.url).hostname

/** Mutates shopping evidence only; user memos, dismissals and retired items are untouched. */
export async function collectItems(catalog, { fetchSource = fetchObservation, at = new Date().toISOString() } = {}) {
  const now = Date.parse(at), results = []
  const allowed = catalog.preferences?.activeCategories
  const excluded = (catalog.preferences?.excludedBrands || []).map(brand => brand.toLowerCase())
  const backoffs = catalog.sourceBackoffs ||= {}
  // Import existing endpoint failures before enabling newly scripted sources.
  for (const item of catalog.items) {
    if (future(item.observation?.retryAfter, now) && (!backoffs[host(item)] || Date.parse(backoffs[host(item)].retryAfter) < Date.parse(item.observation.retryAfter))) {
      backoffs[host(item)] = { retryAfter: item.observation.retryAfter, reason: "existing merchant access restriction" }
    }
  }
  // Sequential requests avoid simultaneous hits on the same merchant.
  for (const item of catalog.items) {
    if (Array.isArray(allowed) && !allowed.includes(item.category)) continue
    if (excluded.includes(String(item.brand || "").toLowerCase()) || ["bought", "archived"].includes(item.status)) continue
    if (!item.monitor?.kind || item.monitor.kind === "manual") continue
    if (future(item.observation?.retryAfter, now) || future(backoffs[host(item)]?.retryAfter, now)) continue
    const lastAttempt = Date.parse(item.observation?.attemptedAt || item.priceVerifiedAt)
    const minutes = item.monitor.intervalMinutes || 10
    if (Number.isFinite(lastAttempt) && now - lastAttempt < minutes * 60000) continue
    try {
      const observation = await fetchSource(item)
      if (item.price !== null && (observation.price < item.price * .4 || observation.price > item.price * 2.5)) throw new Error("价格变动超出自动采信范围，需复核型号、货币或规格")
      const changed = item.price !== observation.price
      if (changed) {
        item.history ||= []
        item.history.push({ at, price: observation.price, source: item.monitor.endpoint || item.url })
        item.judgment = "wait"
        item.reason = `新观察价 ${observation.price.toFixed(2)} EUR；价格已变化，需结合到手价与规格重新判断。`
        if (item.shipping !== null) {
          item.shipping = null
          item.shippingNote = "商品价格已变化，先前运费条件需重新核实；不自动沿用免运门槛。"
        }
      }
      if (observation.stockStatus !== "in_stock") item.judgment = "wait"
      if (item.history) item.history = item.history.slice(-120)
      if (new URL(item.url).hostname.endsWith("ikea.com")) {
        observation.stockStatus = "unknown"
        observation.stockNote = "国家商品页可售标记；具体地址与门店库存待确认。"
      }
      Object.assign(item, observation, { checkedAt: at, priceVerifiedAt: at,
        sourceKind: item.monitor.kind === "shopify" ? "official_api" : "official_page",
        observation: { status: "ok", attemptedAt: at } })
      results.push({ id: item.id, ok: true, changed })
    } catch (error) {
      item.observation = { status: "error", attemptedAt: at, error: error instanceof Error ? error.message.slice(0, 240) : String(error) }
      item.judgment = "wait"
      if (/HTTP (403|429)|CAPTCHA|access challenge/i.test(item.observation.error)) {
        item.observation.retryAfter = new Date(now + 6 * 3600000).toISOString()
        backoffs[host(item)] = { retryAfter: item.observation.retryAfter, reason: item.observation.error }
      }
      results.push({ id: item.id, ok: false, error: item.observation.error })
    }
  }
  return results
}
