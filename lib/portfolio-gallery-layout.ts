import dimensions from "./portfolio-cover-dimensions.json"
import type { PictureSet } from "./pictureSet.types"

type GalleryItem = Pick<PictureSet, "id" | "cover_image_url">
type CoverDimensions = { src: string; width: number; height: number }
const measuredCovers: Record<string, CoverDimensions> = dimensions

const coverKey = (src: string) => new URL(src, "https://portfolio.local").pathname
  .replace(/\/(?:original\.[^/]+|w\d+\.webp)$/, "")

export function galleryCoverRatio(item: GalleryItem, observedRatios: Record<string, number> = {}): number {
  const observed = observedRatios[item.cover_image_url]
  if (Number.isFinite(observed) && observed > 0) return observed
  const measured = measuredCovers[item.id]
  // Match the cover path as well as the set id, so changing a cover cannot reuse stale dimensions.
  if (measured && measured.src === coverKey(item.cover_image_url) && measured.width > 0 && measured.height > 0) {
    return measured.width / measured.height
  }
  return 3 / 2
}

// Neighbouring photos float in pairs: one gap within a pair, two gap units between pairs.
const spacingUnits = (count: number) => count < 2 ? 0 : Math.floor(count / 2) + 2 * Math.floor((count - 1) / 2)
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

export function balancedGalleryColumns<T extends GalleryItem>(items: T[], count: number, width: number, columnGap: number, observedRatios: Record<string, number> = {}) {
  const columnCount = Math.max(1, Math.floor(count))
  const columnWidth = Math.max(1, (width - columnGap * (columnCount - 1)) / columnCount)
  const preferredGap = columnWidth < 200 ? 20 : 24
  const minimumGap = columnWidth < 200 ? 14 : 16
  const maximumGap = columnWidth < 200 ? 32 : 36
  const offsets = [0, 12, 5, 18]
  const columns = Array.from({length: columnCount}, (_, index) => ({
    items: [] as Array<{item: T; order: number}>,
    capacity: Math.floor(items.length / columnCount) + (index < items.length % columnCount ? 1 : 0),
    imageHeight: 0,
    offset: offsets[index % offsets.length],
  }))
  // Place tall covers first, then retain the original order within each column.
  const ordered = items.map((item, order) => ({item, order, height: columnWidth / galleryCoverRatio(item, observedRatios)}))
    .sort((left, right) => right.height - left.height || left.order - right.order)
  for (const entry of ordered) {
    const available = columns.filter(column => column.items.length < column.capacity)
    available.sort((left, right) =>
      (left.imageHeight + spacingUnits(left.items.length) * preferredGap) -
      (right.imageHeight + spacingUnits(right.items.length) * preferredGap) || left.capacity - right.capacity)
    const column = available[0]
    column.items.push(entry)
    column.imageHeight += entry.height
  }
  const occupied = columns.filter(column => column.items.length)
  const low = Math.max(0, ...occupied.map(column => column.imageHeight + column.offset + spacingUnits(column.items.length) * minimumGap))
  const high = Math.min(Infinity, ...occupied.map(column => column.imageHeight + column.offset + spacingUnits(column.items.length) * maximumGap))
  const preferredHeight = occupied.reduce((sum, column) => sum + column.imageHeight + column.offset + spacingUnits(column.items.length) * preferredGap, 0) / Math.max(1, occupied.length)
  const target = low <= high ? clamp(preferredHeight, low, high) : (low + high) / 2
  return columns.map(column => {
    const units = spacingUnits(column.items.length)
    const gap = units ? clamp((target - column.imageHeight - column.offset) / units, minimumGap, maximumGap) : preferredGap
    return {
      items: column.items.sort((left, right) => left.order - right.order).map(entry => entry.item),
      innerGap: gap,
      groupGap: gap * 2,
      offset: column.offset,
      height: column.imageHeight + column.offset + units * gap,
    }
  })
}
