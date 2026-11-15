import assert from "node:assert/strict"
import test from "node:test"
import { discoverProducts, parseDiscovery } from "./discover.mjs"

const at = "2026-11-16T11:00:00Z"
const source = { id: "shop", merchant: "Varuste", category: "衣服", kind: "varuste_listing", url: "https://varuste.net/c1/shells", maxPrice: 500 }
const page = `<a href="/p123/jacket?_omin%5B%5D=m" aria-label="Example Jacket, M"><span>Outlet-hinta 299,90&nbsp;€</span></a>
  <a href="https://malicious.example/p1/unsafe">unsafe</a><a href="/p456/patagonia" aria-label="Patagonia Jacket">Outlet-hinta 100,00 €</a>`
test("listing parser retains exact URL options and labels the price separately", () => {
  const found = parseDiscovery(page, source)
  assert.equal(found[0].listingPrice, 299.9)
  assert.match(found[0].url, /_omin/)
  assert.equal(found.length, 2)
})
test("discovery never reintroduces known/hidden items or excluded brands", async () => {
  const item = { id: "hidden", url: "https://varuste.net/en/p123/jacket" }
  const catalog = { items: [item], retiredItems: [], preferences: { activeCategories: ["衣服"], excludedBrands: ["Patagonia"] }, dismissals: [{ itemId: "hidden" }], discovery: { sources: [structuredClone(source)], leads: [] } }
  const before = structuredClone(catalog.items)
  const summary = await discoverProducts(catalog, { at, fetchSource: async () => page })
  assert.equal(summary.leads, 0); assert.deepEqual(catalog.items, before)
  assert.equal(catalog.dismissals.length, 1)
})
test("discovery respects merchant backoff and keeps old evidence after a failed request", async () => {
  const catalog = { items: [], preferences: { activeCategories: ["衣服"] }, discovery: { sources: [structuredClone(source)], leads: [] } }
  await discoverProducts(catalog, { at, fetchSource: async () => { throw new Error("Source HTTP 429") } })
  assert.equal(catalog.discovery.sources[0].observation.retryAfter, "2026-11-16T17:00:00.000Z")
  await discoverProducts(catalog, { at: "2026-11-16T12:00:00Z", fetchSource: () => assert.fail("must not retry") })
})
test("Verkkokauppa search ignores inactive or non-product resources", () => {
  const json = { data: [{ type: "products", attributes: { active: true, name: "Robot", href: "/fi/product/42/Robot", price: { current: 349 } } }, { type: "facets", attributes: {} }] }
  const found = parseDiscovery(JSON.stringify(json), { kind: "verkk_search", currency: "EUR" })
  assert.equal(found[0].listingPrice, 349); assert.equal(found.length, 1)
})
test("discovery limits feed requests and preserves legacy history", async () => {
  const catalog = { items: [], preferences: { activeCategories: ["衣服"] }, discovery: { date: "2026-11-12", addedIds: ["old"], sources: [1, 2, 3].map(id => ({ ...source, id: String(id) })), leads: [] } }
  const result = await discoverProducts(catalog, { at, fetchSource: async () => page })
  assert.equal(result.attempted, 2)
  assert.equal(catalog.discovery.date, "2026-11-12")
  assert.deepEqual(catalog.discovery.addedIds, ["old"])
})
