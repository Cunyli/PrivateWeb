import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import seed from "@/data/shopping-watch/catalog.json"
import type { ShoppingCatalog } from "@/lib/shopping-watch"
import { decodeCatalog } from "@/lib/shopping-watch-crypto.mjs"

export const shoppingObjectKey = "shopping-watch/catalog-v1.json"

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
