import { NextResponse } from "next/server"
import { mergeBlockList, normalizePrivateImports, type FeedBlock, type PrivateImportPayload } from "@/lib/ai-feed-linkedin-import"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

const tableName = "ai_feed_private_imports"

type SupabaseError = {
  message?: string
}

type PrivateImportRow = {
  id: string
  owner_email: string
  source: string
  source_type: string
  canonical_url: string
  title: string
  block: FeedBlock
  created_at: string
  updated_at: string
}

export type ImportPersistenceResult = {
  imports: PrivateImportPayload
  block: FeedBlock
  inserted: boolean
  replaced: boolean
}

function textValue(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength)
}

function dbErrorMessage(error: SupabaseError | null, fallback = "AI feed import request failed") {
  return error?.message || fallback
}

export function aiFeedImportDbError(error: SupabaseError | null) {
  const message = dbErrorMessage(error)
  if (message.includes(tableName) || message.includes("schema cache")) {
    return NextResponse.json({ error: "AI feed imports table is not ready. Run docs/ai-feed-private-imports.sql in Supabase SQL Editor." }, { status: 400 })
  }
  return NextResponse.json({ error: message }, { status: 400 })
}

export function isAiFeedImportTableMissing(error: SupabaseError | null) {
  const message = dbErrorMessage(error, "")
  return message.includes(tableName) || message.includes("schema cache")
}

function normalizeOwnerEmail(email: unknown) {
  return String(email || "").trim().toLowerCase()
}

function sourceTypeForBlock(block: FeedBlock) {
  return block.kind === "action" ? "job" : "post"
}

function primaryCanonicalUrl(block: FeedBlock) {
  return textValue(block.links?.[0]?.url, 1200)
}

function normalizeRow(row: PrivateImportRow): FeedBlock {
  return row.block
}

export async function readAiFeedPrivateImports(ownerEmail: string): Promise<{ imports: PrivateImportPayload; error: SupabaseError | null }> {
  const normalizedEmail = normalizeOwnerEmail(ownerEmail)
  if (!normalizedEmail) return { imports: { version: 1, blocks: [] }, error: null }

  const { data, error } = await supabaseAdmin
    .from(tableName)
    .select("id,owner_email,source,source_type,canonical_url,title,block,created_at,updated_at")
    .eq("owner_email", normalizedEmail)
    .order("updated_at", { ascending: false })
    .limit(120)

  if (error) return { imports: { version: 1, blocks: [] }, error }
  return {
    imports: normalizePrivateImports({
      version: 1,
      updatedAt: (data?.[0] as PrivateImportRow | undefined)?.updated_at,
      blocks: ((data || []) as PrivateImportRow[]).map(normalizeRow),
    }),
    error: null,
  }
}

async function findExistingImport(ownerEmail: string, block: FeedBlock) {
  const normalizedEmail = normalizeOwnerEmail(ownerEmail)
  const blockId = textValue(block.id, 180)
  const canonicalUrl = primaryCanonicalUrl(block)

  if (blockId) {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select("id,owner_email,source,source_type,canonical_url,title,block,created_at,updated_at")
      .eq("owner_email", normalizedEmail)
      .eq("id", blockId)
      .maybeSingle()
    if (error) return { row: null, error }
    if (data) return { row: data as PrivateImportRow, error: null }
  }

  if (canonicalUrl) {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select("id,owner_email,source,source_type,canonical_url,title,block,created_at,updated_at")
      .eq("owner_email", normalizedEmail)
      .eq("canonical_url", canonicalUrl)
      .maybeSingle()
    if (error) return { row: null, error }
    if (data) return { row: data as PrivateImportRow, error: null }
  }

  return { row: null, error: null }
}

export async function persistAiFeedPrivateImport(ownerEmail: string, block: FeedBlock, replaceExisting: boolean): Promise<{ result: ImportPersistenceResult | null; error: SupabaseError | null }> {
  const normalizedEmail = normalizeOwnerEmail(ownerEmail)
  const blockId = textValue(block.id, 180)
  const canonicalUrl = primaryCanonicalUrl(block)

  if (!normalizedEmail) return { result: null, error: { message: "Missing owner email." } }
  if (!blockId) return { result: null, error: { message: "Generated import block is missing an id." } }
  if (!canonicalUrl) return { result: null, error: { message: "Generated import block is missing a canonical URL." } }

  const existing = await findExistingImport(normalizedEmail, block)
  if (existing.error) return { result: null, error: existing.error }

  if (existing.row && !replaceExisting) {
    const imports = await readAiFeedPrivateImports(normalizedEmail)
    if (imports.error) return { result: null, error: imports.error }
    return {
      result: {
        imports: imports.imports,
        block: existing.row.block,
        inserted: false,
        replaced: false,
      },
      error: null,
    }
  }

  const now = new Date().toISOString()
  const rowId = existing.row?.id || blockId
  const blockToStore = rowId === block.id ? block : { ...block, id: rowId }
  const { data, error } = await supabaseAdmin
    .from(tableName)
    .upsert(
      {
        id: rowId,
        owner_email: normalizedEmail,
        source: "linkedin",
        source_type: sourceTypeForBlock(blockToStore),
        canonical_url: canonicalUrl,
        title: textValue(blockToStore.title, 300),
        block: blockToStore,
        updated_at: now,
      },
      { onConflict: "owner_email,id" },
    )
    .select("id,owner_email,source,source_type,canonical_url,title,block,created_at,updated_at")
    .single()

  if (error) return { result: null, error }

  const imports = await readAiFeedPrivateImports(normalizedEmail)
  if (imports.error) return { result: null, error: imports.error }
  const merged = mergeBlockList(imports.imports.blocks, (data as PrivateImportRow).block, true)

  return {
    result: {
      imports: { ...imports.imports, blocks: merged.blocks },
      block: (data as PrivateImportRow).block,
      inserted: !existing.row,
      replaced: Boolean(existing.row),
    },
    error: null,
  }
}
