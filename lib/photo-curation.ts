import { curationStaticBindings } from "./photo-curation-bindings"

export type CurationDecision = "keep" | "trash" | "restore"
export type CurationState = "unreviewed" | "keep" | "trash"

export type CurationPhoto = {
  id: number
  setId: number
  groupId: string
  groupTitle: string
  groupSubtitle: string
  title: string
  filename: string
  imageUrl: string
  previewUrl: string
  detailUrl: string
  published: boolean
  updatedAt: string | null
  reviewedAt: string | null
  state: CurationState
  order: number
  width?: number
  height?: number
}

export type CurationGroup = { id: string; title: string; subtitle: string; count: number }
export type CurationChange = {
  pictureId: number
  decision: CurationDecision
  expectedUpdatedAt: string | null
  expectedReviewedAt: string | null
  width?: number
  height?: number
}
export type CurationPortrait = { id: number; src: string; title: string; width: number | null; height: number | null }
export type CurationVisibility = { ids: number[]; keptPortraits: CurationPortrait[] }

// Match responsive versions and local preview exports to their original frame.
export function curationAssetKey(source: string): string {
  const decoded = source.replace(/%([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
  const dsc = decoded.match(/DSC\d+/i)?.[0]
  if (dsc) return dsc.toUpperCase()
  const name = decoded.split(/[?#]/)[0].split("/").filter(Boolean).pop() || ""
  return name.replace(/-(?:640|1280|1920)(?=\.)/g, "").replace(/\.[^.]+$/, "").toLowerCase()
}

export function curationAssetFamily(source: string): string {
  const path = source.replace(/^https?:\/\/[^/]+/i, "").split(/[?#]/)[0]
  if (path.includes("/picture/responsive/")) return path.replace(/\/(?:w\d+\.webp|original\.[^/]+)$/, "")
  return path.replace(/-(?:640|1280|1920|2560)(?=\.)/g, "").replace(/\.[^/.]+$/, "")
}
export function curationBoundId(source: string): number | undefined { return curationStaticBindings[curationAssetFamily(source)] }
export function curationVisible(state: CurationVisibility, photo: { id?: string | number; src?: string; sourceName?: string }) {
  const id = typeof photo.id === "number" ? photo.id : Number(String(photo.id || "").replace(/^portrait-/, ""))
  if (Number.isSafeInteger(id) && id !== 0) return !state.ids.includes(id)
  const boundId = curationBoundId(photo.src || "")
  return boundId === undefined || !state.ids.includes(boundId)
}

export function parseCurationChanges(value: unknown): CurationChange[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { changes?: unknown }).changes)) throw new Error("请选择要处理的照片。")
  const rows = (value as { changes: unknown[] }).changes
  if (!rows.length || rows.length > 2000) throw new Error("每次可处理 1–2000 张照片。")
  const seen = new Set<number>()
  return rows.map(row => {
    if (!row || typeof row !== "object") throw new Error("选片数据不完整，请刷新后重试。")
    const item = row as Record<string, unknown>
    if (typeof item.pictureId !== "number" || !Number.isSafeInteger(item.pictureId) || item.pictureId === 0 || seen.has(item.pictureId)) throw new Error("照片编号无效或重复。")
    if (!["keep", "trash", "restore"].includes(String(item.decision))) throw new Error("不支持这个选片操作。")
    for (const key of ["expectedUpdatedAt", "expectedReviewedAt"]) {
      if (item[key] !== null && (typeof item[key] !== "string" || !/^\d{4}-\d\d-\d\dT/.test(String(item[key])) || !Number.isFinite(Date.parse(String(item[key]))))) throw new Error("照片版本信息不完整，请刷新后重试。")
    }
    if (item.width !== undefined || item.height !== undefined) {
      if (![item.width, item.height].every(value => typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 20000)) throw new Error("照片尺寸无效。")
    }
    seen.add(item.pictureId)
    return item as unknown as CurationChange
  })
}
