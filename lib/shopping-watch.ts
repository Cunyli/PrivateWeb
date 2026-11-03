export type ShoppingItem = {
  id: string
  category: string
  brand: string
  name: string
  variant: string
  url: string
  image?: string
  price: number | null
  currency: string
  shipping: number | null
  shippingNote: string
  stockNote: string
  stockStatus: "in_stock" | "out_of_stock" | "unknown" | "conflict" | "preorder"
  judgment: "consider" | "wait" | "skip"
  reason: string
  low30: number | null
  low30VerifiedAt?: string | null
  saleEndsAt: string | null
  checkedAt: string
  priceVerifiedAt: string | null
  sourceKind: string
  evidenceNote: string
  baseline: { price: number; at: string | null; note: string } | null
  monitor: { kind: string; variantId?: number; match?: string[]; endpoint?: string; currency?: string }
  history: { at: string; price: number; source: string }[]
  priority: number
  observation?: { status: "ok" | "error" | "manual"; attemptedAt: string; error?: string }
}

export type ShoppingCampaign = {
  linkedItemId?: string
  offerPrice?: number
  id: string
  brand: string
  title: string
  url: string
  status: "upcoming" | "active" | "ended" | "unknown"
  startsAt: string | null
  endsAt: string | null
  note: string
  checkedAt: string
  observation?: { attemptedAt: string; status: string; changed?: boolean; hash?: string; error?: string; version?: number }
}

export type ShoppingCatalog = {
  preferences?: {
    locationLabel?: string
    seasonLabel?: string
    headline?: string
    subtitle?: string
    priorityTitle?: string
    priorityLines?: string[]
    logisticsNote?: string
    tvTarget?: number
  }
  schemaVersion: number
  curatedAt: string
  timezone: string
  updatedAt?: string
  lastAttemptAt?: string
  lastSuccessAt?: string
  items: ShoppingItem[]
  campaigns: ShoppingCampaign[]
  requirements: { category: string; need: string; note: string }[]
  run?: { attempted: number; succeeded: number; failed: number; changed: string[]; campaignChanges?: string[] }
}

export function campaignStatus(campaign: ShoppingCampaign, now: number, items: ShoppingItem[] = []) {
  if (campaign.endsAt && Date.parse(campaign.endsAt) < now) return "ended"
  if (campaign.observation?.status === "error" || now - Date.parse(campaign.checkedAt) > 86400000) return "unknown"
  if (campaign.linkedItemId) {
    const linked = items.find(item => item.id === campaign.linkedItemId)
    if (!linked || linked.observation?.status === "error" || linked.price !== campaign.offerPrice) return "unknown"
  }
  if (campaign.startsAt && Date.parse(campaign.startsAt) > now) return "upcoming"
  // Passing a start date alone cannot establish that an advertised sale opened.
  if (campaign.status === "upcoming") return "unknown"
  if (campaign.observation?.changed) return "unknown"
  return campaign.status
}

export function itemJudgment(item: ShoppingItem, now: number) {
  if (item.observation?.status === "error") return "wait"
  if (["out_of_stock", "preorder", "conflict"].includes(item.stockStatus)) return "wait"
  if (!item.priceVerifiedAt || now - Date.parse(item.priceVerifiedAt) > 24 * 60 * 60 * 1000) return "wait"
  if (item.saleEndsAt && Date.parse(item.saleEndsAt) < now) return "wait"
  return item.judgment
}

export function verifiedSaving(item: ShoppingItem, now: number) {
  if (!item.low30VerifiedAt || now - Date.parse(item.low30VerifiedAt) > 24 * 60 * 60 * 1000) return null
  if (!item.priceVerifiedAt || now - Date.parse(item.priceVerifiedAt) > 24 * 60 * 60 * 1000) return null
  if (item.observation?.status === "error" || (item.saleEndsAt && Date.parse(item.saleEndsAt) < now)) return null
  return item.price !== null && item.low30 !== null && item.price < item.low30
    ? Math.round((1 - item.price / item.low30) * 100) : null
}
