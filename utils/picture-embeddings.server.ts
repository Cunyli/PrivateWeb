import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { after } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

type PictureEmbeddingRow = {
  id: number
  title?: string | null
  subtitle?: string | null
  description?: string | null
  image_url?: string | null
  raw_image_url?: string | null
  image_variants?: Record<string, string | null | undefined> | null
  search_text?: string | null
}

type EmbeddingPayload = {
  embedding: number[]
  model?: string
  provider?: string
}

type EmbeddingBackfillResult = {
  insertedOrUpdated: number
  skipped: number
  failed: number
}

const chooseImagePath = (picture: PictureEmbeddingRow) =>
  picture.image_variants?.original ||
  picture.raw_image_url ||
  picture.image_url ||
  ""

const resolveImageUrl = (imagePath: string) => {
  if (!imagePath) return ""
  if (/^https?:\/\//i.test(imagePath)) return imagePath

  const bucketUrl = process.env.NEXT_PUBLIC_BUCKET_URL
  if (!bucketUrl) {
    throw new Error("Missing NEXT_PUBLIC_BUCKET_URL for relative image paths")
  }

  return `${bucketUrl.replace(/\/$/, "")}/${imagePath.replace(/^\//, "")}`
}

const buildEmbeddingText = (picture: PictureEmbeddingRow) =>
  [
    picture.title,
    picture.subtitle,
    picture.description,
    picture.search_text,
  ]
    .filter(Boolean)
    .join("\n")

const buildContentHash = (picture: PictureEmbeddingRow) =>
  createHash("sha256")
    .update(JSON.stringify({
      image_url: picture.image_url,
      raw_image_url: picture.raw_image_url,
      image_variants: picture.image_variants,
      text: buildEmbeddingText(picture),
    }))
    .digest("hex")

const formatVector = (embedding: number[]) => {
  const expectedDimensions = getEmbeddingDimensions()
  if (embedding.length !== expectedDimensions) {
    throw new Error(`Expected a ${expectedDimensions}-dimensional embedding, got ${embedding.length}`)
  }
  if (embedding.some((value) => !Number.isFinite(value))) {
    throw new Error("Embedding contains a non-finite value")
  }
  return `[${embedding.join(",")}]`
}

const shellQuote = (value: string) => `'${value.replaceAll("'", "'\"'\"'")}'`

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const DEFAULT_JINA_MODEL = "jina-embeddings-v5-omni-small"
const JINA_EMBEDDING_ENDPOINT = "https://api.jina.ai/v1/embeddings"

const getEmbeddingDimensions = () => Number(process.env.JINA_EMBEDDING_DIMENSIONS || 1024)

const getJinaModel = () => process.env.JINA_EMBEDDING_MODEL || DEFAULT_JINA_MODEL

const getExpectedEmbeddingModel = () =>
  process.env.PICTURE_EMBEDDING_MODEL ||
  process.env.IMAGE_EMBEDDING_MODEL ||
  process.env.HF_IMAGE_EMBEDDING_MODEL ||
  (process.env.JINA_API_KEY ? getJinaModel() : "sentence-transformers/clip-ViT-B-32")

const isNonRetriableEmbeddingError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("jina failed: 400") ||
    message.includes("Failed to load image from")
  )
}

const buildEmbeddingRequestPayload = (picture: PictureEmbeddingRow) => {
  const imageUrl = resolveImageUrl(chooseImagePath(picture))
  if (!imageUrl) {
    throw new Error(`No image URL available for picture ${picture.id}`)
  }

  return {
    imageUrl,
    text: buildEmbeddingText(picture),
    picture,
  }
}

const getPrimaryHealthUrl = (endpoint: string) => {
  if (process.env.IMAGE_EMBEDDING_HEALTH_URL) {
    return process.env.IMAGE_EMBEDDING_HEALTH_URL
  }
  try {
    const url = new URL(endpoint)
    url.pathname = "/health"
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return ""
  }
}

const isPrimaryEmbeddingEndpointAvailable = async (endpoint: string) => {
  if (process.env.IMAGE_EMBEDDING_SSH_HOST) {
    return true
  }

  const healthUrl = getPrimaryHealthUrl(endpoint)
  if (!healthUrl) {
    return true
  }

  try {
    const response = await fetch(healthUrl, { cache: "no-store" })
    return response.ok
  } catch {
    return false
  }
}

const requestEmbeddingViaSsh = (endpoint: string, requestPayload: Record<string, unknown>) => {
  const encodedPayload = Buffer.from(JSON.stringify(requestPayload), "utf8").toString("base64")
  const code = [
    "import base64, json, sys, urllib.request",
    "endpoint = sys.argv[1]",
    "payload = base64.b64decode(sys.argv[2])",
    "request = urllib.request.Request(endpoint, data=payload, headers={'content-type': 'application/json'}, method='POST')",
    "with urllib.request.urlopen(request, timeout=120) as response:",
    "    sys.stdout.write(response.read().decode('utf-8'))",
  ].join("\n")
  const remoteCommand = [
    "python3",
    "-c",
    shellQuote(code),
    shellQuote(endpoint),
    shellQuote(encodedPayload),
  ].join(" ")
  const output = execFileSync("ssh", [
    process.env.IMAGE_EMBEDDING_SSH_HOST as string,
    remoteCommand,
  ], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  })
  return JSON.parse(output) as EmbeddingPayload
}

const requestEmbeddingEndpoint = async (
  endpoint: string,
  requestPayload: Record<string, unknown>,
  options: { apiKey?: string; provider: string; useSsh?: boolean },
): Promise<EmbeddingPayload> => {
  if (options.useSsh) {
    const payload = requestEmbeddingViaSsh(endpoint, requestPayload)
    if (!Array.isArray(payload.embedding)) {
      throw new Error(`${options.provider} returned no embedding`)
    }
    return { ...payload, provider: options.provider }
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(options.apiKey
        ? { authorization: `Bearer ${options.apiKey}` }
        : {}),
    },
    body: JSON.stringify(requestPayload),
  })

  if (!response.ok) {
    throw new Error(`${options.provider} failed: ${response.status} ${await response.text()}`)
  }

  const payload = await response.json() as EmbeddingPayload
  if (!Array.isArray(payload.embedding)) {
    throw new Error(`${options.provider} returned no embedding`)
  }
  return { ...payload, provider: options.provider }
}

const requestPrimaryEmbedding = async (
  requestPayload: Record<string, unknown>,
): Promise<EmbeddingPayload> => {
  const endpoint = process.env.IMAGE_EMBEDDING_API_URL
  if (!endpoint) {
    throw new Error("Missing IMAGE_EMBEDDING_API_URL")
  }

  if (!(await isPrimaryEmbeddingEndpointAvailable(endpoint))) {
    throw new Error("Primary image embedding endpoint is not available")
  }

  return requestEmbeddingEndpoint(endpoint, requestPayload, {
    apiKey: process.env.IMAGE_EMBEDDING_API_KEY,
    provider: process.env.IMAGE_EMBEDDING_PROVIDER || "primary",
    useSsh: Boolean(process.env.IMAGE_EMBEDDING_SSH_HOST),
  })
}

const requestHfImageEmbedding = async (
  requestPayload: Record<string, unknown>,
): Promise<EmbeddingPayload> => {
  const endpoint = process.env.HF_IMAGE_EMBEDDING_API_URL
  if (!endpoint) {
    throw new Error("Missing HF_IMAGE_EMBEDDING_API_URL")
  }

  return requestEmbeddingEndpoint(endpoint, requestPayload, {
    apiKey: process.env.HF_IMAGE_EMBEDDING_API_KEY || process.env.HF_TOKEN || process.env.HUGGINGFACEHUB_API_TOKEN,
    provider: "hf-image-endpoint",
  })
}

const parseJinaEmbedding = (payload: unknown) => {
  const responsePayload = payload as { data?: Array<{ embedding?: unknown }> }
  const embedding = responsePayload.data?.[0]?.embedding
  if (!Array.isArray(embedding)) {
    throw new Error("Jina embedding response did not include an embedding")
  }
  const values = embedding.map((value) => Number(value))
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Jina embedding response included non-numeric values")
  }
  return values
}

const requestJinaImageEmbedding = async (
  requestPayload: ReturnType<typeof buildEmbeddingRequestPayload>,
): Promise<EmbeddingPayload> => {
  const token = process.env.JINA_API_KEY
  if (!token) {
    throw new Error("Missing JINA_API_KEY")
  }

  const body: Record<string, unknown> = {
    model: getJinaModel(),
    dimensions: getEmbeddingDimensions(),
    normalized: true,
    embedding_type: "float",
    input: [{ image: requestPayload.imageUrl }],
  }
  if (process.env.JINA_IMAGE_EMBEDDING_TASK) {
    body.task = process.env.JINA_IMAGE_EMBEDDING_TASK
  }

  const response = await fetch(JINA_EMBEDDING_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`jina failed: ${response.status} ${await response.text()}`)
  }

  return {
    embedding: parseJinaEmbedding(await response.json()),
    model: getJinaModel(),
    provider: "jina",
  }
}

const requestEmbedding = async (picture: PictureEmbeddingRow): Promise<EmbeddingPayload> => {
  const requestPayload = buildEmbeddingRequestPayload(picture)
  const errors: string[] = []

  if (process.env.IMAGE_EMBEDDING_API_URL) {
    try {
      return await requestPrimaryEmbedding(requestPayload)
    } catch (error: any) {
      errors.push(`primary: ${error?.message || error}`)
    }
  }

  if (process.env.HF_IMAGE_EMBEDDING_API_URL) {
    try {
      return await requestHfImageEmbedding(requestPayload)
    } catch (error: any) {
      errors.push(`hf-image-endpoint: ${error?.message || error}`)
    }
  }

  if (process.env.JINA_API_KEY) {
    try {
      return await requestJinaImageEmbedding(requestPayload)
    } catch (error: any) {
      errors.push(`jina: ${error?.message || error}`)
    }
  }

  if (!errors.length) {
    throw new Error("Missing IMAGE_EMBEDDING_API_URL, HF_IMAGE_EMBEDDING_API_URL, or JINA_API_KEY")
  }

  throw new Error(`All image embedding providers failed (${errors.join("; ")})`)
}

const requestEmbeddingWithRetry = async (picture: PictureEmbeddingRow, attempts = 3) => {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await requestEmbedding(picture)
    } catch (error) {
      lastError = error
      if (isNonRetriableEmbeddingError(error)) {
        break
      }
      if (attempt < attempts) {
        await wait(1000 * attempt)
      }
    }
  }
  throw lastError
}

const asyncPool = async <T>(
  limit: number,
  items: T[],
  worker: (item: T) => Promise<void>,
) => {
  let nextIndex = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = nextIndex++
      if (index >= items.length) break
      await worker(items[index])
    }
  })
  await Promise.all(runners)
}

export async function backfillPictureEmbeddingsByIds(
  pictureIds: number[],
  options: { force?: boolean } = {},
): Promise<EmbeddingBackfillResult> {
  const uniqueIds = Array.from(new Set(pictureIds.filter((id) => Number.isFinite(id) && id > 0)))
  if (!uniqueIds.length) {
    return { insertedOrUpdated: 0, skipped: 0, failed: 0 }
  }

  if (!process.env.IMAGE_EMBEDDING_API_URL && !process.env.HF_IMAGE_EMBEDDING_API_URL && !process.env.JINA_API_KEY) {
    console.warn("Skipping picture embedding backfill because no image embedding provider is configured")
    return { insertedOrUpdated: 0, skipped: uniqueIds.length, failed: 0 }
  }

  const { data: pictures, error: picturesError } = await supabaseAdmin
    .from("pictures")
    .select("id,title,subtitle,description,image_url,raw_image_url,image_variants,search_text")
    .in("id", uniqueIds)

  if (picturesError) {
    throw picturesError
  }

  const concurrency = Math.max(1, Math.min(4, Number(process.env.PICTURE_EMBEDDING_CONCURRENCY || 2)))
  const result: EmbeddingBackfillResult = { insertedOrUpdated: 0, skipped: 0, failed: 0 }

  await asyncPool(concurrency, (pictures || []) as PictureEmbeddingRow[], async (picture) => {
    try {
      const contentHash = buildContentHash(picture)

      if (!options.force) {
        const { data: existing, error: existingError } = await supabaseAdmin
          .from("picture_embeddings")
          .select("content_hash,model")
          .eq("picture_id", picture.id)
          .maybeSingle()

        if (existingError) {
          throw existingError
        }
        if (existing?.content_hash === contentHash && existing.model === getExpectedEmbeddingModel()) {
          result.skipped++
          return
        }
      }

      const embeddingPayload = await requestEmbeddingWithRetry(picture)
      const model = embeddingPayload.model
        || (embeddingPayload.provider === "jina"
          ? getJinaModel()
          : embeddingPayload.provider === "hf-image-endpoint"
          ? process.env.HF_IMAGE_EMBEDDING_MODEL
          : process.env.IMAGE_EMBEDDING_MODEL)
        || "sentence-transformers/clip-ViT-B-32"
      const { error: upsertError } = await supabaseAdmin
        .from("picture_embeddings")
        .upsert({
          picture_id: picture.id,
          embedding: formatVector(embeddingPayload.embedding),
          model,
          content_hash: contentHash,
          embedding_source: "image",
        }, {
          onConflict: "picture_id",
        })

      if (upsertError) {
        throw upsertError
      }

      result.insertedOrUpdated++
    } catch (error) {
      result.failed++
      console.error(`Picture embedding failed for picture ${picture.id}:`, error)
    }
  })

  return result
}

export function triggerPictureEmbeddingBackfill(pictureIds: number[]) {
  const uniqueIds = Array.from(new Set(pictureIds.filter((id) => Number.isFinite(id) && id > 0)))
  if (!uniqueIds.length) return

  after(() => {
    backfillPictureEmbeddingsByIds(uniqueIds).then((result) => {
      console.log("Picture embedding backfill finished:", {
        pictureIds: uniqueIds,
        ...result,
      })
    }).catch((error) => {
      console.error("Picture embedding backfill trigger failed:", error)
    })
  })
}
