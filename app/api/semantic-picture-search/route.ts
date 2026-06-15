import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

export const runtime = "nodejs"

const DEFAULT_MODEL = "sentence-transformers/clip-ViT-B-32-multilingual-v1"
const HF_ROUTER_BASE = "https://router.huggingface.co/hf-inference/models"
const MAX_QUERY_LENGTH = 160
const MAX_LIMIT = 30

type EmbeddingPayload = number[] | number[][] | number[][][]

const flattenEmbedding = (payload: EmbeddingPayload): number[] => {
  let value: unknown = payload
  while (
    Array.isArray(value)
    && value.length === 1
    && Array.isArray(value[0])
  ) {
    value = value[0]
  }

  if (!Array.isArray(value) || value.some((item) => Array.isArray(item))) {
    throw new Error("Embedding provider returned token embeddings instead of a pooled vector")
  }

  const embedding = value.map((item) => Number(item))
  if (embedding.some((item) => !Number.isFinite(item))) {
    throw new Error("Embedding provider returned non-numeric values")
  }
  if (embedding.length !== 512) {
    throw new Error(`Expected 512-dimensional embedding, got ${embedding.length}`)
  }
  return embedding
}

const normalizeEmbedding = (embedding: number[]) => {
  const norm = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0))
  if (!norm) {
    throw new Error("Embedding provider returned a zero vector")
  }
  return embedding.map((value) => value / norm)
}

const embedQuery = async (query: string) => {
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACEHUB_API_TOKEN
  if (!token) {
    throw new Error("Missing HF_TOKEN")
  }

  const model = process.env.HF_TEXT_EMBEDDING_MODEL || DEFAULT_MODEL
  const endpoint = `${HF_ROUTER_BASE}/${model}/pipeline/feature-extraction`
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      inputs: query,
      options: { wait_for_model: true },
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Embedding request failed: ${response.status} ${detail}`)
  }

  return normalizeEmbedding(flattenEmbedding(await response.json()))
}

const parseLimit = (value: string | null) => {
  const limit = Number(value || 12)
  if (!Number.isFinite(limit) || limit < 1) return 12
  return Math.min(Math.floor(limit), MAX_LIMIT)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get("q") || "").normalize("NFKC").replace(/\s+/g, " ").trim()
  const limit = parseLimit(searchParams.get("limit"))
  const minSimilarity = Number(searchParams.get("minSimilarity") || 0)

  if (!query) {
    return NextResponse.json({ results: [] })
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Query is too long" }, { status: 400 })
  }

  try {
    const embedding = await embedQuery(query)
    const { data, error } = await supabaseAdmin.rpc("match_pictures_by_embedding", {
      query_embedding: embedding,
      match_count: limit,
      min_similarity: Number.isFinite(minSimilarity) ? minSimilarity : 0,
      min_lng: null,
      min_lat: null,
      max_lng: null,
      max_lat: null,
    })

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({
      results: data || [],
      model: process.env.HF_TEXT_EMBEDDING_MODEL || DEFAULT_MODEL,
    })
  } catch (error: any) {
    console.error("[api/semantic-picture-search]", error)
    return NextResponse.json(
      { error: error?.message || "Semantic search failed" },
      { status: 500 },
    )
  }
}
