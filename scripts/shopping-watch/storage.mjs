import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { decodeCatalog, encodeCatalog } from "../../lib/shopping-watch-crypto.mjs"

export const objectKey = "shopping-watch/catalog-v1.json"

export function createStorage() {
  const names = ["R2_ENDPOINT_URL", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]
  for (const name of names) if (!process.env[name]) throw new Error(`Missing ${name}`)
  const client = new S3Client({ endpoint: process.env.R2_ENDPOINT_URL, region: "auto", forcePathStyle: true,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } })
  return {
    async read() {
      try {
        const object = await client.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: objectKey }))
        return { catalog: decodeCatalog(JSON.parse(await object.Body.transformToString()), process.env.R2_SECRET_ACCESS_KEY), etag: object.ETag }
      } catch (error) {
        if (error instanceof Error && error.name === "NoSuchKey") return { catalog: null, etag: null }
        throw error
      }
    },
    async write(catalog, etag) {
      await client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: objectKey,
        Body: JSON.stringify(encodeCatalog(catalog, process.env.R2_SECRET_ACCESS_KEY)), ContentType: "application/json; charset=utf-8", CacheControl: "no-store",
        ...(etag ? { IfMatch: etag } : { IfNoneMatch: "*" }) }))
    },
    close() { client.destroy() },
  }
}
