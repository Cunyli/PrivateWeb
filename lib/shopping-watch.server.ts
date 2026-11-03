import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import seed from "@/data/shopping-watch/catalog.json"
import type { ShoppingCatalog } from "@/lib/shopping-watch"
import { decodeCatalog, encodeCatalog } from "@/lib/shopping-watch-crypto.mjs"
import { applyShoppingMemo, ShoppingMemoError } from "@/lib/shopping-memo.mjs"

export const shoppingObjectKey = "shopping-watch/catalog-v1.json"

export async function saveShoppingMemo(memo: unknown, expectedUpdatedAt?: unknown): Promise<ShoppingCatalog> {
  const { R2_ENDPOINT_URL, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
  if (!R2_ENDPOINT_URL || !R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error("Shopping storage is not configured")
  const client = new S3Client({ endpoint: R2_ENDPOINT_URL, region: "auto", forcePathStyle: true,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } })
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: shoppingObjectKey }))
    const current = decodeCatalog(JSON.parse(await object.Body!.transformToString()), R2_SECRET_ACCESS_KEY) as ShoppingCatalog
    if (current.schemaVersion !== 1 || !Array.isArray(current.items) || !object.ETag) throw new Error("Invalid shopping storage")
    const next = applyShoppingMemo(current, memo, expectedUpdatedAt, new Date().toISOString()) as ShoppingCatalog
    try {
      await client.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: shoppingObjectKey, IfMatch: object.ETag,
        Body: JSON.stringify(encodeCatalog(next, R2_SECRET_ACCESS_KEY)), ContentType: "application/json; charset=utf-8", CacheControl: "no-store" }))
    } catch (error) {
      if (error instanceof Error && error.name === "PreconditionFailed") throw new ShoppingMemoError("采购数据刚刚更新，请再次保存；当前草稿仍保留。", 409)
      throw error
    }
    const checked = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: shoppingObjectKey }))
    const persisted = decodeCatalog(JSON.parse(await checked.Body!.transformToString()), R2_SECRET_ACCESS_KEY) as ShoppingCatalog
    const memoId = (memo as { id: string }).id.trim()
    const saved = persisted.memos?.find(item => item.id === memoId)
    if (!saved || !Number.isFinite(Date.parse(saved.updatedAt)) || Date.parse(saved.updatedAt) < Date.parse(next.updatedAt!)) throw new Error("Shopping memo readback failed")
    return persisted
  } finally { client.destroy() }
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
