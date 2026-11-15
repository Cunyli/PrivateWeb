import assert from "node:assert/strict"
import test from "node:test"
import { collectItems } from "./collect.mjs"

const at = "2026-11-16T10:00:00.000Z"
const makeItem = (id = "a") => ({ id, category: "衣服", brand: "Norrøna", url: `https://www.helsinkioutlet.fi/${id}`,
  price: 329, shipping: 0, low30: 300, low30VerifiedAt: "2026-11-10T10:00:00Z", priceVerifiedAt: "2026-11-10T10:00:00Z",
  monitor: { kind: "sylius" }, history: [], judgment: "consider" })
const makeCatalog = items => ({ items, preferences: { activeCategories: ["衣服"], excludedBrands: ["Patagonia"] }, memos: [{ title: "mine" }], dismissals: { a: { hidden: true } } })

test("manual skip preserves actual observation and retry time", async () => {
  const item = makeItem(); item.monitor.kind = "manual"
  item.observation = { status: "error", retryAfter: "2026-11-17T10:00:00Z" }
  const before = structuredClone(item)
  await collectItems(makeCatalog([item]), { at, fetchSource: () => assert.fail("must not fetch") })
  assert.deepEqual(item, before)
})
test("newly enabled source retains backoff; a 429 blocks other URLs on same merchant", async () => {
  let count = 0
  const catalog = makeCatalog([makeItem("a"), makeItem("b")])
  await collectItems(catalog, { at, fetchSource: async () => { count++; throw new Error("Source HTTP 429") } })
  assert.equal(count, 1)
  assert.equal(catalog.items[0].priceVerifiedAt, "2026-11-10T10:00:00Z")
  assert.equal(catalog.items[0].price, 329)
  assert.equal(catalog.items[0].observation.retryAfter, "2026-11-16T16:00:00.000Z")
  await collectItems(catalog, { at, fetchSource: () => assert.fail("must respect backoff") })
})
test("price change invalidates endorsement and freight while keeping history and user state", async () => {
  const catalog = makeCatalog([makeItem()]), preserved = structuredClone({ memos: catalog.memos, dismissals: catalog.dismissals })
  await collectItems(catalog, { at, fetchSource: async () => ({ price: 299, stockStatus: "in_stock" }) })
  const item = catalog.items[0]
  assert.equal(item.price, 299); assert.equal(item.shipping, null); assert.equal(item.judgment, "wait")
  assert.equal(item.low30VerifiedAt, "2026-11-10T10:00:00Z")
  assert.deepEqual({ memos: catalog.memos, dismissals: catalog.dismissals }, preserved)
  assert.equal(item.history.length, 1)
})
test("cadence, excluded brand and inactive category do not fetch", async () => {
  const fresh = makeItem("a"); fresh.priceVerifiedAt = at; fresh.monitor.intervalMinutes = 60
  const excluded = makeItem("b"); excluded.brand = "Patagonia"
  const unrelated = makeItem("c"); unrelated.category = "家具"
  await collectItems(makeCatalog([fresh, excluded, unrelated]), { at, fetchSource: () => assert.fail("must skip") })
})
