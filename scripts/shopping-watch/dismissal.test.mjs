import assert from "node:assert/strict"
import test from "node:test"
import { applyShoppingDismissal, isShoppingItemDismissed, shoppingDismissalQuote, ShoppingDismissalError } from "../../lib/shopping-dismissal.mjs"
import { applyShoppingMemo } from "../../lib/shopping-memo.mjs"

const before = "2026-11-05T18:00:00.000Z", at = "2026-11-05T19:00:00.000Z", after = "2026-11-05T20:00:00.000Z"
const now = Date.parse(after)
const item = { id: "example-product", price: 100, shipping: 10, currency: "EUR", priceVerifiedAt: before, observation: { status: "ok" } }
const catalog = { items: [item], campaigns: [{ id: "example-campaign" }], memos: [{ id: "example-memo", status: "bought" }], requirements: [] }
const request = (action = "dismiss", expectedDismissedAt = null) => ({ itemId: item.id, action, expectedDismissedAt, expectedQuote: shoppingDismissalQuote(item) })
const first = applyShoppingDismissal(catalog, request(), at)
const dismissal = first.dismissals[0]
const checked = change => ({ ...item, priceVerifiedAt: after, ...change })

test("dismissal keeps trusted price basis and all other personal data intact", () => {
  assert.deepEqual(dismissal, { itemId: item.id, quote: { amount: 11000, currency: "EUR", basis: "delivered" }, dismissedAt: at })
  for (const key of ["items", "campaigns", "memos", "requirements"]) assert.equal(first[key], catalog[key])
  assert.equal(catalog.dismissals, undefined)
})
test("same price, a higher price and an old lower quote stay hidden", () => {
  assert.equal(isShoppingItemDismissed(item, dismissal, now), true)
  for (const price of [100, 110]) assert.equal(isShoppingItemDismissed(checked({ price }), dismissal, now), true)
  assert.equal(isShoppingItemDismissed({ ...item, price: 90 }, dismissal, now), true)
})
test("only a freshly verified lower delivered amount resurfaces", () => {
  assert.equal(isShoppingItemDismissed(checked({ price: 99 }), dismissal, now), false)
  assert.equal(isShoppingItemDismissed(checked({ price: 90, shipping: 20 }), dismissal, now), true)
  assert.equal(isShoppingItemDismissed(checked({ price: 90, shipping: 21 }), dismissal, now), true)
  assert.equal(isShoppingItemDismissed(checked({ price: 100, shipping: 9 }), dismissal, now), false)
  assert.equal(isShoppingItemDismissed(checked({ price: 90, shipping: null }), dismissal, now), true)
})
test("errors, stale and future observations, expired offers and missing prices cannot resurface", () => {
  const lower = checked({ price: 90 })
  for (const change of [{ observation: { status: "error" } }, { price: null }, { price: 0 }, { priceVerifiedAt: null }, { priceVerifiedAt: "bad" }, { priceVerifiedAt: "2026-11-06T20:00:00Z" }, { saleEndsAt: before }]) {
    assert.equal(isShoppingItemDismissed({ ...lower, ...change }, dismissal, now), true)
  }
  assert.equal(isShoppingItemDismissed(lower, dismissal, now + 86400001), true)
})
test("unknown freight stays separate and uses only the item-price basis", () => {
  const unpricedShipping = { ...item, shipping: null }
  const next = applyShoppingDismissal({ items: [unpricedShipping] }, { ...request(), expectedQuote: shoppingDismissalQuote(unpricedShipping) }, at)
  assert.deepEqual(next.dismissals[0].quote, { amount: 10000, currency: "EUR", basis: "item" })
  assert.equal(isShoppingItemDismissed(checked({ price: 99, shipping: null }), next.dismissals[0], now), false)
  assert.equal(isShoppingItemDismissed(checked({ price: 100, shipping: 0 }), next.dismissals[0], now), true)
})
test("foreign quotes compare only within their own currency", () => {
  const foreign = { ...item, price: null, shipping: null, foreignQuote: { amount: 500, currency: "CNY", checkedAt: before } }
  const record = applyShoppingDismissal({ items: [foreign] }, { ...request(), expectedQuote: shoppingDismissalQuote(foreign) }, at).dismissals[0]
  assert.equal(record.quote.currency, "CNY")
  assert.equal(isShoppingItemDismissed({ ...foreign, foreignQuote: { amount: 450, currency: "CNY", checkedAt: after } }, record, now), false)
  assert.equal(isShoppingItemDismissed({ ...foreign, foreignQuote: { amount: 50, currency: "EUR", checkedAt: after } }, record, now), true)
  assert.equal(isShoppingItemDismissed(checked({ price: 50 }), record, now), true)
})
test("no known baseline stays hidden until the user restores it", () => {
  const unknown = { ...item, price: null }
  const record = applyShoppingDismissal({ items: [unknown] }, { ...request(), expectedQuote: null }, at).dismissals[0]
  assert.equal(isShoppingItemDismissed(checked({ price: 10 }), record, now), true)
  assert.equal(isShoppingItemDismissed(item, undefined, now), false)
})
test("restore and redismiss use the last dismissal revision", () => {
  assert.equal(applyShoppingDismissal(first, request("restore", at), after).dismissals.length, 0)
  assert.throws(() => applyShoppingDismissal(first, request(), after), error => error.status === 409)
  assert.throws(() => applyShoppingDismissal(first, request("restore"), after), error => error.status === 409)
  const lower = checked({ price: 90 })
  const again = applyShoppingDismissal({ ...first, items: [lower] }, { ...request("dismiss", at), expectedQuote: shoppingDismissalQuote(lower) }, after)
  assert.equal(again.dismissals[0].quote.amount, 10000)
  assert.equal(again.dismissals[0].dismissedAt, after)
})
test("concurrent price changes and forged baselines are rejected", () => {
  for (const quote of [null, undefined, { amount: 1, currency: "EUR", basis: "delivered" }]) assert.throws(() => applyShoppingDismissal(catalog, { ...request(), expectedQuote: quote }, at), error => error.status === 409)
  assert.throws(() => applyShoppingDismissal({ ...catalog, items: [checked({ price: 90 })] }, request(), at), error => error.status === 409)
  for (const input of [null, [], {}, { ...request(), action: "delete" }, { ...request(), itemId: "x".repeat(201) }]) assert.throws(() => applyShoppingDismissal(catalog, input, at), ShoppingDismissalError)
})
test("other-device memos and unrelated dismissals survive edits and restoration", () => {
  const other = { itemId: "another-product", quote: null, dismissedAt: before }
  const current = { ...first, dismissals: [...first.dismissals, other] }
  const withMemo = applyShoppingMemo(current, { id: "new-memo", title: "Another item", category: "Example", budget: "", details: "", url: "", status: "wanted" }, undefined, after)
  const restored = applyShoppingDismissal(withMemo, request("restore", at), after)
  assert.deepEqual(restored.dismissals, [other])
  assert.equal(restored.memos.find(entry => entry.id === "example-memo").status, "bought")
  assert.equal(restored.memos.find(entry => entry.id === "new-memo").status, "wanted")
})
test("cent rounding does not manufacture a price reduction", () => {
  assert.equal(isShoppingItemDismissed(checked({ price: 99.999999999 }), dismissal, now), true)
})
