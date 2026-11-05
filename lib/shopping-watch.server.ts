import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import seed from "@/data/shopping-watch/catalog.json"
import type { ShoppingCatalog } from "@/lib/shopping-watch"
import { decodeCatalog, encodeCatalog } from "@/lib/shopping-watch-crypto.mjs"
import { applyShoppingMemo, ShoppingMemoError } from "@/lib/shopping-memo.mjs"
import { applyShoppingDismissal, ShoppingDismissalError } from "@/lib/shopping-dismissal.mjs"

export const shoppingObjectKey = "shopping-watch/catalog-v1.json"

async function mutateShoppingCatalog(
  apply: (current: ShoppingCatalog, now: string) => ShoppingCatalog,
  verify: (persisted: ShoppingCatalog, next: ShoppingCatalog) => boolean,
  conflict: () => Error,
): Promise<ShoppingCatalog> {
  const { R2_ENDPOINT_URL, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
  if (!R2_ENDPOINT_URL || !R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error("Shopping storage is not configured")
  const client = new S3Client({ endpoint: R2_ENDPOINT_URL, region: "auto", forcePathStyle: true,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } })
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: shoppingObjectKey }))
    const current = decodeCatalog(JSON.parse(await object.Body!.transformToString()), R2_SECRET_ACCESS_KEY) as ShoppingCatalog
    if (current.schemaVersion !== 1 || !Array.isArray(current.items) || !object.ETag) throw new Error("Invalid shopping storage")
    const next = apply(current, new Date().toISOString())
    try {
      await client.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: shoppingObjectKey, IfMatch: object.ETag,
        Body: JSON.stringify(encodeCatalog(next, R2_SECRET_ACCESS_KEY)), ContentType: "application/json; charset=utf-8", CacheControl: "no-store" }))
    } catch (error) {
      if (error instanceof Error && error.name === "PreconditionFailed") throw conflict()
      throw error
    }
    const checked = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: shoppingObjectKey }))
    const persisted = decodeCatalog(JSON.parse(await checked.Body!.transformToString()), R2_SECRET_ACCESS_KEY) as ShoppingCatalog
    if (!verify(persisted, next)) throw new Error("Shopping write readback failed")
    return persisted
  } finally { client.destroy() }
}

export async function saveShoppingMemo(memo: unknown, expectedUpdatedAt?: unknown): Promise<ShoppingCatalog> {
  return mutateShoppingCatalog(
    (current, now) => applyShoppingMemo(current, memo, expectedUpdatedAt, now) as ShoppingCatalog,
    (persisted, next) => {
      const saved = persisted.memos?.find(item => item.id === (memo as { id: string }).id.trim())
      return Boolean(saved && Number.isFinite(Date.parse(saved.updatedAt)) && Date.parse(saved.updatedAt) >= Date.parse(next.updatedAt!))
    },
    () => new ShoppingMemoError("采购数据刚刚更新，请再次保存；当前草稿仍保留。", 409),
  )
}

export async function saveShoppingDismissal(input: unknown): Promise<ShoppingCatalog> {
  return mutateShoppingCatalog(
    (current, now) => applyShoppingDismissal(current, input, now) as ShoppingCatalog,
    (persisted, next) => {
      const id = (input as { itemId: string }).itemId
      return JSON.stringify(persisted.dismissals?.find(entry => entry.itemId === id) ?? null) === JSON.stringify(next.dismissals?.find(entry => entry.itemId === id) ?? null)
    },
    () => new ShoppingDismissalError("采购数据刚刚更新，请读取最新清单后重试。", 409),
  )
}

export async function readShoppingCatalog(): Promise<{ catalog: ShoppingCatalog; storage: string; warning?: string }> {
  const { R2_ENDPOINT_URL, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
  if (!R2_ENDPOINT_URL || !R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return { catalog: seed as ShoppingCatalog, storage: "seed", warning: "线上数据存储未连接，显示初始清单。" }
  }
  const client = new S3Client({ endpoint: R2_ENDPOINT_URL, region: "auto", forcePathStyle: true,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } })
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: shoppingObjectKey }))
    const catalog = decodeCatalog(JSON.parse(await object.Body!.transformToString()), R2_SECRET_ACCESS_KEY) as ShoppingCatalog
    if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.items) || !Array.isArray(catalog.campaigns)) {
      throw new Error("Invalid shopping catalog")
    }
    return { catalog, storage: "r2" }
  } catch (error) {
    if (error instanceof Error && error.name === "NoSuchKey") {
      return { catalog: seed as ShoppingCatalog, storage: "seed", warning: "等待第一次价格采集，显示初始核查清单。" }
    }
    console.error("Shopping catalog read failed", error instanceof Error ? error.name : "unknown")
    return { catalog: seed as ShoppingCatalog, storage: "seed", warning: "线上更新暂时读取失败，显示初始清单；请留意各商品核查时间。" }
  } finally { client.destroy() }
}
