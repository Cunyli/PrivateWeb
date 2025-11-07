import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

export const runtime = "nodejs"

const bucketBaseUrl = (process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top").replace(/\/+$/, "")

const toPublicUrl = (path?: string | null) => {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${bucketBaseUrl}${normalizedPath}`
}

const fetchTagsByPattern = async (pattern: string) => {
  const { data, error } = await supabaseAdmin
    .from("tags")
    .select("id,name")
    .ilike("name", `%${pattern}%`)

  if (error) throw new Error(error.message)
  return data || []
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get("limit")) || 11, 48)

    const [englishTags, chineseTags] = await Promise.all([
      fetchTagsByPattern("master"),
      fetchTagsByPattern("大师"),
    ])

    const tagRows = [...englishTags, ...chineseTags]

    const tagIds = (tagRows || []).map((row) => row.id).filter((id): id is number => Number.isFinite(id))
    if (!tagIds.length) {
      return NextResponse.json({ shots: [] })
    }

    const { data: taggings, error: taggingsError } = await supabaseAdmin
      .from("picture_taggings")
      .select("picture_id")
      .in("tag_id", tagIds)

    if (taggingsError) {
      return NextResponse.json({ error: taggingsError.message }, { status: 500 })
    }

    const pictureIds = Array.from(
      new Set(
        (taggings || [])
          .map((row) => row.picture_id as number)
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    )

    if (!pictureIds.length) {
      return NextResponse.json({ shots: [] })
    }

    const { data: pictureRows, error: picturesError } = await supabaseAdmin
      .from("pictures")
      .select("id, picture_set_id, image_url, created_at, is_published")
      .in("id", pictureIds)

    if (picturesError) {
      return NextResponse.json({ error: picturesError.message }, { status: 500 })
    }

    const published = (pictureRows || [])
      .map((row) => ({
        ...row,
        publicUrl: toPublicUrl(row.image_url),
      }))
      .filter((row) => row.publicUrl && row.is_published !== false)
      .sort((a, b) => {
        const aTime = Date.parse(a.created_at || "") || 0
        const bTime = Date.parse(b.created_at || "") || 0
        return bTime - aTime
      })
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        pictureSetId: row.picture_set_id,
        imageUrl: row.publicUrl as string,
        styleLabel: "Master",
      }))

    return NextResponse.json({ shots: published })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load master shots" }, { status: 500 })
  }
}
