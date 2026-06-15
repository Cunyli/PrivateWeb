import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import process from "node:process"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

const usage = `
Usage:
  pnpm backfill:picture-embeddings [--limit 50 | --all | --ids 1,2,3] [--force] [--dry-run]

Environment:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  IMAGE_EMBEDDING_API_URL
  IMAGE_EMBEDDING_SSH_HOST optional, for example triton
  IMAGE_EMBEDDING_API_KEY optional
  HF_IMAGE_EMBEDDING_API_URL optional fallback Hugging Face image embedding endpoint
  HF_IMAGE_EMBEDDING_API_KEY optional, falls back to HF_TOKEN
  IMAGE_EMBEDDING_MODEL optional, default sentence-transformers/clip-ViT-B-32

The embedding endpoint receives:
  { imageUrl, text, picture }

It must return:
  { embedding: number[], model?: string }
`

const loadEnvFile = (filename) => {
  const envPath = resolve(process.cwd(), filename)
  if (!existsSync(envPath)) {
    return
  }

  const envContent = readFileSync(envPath, "utf-8")
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const eqIndex = trimmed.indexOf("=")
    if (eqIndex <= 0) {
      continue
    }

    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  let limit = 50
  let all = false
  let force = false
  let dryRun = false
  let ids = []

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === "--help" || arg === "-h") {
      console.log(usage)
      process.exit(0)
    }
    if (arg === "--force") {
      force = true
      continue
    }
    if (arg === "--dry-run") {
      dryRun = true
      continue
    }
    if (arg === "--all") {
      all = true
      continue
    }
    if (arg === "--ids") {
      const rawIds = args[index + 1]
      index++
      ids = parseIds(rawIds)
      continue
    }
    if (arg.startsWith("--ids=")) {
      ids = parseIds(arg.slice("--ids=".length))
      continue
    }
    if (arg === "--limit") {
      const rawLimit = args[index + 1]
      index++
      limit = Number(rawLimit)
      if (!Number.isInteger(limit) || limit < 1) {
        throw new Error(`Invalid --limit value: ${rawLimit}`)
      }
      continue
    }
    if (arg.startsWith("--limit=")) {
      const rawLimit = arg.slice("--limit=".length)
      limit = Number(rawLimit)
      if (!Number.isInteger(limit) || limit < 1) {
        throw new Error(`Invalid --limit value: ${rawLimit}`)
      }
      continue
    }

    throw new Error(`Unknown argument: ${arg}\n${usage}`)
  }

  return { all, dryRun, force, ids, limit }
}

const parseIds = (rawIds) => {
  const ids = String(rawIds || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
  if (!ids.length) {
    throw new Error(`Invalid --ids value: ${rawIds}`)
  }
  return Array.from(new Set(ids))
}

const resolveImageUrl = (imagePath) => {
  if (!imagePath) {
    return null
  }
  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath
  }

  const bucketUrl = process.env.NEXT_PUBLIC_BUCKET_URL
  if (!bucketUrl) {
    throw new Error("Missing NEXT_PUBLIC_BUCKET_URL for relative image paths")
  }

  return `${bucketUrl.replace(/\/$/, "")}/${String(imagePath).replace(/^\//, "")}`
}

const chooseImagePath = (picture) =>
  picture.image_variants?.original ||
  picture.raw_image_url ||
  picture.image_url

const buildEmbeddingText = (picture) =>
  [
    picture.title,
    picture.subtitle,
    picture.description,
    picture.search_text,
  ]
    .filter(Boolean)
    .join("\n")

const buildContentHash = (picture) =>
  createHash("sha256")
    .update(JSON.stringify({
      image_url: picture.image_url,
      raw_image_url: picture.raw_image_url,
      image_variants: picture.image_variants,
      text: buildEmbeddingText(picture),
    }))
    .digest("hex")

const formatVector = (embedding) => {
  if (embedding.length !== 512) {
    throw new Error(`Expected a 512-dimensional embedding, got ${embedding.length}`)
  }
  if (embedding.some((value) => !Number.isFinite(value))) {
    throw new Error("Embedding contains a non-finite value")
  }
  return `[${embedding.join(",")}]`
}

const shellQuote = (value) => `'${String(value).replaceAll("'", "'\"'\"'")}'`

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const embedPictureWithRetry = async (picture, attempts = 3) => {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await embedPicture(picture)
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        console.warn(`[retry] picture ${picture.id}: attempt ${attempt} failed, retrying`)
        await wait(1000 * attempt)
      }
    }
  }
  throw lastError
}

const buildEmbeddingRequestPayload = (picture) => {
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

const getPrimaryHealthUrl = (endpoint) => {
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

const isPrimaryEmbeddingEndpointAvailable = async (endpoint) => {
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

const embedViaSsh = (endpoint, requestPayload) => {
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
    process.env.IMAGE_EMBEDDING_SSH_HOST,
    remoteCommand,
  ], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  })
  return JSON.parse(output)
}

const embedWithEndpoint = async (endpoint, requestPayload, { apiKey, provider, useSsh = false }) => {
  if (useSsh) {
    const payload = embedViaSsh(endpoint, requestPayload)
    if (!Array.isArray(payload.embedding)) {
      throw new Error(`${provider} returned no embedding`)
    }
    return { ...payload, provider }
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey
        ? { authorization: `Bearer ${apiKey}` }
        : {}),
    },
    body: JSON.stringify(requestPayload),
  })

  if (!response.ok) {
    throw new Error(`${provider} failed: ${response.status} ${await response.text()}`)
  }

  const responsePayload = await response.json()
  if (!Array.isArray(responsePayload.embedding)) {
    throw new Error(`${provider} returned no embedding`)
  }
  return { ...responsePayload, provider }
}

const embedWithPrimaryEndpoint = async (requestPayload) => {
  const endpoint = process.env.IMAGE_EMBEDDING_API_URL
  if (!endpoint) {
    throw new Error("Missing IMAGE_EMBEDDING_API_URL")
  }
  if (!(await isPrimaryEmbeddingEndpointAvailable(endpoint))) {
    throw new Error("Primary image embedding endpoint is not available")
  }
  return embedWithEndpoint(endpoint, requestPayload, {
    apiKey: process.env.IMAGE_EMBEDDING_API_KEY,
    provider: process.env.IMAGE_EMBEDDING_PROVIDER || "primary",
    useSsh: Boolean(process.env.IMAGE_EMBEDDING_SSH_HOST),
  })
}

const embedWithHfImageEndpoint = async (requestPayload) => {
  const endpoint = process.env.HF_IMAGE_EMBEDDING_API_URL
  if (!endpoint) {
    throw new Error("Missing HF_IMAGE_EMBEDDING_API_URL")
  }
  return embedWithEndpoint(endpoint, requestPayload, {
    apiKey: process.env.HF_IMAGE_EMBEDDING_API_KEY || process.env.HF_TOKEN || process.env.HUGGINGFACEHUB_API_TOKEN,
    provider: "hf-image-endpoint",
  })
}

const embedPicture = async (picture) => {
  const requestPayload = buildEmbeddingRequestPayload(picture)
  const errors = []

  if (process.env.IMAGE_EMBEDDING_API_URL) {
    try {
      return await embedWithPrimaryEndpoint(requestPayload)
    } catch (error) {
      errors.push(`primary: ${error.message}`)
    }
  }

  if (process.env.HF_IMAGE_EMBEDDING_API_URL) {
    try {
      return await embedWithHfImageEndpoint(requestPayload)
    } catch (error) {
      errors.push(`hf-image-endpoint: ${error.message}`)
    }
  }

  if (!errors.length) {
    throw new Error("Missing IMAGE_EMBEDDING_API_URL or HF_IMAGE_EMBEDDING_API_URL. Run with --dry-run to inspect candidates without embedding.")
  }

  throw new Error(`All image embedding providers failed (${errors.join("; ")})`)
}

const main = async () => {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  const { all, dryRun, force, ids, limit } = parseArgs()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
  }
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  let query = supabaseAdmin
    .from("pictures")
    .select("id,title,subtitle,description,image_url,raw_image_url,image_variants,search_text")
    .order("id", { ascending: true })

  if (ids.length) {
    query = query.in("id", ids)
  } else if (!all) {
    query = query.limit(limit)
  }

  const { data: pictures, error: picturesError } = await query

  if (picturesError) {
    throw picturesError
  }

  let inserted = 0
  let skipped = 0
  const failed = []

  for (const picture of pictures || []) {
    const contentHash = buildContentHash(picture)

    if (!force) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("picture_embeddings")
        .select("content_hash")
        .eq("picture_id", picture.id)
        .maybeSingle()

      if (existingError) {
        throw existingError
      }
      if (existing?.content_hash === contentHash) {
        skipped++
        continue
      }
    }

    if (dryRun) {
      console.log(`[dry-run] picture ${picture.id}: ${picture.title} -> ${resolveImageUrl(chooseImagePath(picture))}`)
      continue
    }

    let embeddingPayload
    try {
      embeddingPayload = await embedPictureWithRetry(picture)
    } catch (error) {
      failed.push({ id: picture.id, title: picture.title, message: error.message })
      console.error(`[failed] picture ${picture.id}: ${picture.title} - ${error.message}`)
      continue
    }

    const model = embeddingPayload.model
      || (embeddingPayload.provider === "hf-image-endpoint"
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

    inserted++
    console.log(`[ok] picture ${picture.id}: ${picture.title}`)
  }

  console.log(`Done. inserted_or_updated=${inserted} skipped=${skipped} failed=${failed.length}`)
  for (const failure of failed) {
    console.log(`[failed-summary] picture ${failure.id}: ${failure.title} - ${failure.message}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
