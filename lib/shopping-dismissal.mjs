export class ShoppingDismissalError extends Error {
  constructor(message, status = 400) { super(message); this.name = "ShoppingDismissalError"; this.status = status }
}

const validAmount = value => Number.isFinite(value) && value > 0
const cents = value => Math.round(value * 100)

// Unknown freight is never treated as zero. Keep the comparison basis and currency.
export function shoppingDismissalQuote(item, basis) {
  if (basis === "foreign" || (!basis && !validAmount(item.price))) {
    const quote = item.foreignQuote
    return quote && validAmount(quote.amount) && typeof quote.currency === "string"
      ? { amount: cents(quote.amount), currency: quote.currency, basis: "foreign" } : null
  }
  if (!validAmount(item.price) || item.currency !== "EUR") return null
  const delivered = basis === "delivered" || (!basis && Number.isFinite(item.shipping) && item.shipping >= 0)
  if (delivered && (!Number.isFinite(item.shipping) || item.shipping < 0)) return null
  return { amount: cents(item.price) + (delivered ? cents(item.shipping) : 0), currency: "EUR", basis: delivered ? "delivered" : "item" }
}

function sameQuote(a, b) {
  return a === null ? b === null : Boolean(b && a.amount === b.amount && a.currency === b.currency && a.basis === b.basis)
}

export function isShoppingItemDismissed(item, dismissal, now = Date.now()) {
  if (!dismissal) return false
  const baseline = dismissal.quote
  if (!baseline || item.observation?.status === "error") return true
  const checkedAt = Date.parse(baseline.basis === "foreign" ? item.foreignQuote?.checkedAt : item.priceVerifiedAt)
  const dismissedAt = Date.parse(dismissal.dismissedAt)
  // Failed, old or unpriced observations cannot bring a dismissed candidate back.
  if (!Number.isFinite(checkedAt) || !Number.isFinite(dismissedAt) || checkedAt <= dismissedAt || now - checkedAt > 86400000 || checkedAt > now + 60000) return true
  if (item.saleEndsAt && Date.parse(item.saleEndsAt) < now) return true
  const current = shoppingDismissalQuote(item, baseline.basis)
  return !current || current.currency !== baseline.currency || current.amount >= baseline.amount
}

export function applyShoppingDismissal(catalog, input, now) {
  if (!input || typeof input !== "object" || Array.isArray(input) || typeof input.itemId !== "string" || input.itemId.length > 200 || !["dismiss", "restore"].includes(input.action)) {
    throw new ShoppingDismissalError("隐藏操作格式不正确。")
  }
  const item = catalog.items.find(candidate => candidate.id === input.itemId)
  if (!item) throw new ShoppingDismissalError("商品已变化，请读取最新清单。", 409)
  const existing = catalog.dismissals || []
  if (!Array.isArray(existing)) throw new Error("Invalid dismissal storage")
  const previous = existing.find(entry => entry.itemId === item.id)
  if (input.expectedDismissedAt !== (previous?.dismissedAt ?? null)) throw new ShoppingDismissalError("其他设备已修改隐藏状态，请读取最新清单后重试。", 409)
  const rest = existing.filter(entry => entry.itemId !== item.id)
  if (input.action === "restore") return { ...catalog, updatedAt: now, dismissals: rest }
  const quote = shoppingDismissalQuote(item)
  if (!sameQuote(quote, input.expectedQuote)) throw new ShoppingDismissalError("商品报价刚刚变化，请读取最新价格后再隐藏。", 409)
  if (!previous && existing.length >= 2000) throw new ShoppingDismissalError("隐藏记录已满，请先恢复部分商品。")
  return { ...catalog, updatedAt: now, dismissals: [...rest, { itemId: item.id, quote, dismissedAt: now }] }
}
