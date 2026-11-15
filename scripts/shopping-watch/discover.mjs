import { createHash, randomUUID } from "node:crypto"
import { fetchMerchantText } from "./parse-source.mjs"

const decode = value => value.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => {
  const number = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code)
  return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : ""
}).replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&nbsp;", " ")
const attr = (tag, name) => decode(tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))?.slice(1).find(value => value !== undefined) || "")
const text = html => decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim()
const key = url => { const parsed = new URL(url); return parsed.hostname.replace(/^www\./, "") + ":" + (parsed.pathname.match(/\/(?:fi\/product\/|(?:en\/)?p)(\d+)/)?.[1] || parsed.pathname) }

export function parseDiscovery(html, source) {
  if (source.kind === "verkk_search") {
    const payload = JSON.parse(html)
    if (!Array.isArray(payload.data)) throw new Error("Discovery: product search schema changed")
    return payload.data.filter(row => row.type === "products").map(row => {
      const a = row.attributes
      if (!a?.active || typeof a.name !== "string" || !/^\/fi\/product\/\d+\//.test(a.href)) return null
      const price = a.price?.current
      return { title: a.name, url: new URL(a.href, "https://www.verkkokauppa.com").href,
        listingPrice: source.currency === "EUR" && typeof price === "number" && price > 0 && price <= 100000 ? price : null }
    }).filter(Boolean)
  }
  if (source.kind !== "varuste_listing") throw new Error("Discovery: unsupported source")
  const result = []
  for (const [, tag, body] of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(tag, "href")
    if (!/^\/(?:en\/)?p\d+\//.test(href)) continue
    const title = attr(tag, "aria-label") || text(body).slice(0, 180)
    if (!title) continue
    const plain = text(body)
    const quoted = plain.match(/Outlet-hinta\s+(\d+(?:[.,]\d{2}))\s*€/)?.[1]
    result.push({ title, url: new URL(href, "https://varuste.net").href,
      listingPrice: quoted ? Number(quoted.replace(",", ".")) : null })
  }
  return result
}

export async function discoverProducts(catalog, { fetchSource = fetchMerchantText, at = new Date().toISOString(), maxSources = 2 } = {}) {
  const sources = catalog.discovery?.sources
  if (!Array.isArray(sources) || !sources.length) return { attempted: 0, succeeded: 0, failed: 0, leads: 0 }
  const now = Date.parse(at), state = catalog.discovery
  const blocked = catalog.sourceBackoffs ||= {}
  const known = new Set([...catalog.items, ...(catalog.retiredItems || [])].filter(i => i.url).map(i => key(i.url)))
  const excluded = [...(catalog.preferences?.excludedBrands || []), "patagonia", "suodatin", "pölypussi", "tarvike", "ramppisarja", "varaosa", "harjasetti", "integroitava"]
  const safe = lead => !excluded.some(word => lead.title.toLowerCase().includes(word.toLowerCase()))
  state.leads = (state.leads || []).filter(lead => now - Date.parse(lead.observedAt) < 7 * 86400000 && !known.has(key(lead.url)) && safe(lead))
  const due = sources.filter(s => !s.disabled && now - (Date.parse(s.observation?.attemptedAt) || 0) >= (s.intervalHours || 6) * 3600000)
    .sort((a, b) => (Date.parse(a.observation?.attemptedAt) || 0) - (Date.parse(b.observation?.attemptedAt) || 0))
  const summary = { attempted: 0, succeeded: 0, failed: 0, leads: 0 }
  for (const source of due) {
    if (summary.attempted >= maxSources) break
    if (!catalog.preferences?.activeCategories?.includes(source.category)) continue
    const sourceHost = new URL(source.url).hostname
    if (Date.parse(blocked[sourceHost]?.retryAfter) > now || Date.parse(source.observation?.retryAfter) > now) continue
    summary.attempted++
    try {
      let endpoint = source.url
      if (source.kind === "verkk_search") {
        const url = new URL("https://search.service.verkkokauppa.com/fi/api/v1/product-search")
        url.search = new URLSearchParams({ "filter[q]": source.query, "page[size]": "24", "page[number]": "1", private: "true", sessionId: randomUUID() }).toString()
        endpoint = url.href
      }
      const html = await fetchSource(source.url, endpoint, source.kind === "verkk_search")
      const found = parseDiscovery(html, source).filter(lead => safe(lead) && !known.has(key(lead.url))
        && (!source.includeAny?.length || source.includeAny.some(word => lead.title.toLowerCase().includes(word.toLowerCase())))
        && (!source.maxPrice || lead.listingPrice === null || lead.listingPrice <= source.maxPrice))
      const unique = [...new Map(found.map(lead => [key(lead.url), lead])).values()]
      const inRange = lead => source.preferredMin && lead.listingPrice >= source.preferredMin ? 1 : 0
      unique.sort((a, b) => inRange(b) - inRange(a))
      const selected = unique.slice(0, 6).map(lead => ({ ...lead,
        id: createHash("sha256").update(lead.url).digest("hex").slice(0, 16), merchant: source.merchant,
        category: source.category, sourceId: source.id, observedAt: at, shipping: null,
        note: "商家列表线索；库存、精确规格、品相及芬兰到手价待核实，不代表已推荐购买。" }))
      state.leads = state.leads.filter(lead => lead.sourceId !== source.id).concat(selected).slice(-60)
      source.observation = { status: "ok", attemptedAt: at, found: unique.length, retained: selected.length }
      summary.succeeded++; summary.leads += selected.length
    } catch (error) {
      source.observation = { status: "error", attemptedAt: at, error: error instanceof Error ? error.message.slice(0, 200) : String(error) }
      if (/HTTP (403|429)|CAPTCHA|access challenge/i.test(source.observation.error)) {
        source.observation.retryAfter = new Date(now + 6 * 3600000).toISOString()
        blocked[sourceHost] = { retryAfter: source.observation.retryAfter, reason: source.observation.error }
        if (source.kind === "verkk_search") blocked["search.service.verkkokauppa.com"] = blocked[sourceHost]
      }
      summary.failed++
    }
  }
  state.lastAttemptAt = summary.attempted ? at : state.lastAttemptAt
  return summary
}
