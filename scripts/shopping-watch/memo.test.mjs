import assert from "node:assert/strict"
import test from "node:test"
import { applyShoppingMemo, normalizeShoppingMemo, ShoppingMemoError } from "../../lib/shopping-memo.mjs"

const memo = { id: "example-memo", title: " Example item ", category: "Example category", budget: "under 20 EUR", details: "Measure before buying", url: "https://example.com/product", status: "wanted" }
const catalog = { schemaVersion: 1, items: [{ id: "existing-product", price: 30 }], campaigns: [{ id: "existing-sale" }], requirements: [{ category: "Existing category" }], memos: [] }
const earlier = "2026-11-03T00:00:00.000Z", later = "2026-11-03T00:01:00.000Z"

test("adding a memo preserves prices, campaigns and requirements without mutating the input", () => {
  const next = applyShoppingMemo(catalog, memo, undefined, earlier)
  assert.equal(next.memos[0].title, "Example item")
  assert.equal(next.memos[0].createdAt, earlier)
  assert.equal(next.items, catalog.items)
  assert.equal(next.campaigns, catalog.campaigns)
  assert.equal(next.requirements, catalog.requirements)
  assert.equal(catalog.memos.length, 0)
})
test("memo edits keep creation time and preserve unrelated memos", () => {
  const first = applyShoppingMemo(catalog, memo, undefined, earlier)
  first.memos.push({ ...first.memos[0], id: "unrelated" })
  const next = applyShoppingMemo(first, { ...memo, details: "Changed" }, earlier, later)
  assert.equal(next.memos[0].createdAt, earlier)
  assert.equal(next.memos[0].updatedAt, later)
  assert.equal(next.memos[1].id, "unrelated")
})
test("price-only catalog updates do not conflict with an unchanged memo", () => {
  const first = applyShoppingMemo(catalog, memo, undefined, earlier)
  first.updatedAt = later
  assert.equal(applyShoppingMemo(first, memo, earlier, later).memos.length, 1)
})
test("stale or missing expected memo revisions reject overwrites", () => {
  const first = applyShoppingMemo(catalog, memo, undefined, earlier)
  for (const expected of [undefined, later]) assert.throws(() => applyShoppingMemo(first, memo, expected, later), error => error instanceof ShoppingMemoError && error.status === 409)
  assert.throws(() => applyShoppingMemo(catalog, memo, earlier, later), error => error.status === 409)
})
test("archiving is reversible and does not erase the record", () => {
  const first = applyShoppingMemo(catalog, memo, undefined, earlier)
  const archived = applyShoppingMemo(first, { ...memo, status: "archived" }, earlier, later)
  assert.equal(archived.memos.length, 1)
  assert.equal(applyShoppingMemo(archived, memo, later, "2026-11-03T00:02:00.000Z").memos[0].status, "wanted")
})
test("memo input rejects unsafe links, unsupported statuses and oversized values", () => {
  for (const change of [{ url: "javascript:alert(1)" }, { url: "https://user:secret@example.com" }, { url: "http://example.com" }, { title: "" }, { title: "x".repeat(151) }, { budget: "x".repeat(101) }, { status: "unrecognized" }, { id: "bad/id" }]) {
    assert.throws(() => normalizeShoppingMemo({ ...memo, ...change }), ShoppingMemoError)
  }
})
test("memo capacity is bounded while edits remain possible", () => {
  const full = { ...catalog, memos: Array.from({ length: 500 }, (_, id) => ({ ...memo, id: `memo-${id}`, createdAt: earlier, updatedAt: earlier })) }
  assert.throws(() => applyShoppingMemo(full, memo, undefined, later), ShoppingMemoError)
  assert.equal(applyShoppingMemo(full, { ...memo, id: "memo-1" }, earlier, later).memos.length, 500)
})
