import { NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { requireAdminRequest } from "@/utils/admin-auth.server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"
import { parseCurationChanges, curationAssetKey } from "@/lib/photo-curation"
import type { CurationPhoto, CurationGroup } from "@/lib/photo-curation"
import { photoCurationTag } from "@/lib/photo-curation.server"
import { curationGroup, preferSeriesPlace } from "@/lib/photo-series"
import { photoSource } from "@/lib/portfolio-photo-source"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" }
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })

async function allRows(table: string, select: string, order: string, locale?: string) {
  const rows: any[] = []
  for(let from=0;from<100000;from+=1000) {
    let query=supabaseAdmin.from(table).select(select).order(order).range(from,from+999)
    if(locale)query=query.eq("locale",locale)
    const {data,error}=await query
    if(error)throw error
    rows.push(...data)
    if(data.length<1000)return {data:rows,error:null}
  }
  throw new Error("Photo library exceeds curation page limit")
}

async function allTaggings() {
  const rows: Array<{ picture_id: number; tag: unknown }> = []
  for (let from = 0; from < 100000; from += 1000) {
    const result = await supabaseAdmin.from("picture_taggings").select("picture_id,tag_id,tag:tags(name,type)").order("picture_id").order("tag_id").range(from, from + 999)
    if (result.error) throw result.error
    rows.push(...result.data)
    if (result.data.length < 1000) return rows
  }
  throw new Error("Tag index exceeds curation page limit")
}

export async function GET(request: Request) {
  const auth = await requireAdminRequest(request)
  if (!auth.ok) return response({ error: auth.error }, auth.status)
  try {
    const [pictures, sets, translations, reviews, assets, taggings] = await Promise.all([
      allRows("pictures","id,picture_set_id,title,image_url,raw_image_url,image_variants,is_published,updated_at,order_index","id"),
      allRows("picture_sets","id,title,subtitle,is_published","id"),
      allRows("picture_set_translations","picture_set_id,locale,title,subtitle","picture_set_id","zh"),
      supabaseAdmin.rpc("portfolio_curation_index"),
      supabaseAdmin.rpc("portfolio_curation_assets_index"),
      allTaggings(),
    ])
    for (const result of [pictures, sets, translations, reviews, assets]) if (result.error) throw result.error
    const setMap = new Map((sets.data || []).map(row => [row.id, row]))
    const translationMap = new Map((translations.data || []).map(row => [row.picture_set_id, row]))
    const reviewMap = new Map<number, { state: "keep" | "trash"; reviewed_at: string; image_width: number | null; image_height: number | null }>((reviews.data || []).map((row: any) => [row.picture_id, row]))
    const tagMap = new Map<number, string[]>()
    for (const row of taggings) {
      const tag = row.tag as { name?: string } | null
      if (tag?.name) tagMap.set(row.picture_id, [...(tagMap.get(row.picture_id) || []), tag.name])
    }
    const bucket = process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top"
    const items: CurationPhoto[] = (pictures.data || []).map(row => {
      const set = setMap.get(row.picture_set_id)
      const translation = translationMap.get(row.picture_set_id)
      const tags = tagMap.get(row.id) || []
      const group = curationGroup(row.picture_set_id, translation?.title || set?.title, translation?.subtitle || set?.subtitle, tags)
      const review = reviewMap.get(row.id)
      const imageUrl = row.image_url || row.raw_image_url || "/placeholder.svg"
      return {
        id: row.id, setId: row.picture_set_id, groupId: group.id, groupTitle: group.title, groupSubtitle: group.subtitle,
        title: row.title || "", filename: curationAssetKey(row.raw_image_url || imageUrl) || `照片 ${row.id}`,
        imageUrl, previewUrl: photoSource(imageUrl, bucket, 640), detailUrl: photoSource(imageUrl, bucket, 1280),
        published: row.is_published === true, updatedAt: row.updated_at || null, reviewedAt: review?.reviewed_at || null,
        tags, state: review?.state || "unreviewed", order: row.order_index ?? row.id, width: review?.image_width || undefined, height: review?.image_height || undefined,
      }
    })
    for (const asset of assets.data || []) items.push({
      id: asset.id, setId: 0, groupId: "fixed-assets", groupTitle: "固定展示图", groupSubtitle: "约拍页封面与旧版备用照片",
      title: asset.title, filename: asset.title, imageUrl: asset.source_url, previewUrl: asset.preview_url, detailUrl: asset.detail_url,
      published: asset.state !== "trash", updatedAt: asset.updated_at, reviewedAt: asset.reviewed_at, state: asset.state, order: -asset.id,
      width: asset.image_width || undefined, height: asset.image_height || undefined,
    })
    const groups = new Map<string, CurationGroup>()
    for (const photo of items) {
      const group = groups.get(photo.groupId) || { id: photo.groupId, title: photo.groupTitle, subtitle: photo.groupSubtitle, count: 0 }
      group.subtitle=preferSeriesPlace(group.subtitle,photo.groupSubtitle)
      group.count++; groups.set(photo.groupId, group)
    }
    const priority = (group: CurationGroup) => group.id === "portrait-pool" ? 0 : 1
    const sortedGroups = [...groups.values()].sort((a, b) => priority(a) - priority(b) || a.title.localeCompare(b.title, "zh-CN", { numeric: true }) || a.subtitle.localeCompare(b.subtitle))
    return response({ items: items.sort((a, b) => a.order - b.order || a.id - b.id), groups: sortedGroups, draftKey: `portfolio:curation:ratings-v2:${auth.user.id}` })
  } catch (error) {
    console.error("Curation library load failed", error)
    return response({ error: "照片库暂时没有载入，请重试。" }, 500)
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminRequest(request)
  if (!auth.ok) return response({ error: auth.error }, auth.status)
  let changes
  try {
    const text = await request.text()
    if (text.length > 600000) return response({ error: "选片批次过大，请按系列保存。" }, 413)
    changes = parseCurationChanges(JSON.parse(text))
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "选片数据无效。" }, 400)
  }
  const { data, error } = await supabaseAdmin.rpc("apply_portfolio_curation", {
    p_changes: changes.map(change => ({ picture_id: change.pictureId, decision: change.decision, expected_updated_at: change.expectedUpdatedAt, expected_reviewed_at: change.expectedReviewedAt, image_width: change.width || null, image_height: change.height || null })),
    p_reviewer: auth.user.id,
  })
  if (error) {
    if (error.code === "40001") return response({ error: "这些照片已在另一页面更新。请刷新后再保存，当前勾选会保留。" }, 409)
    if (error.code === "22023") return response({ error: "照片数据已变化，请刷新后重试。" }, 400)
    console.error("Curation batch failed", error)
    return response({ error: "保存没有成功，照片未被部分删除，请重试。" }, 500)
  }
  revalidateTag(photoCurationTag)
  revalidatePath("/", "layout")
  return response({ ok: true, changed: data?.changed || changes.length })
}
