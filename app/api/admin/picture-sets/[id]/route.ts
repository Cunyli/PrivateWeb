import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getObjectKeyFromUrl } from "@/utils/r2-helpers"
export const runtime = 'nodejs'

// --- Translation helpers (server-side bi-directional) ---
const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  const port = process.env.PORT || 3000
  return `http://localhost:${port}`
}

async function translateText(text: string, target: 'en' | 'zh'): Promise<string> {
  try {
    if (!text || !text.trim()) return ''
    const res = await fetch(`${getBaseUrl()}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang: 'auto', targetLang: target }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    return (data.translated as string) || ''
  } catch {
    return ''
  }
}

async function fillSetTranslationsBi(payload: any): Promise<{ en: any; zh: any }> {
  const base = { title: payload.title || '', subtitle: payload.subtitle || '', description: payload.description || '' }
  const enOut: any = { title: payload.en?.title || '', subtitle: payload.en?.subtitle || '', description: payload.en?.description || '' }
  const zhOut: any = { title: payload.zh?.title || '', subtitle: payload.zh?.subtitle || '', description: payload.zh?.description || '' }
  const isZh = (s?: string) => /[\u4e00-\u9fff]/.test(String(s || ''))
  for (const key of ['title', 'subtitle', 'description'] as const) {
    const b = base[key]
    let enVal = enOut[key] || ''
    let zhVal = zhOut[key] || ''
    if (!enVal && !zhVal && b) {
      if (isZh(b)) { zhVal = b; enVal = await translateText(b, 'en') } else { enVal = b; zhVal = await translateText(b, 'zh') }
    } else if (!enVal && zhVal) {
      enVal = await translateText(zhVal, 'en')
    } else if (!zhVal && enVal) {
      zhVal = await translateText(enVal, 'zh')
    }
    enOut[key] = enVal
    zhOut[key] = zhVal
  }
  return { en: enOut, zh: zhOut }
}

async function fillPictureTranslationsBi(p: any): Promise<{ en: any; zh: any }> {
  const base = { title: p.title || '', subtitle: p.subtitle || '', description: p.description || '' }
  const enOut: any = { title: p.en?.title || '', subtitle: p.en?.subtitle || '', description: p.en?.description || '' }
  const zhOut: any = { title: p.zh?.title || '', subtitle: p.zh?.subtitle || '', description: p.zh?.description || '' }
  const isZh = (s?: string) => /[\u4e00-\u9fff]/.test(String(s || ''))
  for (const key of ['title', 'subtitle', 'description'] as const) {
    const b = base[key]
    let enVal = enOut[key] || ''
    let zhVal = zhOut[key] || ''
    if (!enVal && !zhVal && b) {
      if (isZh(b)) { zhVal = b; enVal = await translateText(b, 'en') } else { enVal = b; zhVal = await translateText(b, 'zh') }
    } else if (!enVal && zhVal) {
      enVal = await translateText(zhVal, 'en')
    } else if (!zhVal && enVal) {
      zhVal = await translateText(enVal, 'zh')
    }
    enOut[key] = enVal
    zhOut[key] = zhVal
  }
  return { en: enOut, zh: zhOut }
}

async function ensureTagIds(names: string[] = [], type: string = 'topic'): Promise<number[]> {
  const uniq = Array.from(new Set(names.map(n => String(n || '').trim()).filter(Boolean)))
  if (uniq.length === 0) return []
  const toInsert = uniq.map(name => ({ name, type, slug: `${type}:${name.toLowerCase().replace(/\s+/g, '-')}` }))
  await supabaseAdmin.from('tags').upsert(toInsert, { onConflict: 'slug' })
  const { data, error } = await supabaseAdmin.from('tags').select('id, name').in('name', uniq).eq('type', type)
  if (error) throw error
  return (data || []).map(d => d.id)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const idNum = Number(params.id)
    if (!idNum || Number.isNaN(idNum)) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 })
    }
    const payload = await request.json()

    // 预取旧 cover 与旧图片 URL（用于 R2 删除）
    const { data: existingSetRow } = await supabaseAdmin
      .from('picture_sets')
      .select('cover_image_url')
      .eq('id', idNum)
      .maybeSingle()
    const { data: existingPicRows } = await supabaseAdmin
      .from('pictures')
      .select('id,image_url,raw_image_url')
      .eq('picture_set_id', idNum)
    const oldPicUrlMap = new Map<number, { image_url?: string | null; raw_image_url?: string | null }>()
    for (const r of existingPicRows || []) {
      oldPicUrlMap.set((r as any).id, { image_url: (r as any).image_url, raw_image_url: (r as any).raw_image_url })
    }

    // 更新 picture_set 主表字段（描述类优先）
    const setRow = {
      title: payload.title || "",
      subtitle: payload.subtitle || "",
      description: payload.description || "",
      cover_image_url: payload.cover_image_url || null,
      position: payload.position || "up",
      is_published: payload.is_published ?? true,
      primary_category_id: payload.primary_category_id ?? null,
      season_id: payload.season_id ?? null,
    }
    const { error: updErr } = await supabaseAdmin
      .from("picture_sets")
      .update(setRow)
      .eq("id", idNum)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 })
    }

    // 可选：根据 set 的 flags 传播季节到图片
    let singleSeasonId: number | null = null
    const seasonIds: number[] = Array.isArray(payload.season_ids) ? payload.season_ids : []
    if (seasonIds.length === 1) singleSeasonId = seasonIds[0]
    const allowApplySetProps = !!(payload.fill_missing_from_set ?? payload.apply_set_props_to_pictures)
    const allowOverride = !!payload.override_existing_picture_props

    // 同步 pictures（更新/插入/删除缺失）
    const { data: existingPics, error: exErr } = await supabaseAdmin
      .from("pictures")
      .select("id")
      .eq("picture_set_id", idNum)
    if (exErr) {
      return NextResponse.json({ error: exErr.message }, { status: 400 })
    }
    const existingIds = new Set((existingPics || []).map((r: any) => r.id))

    const pictures: any[] = Array.isArray(payload.pictures) ? payload.pictures : []
    const payloadIds = new Set<number>()

    for (let i = 0; i < pictures.length; i++) {
      const p = pictures[i]
      if (typeof p.id === "number") payloadIds.add(p.id)
      const base: any = {
        title: p.title || "",
        subtitle: p.subtitle || "",
        description: p.description || "",
        season_id: (allowApplySetProps
          ? (allowOverride ? (singleSeasonId ?? p.season_id ?? null)
            : (p.season_id ?? (singleSeasonId ?? null)))
          : (p.season_id ?? null)),
        order_index: i,
      }
      if (typeof p.image_url === 'string' && p.image_url.length > 0) base.image_url = p.image_url
      if (typeof p.raw_image_url === 'string' && p.raw_image_url.length > 0) base.raw_image_url = p.raw_image_url
      if (p.id) {
        const { error } = await supabaseAdmin.from("pictures").update(base).eq("id", p.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        // 如果图片 URL 被替换，删除 R2 上旧文件
        try {
          const prev = oldPicUrlMap.get(p.id)
          const newCompressed = base.image_url as string | null
          const newRaw = base.raw_image_url as string | null
          if (prev) {
            if (prev.image_url && prev.image_url !== newCompressed) await deleteFromR2ByUrl(prev.image_url)
            if (prev.raw_image_url && prev.raw_image_url !== newRaw) await deleteFromR2ByUrl(prev.raw_image_url)
          }
        } catch {}
      } else {
        const row = { ...base, picture_set_id: idNum }
        const { data: ins, error } = await supabaseAdmin.from("pictures").insert(row).select('id').single()
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        // 新插入的图片也写入 picture_categories
        try {
          const pCatIdsRaw: number[] = Array.isArray(p.picture_category_ids) ? p.picture_category_ids : []
          const pCatIds = Array.from(new Set(pCatIdsRaw))
          if (ins?.id && pCatIds.length) {
            const rows = pCatIds.map((cid: number) => ({ picture_id: ins.id, category_id: cid, is_primary: false }))
            await supabaseAdmin.from('picture_categories').insert(rows)
          }
        } catch {}
      }
    }

    // 删除前端未提交的旧图片
    const toDelete = [...existingIds].filter((x) => !payloadIds.has(x))
    if (toDelete.length > 0) {
      // 先删除 R2 文件
      for (const pid of toDelete) {
        const prev = oldPicUrlMap.get(pid)
        if (prev?.image_url) await deleteFromR2ByUrl(prev.image_url)
        if (prev?.raw_image_url) await deleteFromR2ByUrl(prev.raw_image_url)
      }
      const { error: delErr } = await supabaseAdmin.from("pictures").delete().in("id", toDelete)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
    }

    // sections 赋值：读取现有 → 计算增删
    try {
      let desiredSectionIds: number[] = Array.isArray(payload.section_ids) ? Array.from(new Set(payload.section_ids)) : []
      const { data: secs } = await supabaseAdmin.from('sections').select('id,name')
      const findBy = (want: 'up' | 'down') => {
        const re = want === 'down' ? /\bdown\b|bottom|下|底/i : /\bup\b|top|上|顶/i
        return (secs || []).find((s: any) => re.test(String(s.name || '')))?.id as number | undefined
      }
      const pos = String(payload.position || '').trim().toLowerCase()
      const autoId = pos === 'down' ? findBy('down') : findBy('up')
      if (autoId && !desiredSectionIds.includes(autoId)) desiredSectionIds = [...desiredSectionIds, autoId]

      const { data: existingAssigns } = await supabaseAdmin
        .from('picture_set_section_assignments')
        .select('section_id')
        .eq('picture_set_id', idNum)
      const existingIds = new Set((existingAssigns || []).map((r: any) => r.section_id))
      const toAdd = desiredSectionIds.filter(id => !existingIds.has(id)).map(id => ({ picture_set_id: idNum, section_id: id, page_context: 'default', display_order: 0 }))
      const toRemove = [...existingIds].filter(id => !desiredSectionIds.includes(id))
      if (toAdd.length) await supabaseAdmin.from('picture_set_section_assignments').insert(toAdd)
      if (toRemove.length) await supabaseAdmin.from('picture_set_section_assignments').delete().eq('picture_set_id', idNum).in('section_id', toRemove)
    } catch {}

    // set 主位置：清空后重建（只保留一个主位置）
    try {
      const nm = (payload.primary_location_name || '').trim()
      const lat = typeof payload.primary_location_latitude === 'number' ? payload.primary_location_latitude : null
      const lng = typeof payload.primary_location_longitude === 'number' ? payload.primary_location_longitude : null
      if (nm && typeof lat === 'number' && typeof lng === 'number') {
        let locationId: number | undefined
        const { data: found } = await supabaseAdmin
          .from('locations')
          .select('id')
          .eq('name', nm)
          .eq('latitude', lat)
          .eq('longitude', lng)
          .maybeSingle()
        if (found?.id) locationId = found.id
        else {
          const { data: created, error: locErr } = await supabaseAdmin
            .from('locations')
            .insert({ name: nm, latitude: lat, longitude: lng })
            .select('id')
            .single()
          if (locErr) throw locErr
          locationId = created!.id
        }
        if (locationId) {
          await supabaseAdmin.from('picture_set_locations').delete().eq('picture_set_id', idNum)
          await supabaseAdmin.from('picture_set_locations').insert({ picture_set_id: idNum, location_id: locationId, is_primary: true })
        }
      }
    } catch {}

    // set 翻译：upsert en/zh
    try {
      if (payload.en) await supabaseAdmin.from('picture_set_translations').upsert({ picture_set_id: idNum, locale: 'en', title: payload.en?.title || '', subtitle: payload.en?.subtitle || null, description: payload.en?.description || null }, { onConflict: 'picture_set_id,locale' })
      if (payload.zh) await supabaseAdmin.from('picture_set_translations').upsert({ picture_set_id: idNum, locale: 'zh', title: payload.zh?.title || '', subtitle: payload.zh?.subtitle || null, description: payload.zh?.description || null }, { onConflict: 'picture_set_id,locale' })
    } catch {}

    // 若 cover 更换，删除旧 cover 文件
    try {
      const oldCover = (existingSetRow as any)?.cover_image_url as string | undefined
      const newCover = setRow.cover_image_url as string | null
      if (oldCover && oldCover !== newCover) await deleteFromR2ByUrl(oldCover)
    } catch {}

    // set 标签：topic + categories + seasons（计算差异后插入/删除）
    try {
      const topicTags: string[] = Array.isArray(payload.tags) ? payload.tags : []
      const topicIds = await ensureTagIds(topicTags, 'topic')
      let categoryTagIds: number[] = []
      const categoryIds: number[] = Array.isArray(payload.category_ids) ? payload.category_ids : []
      if (categoryIds.length > 0) {
        const { data: catRows } = await supabaseAdmin.from('categories').select('id,name').in('id', categoryIds)
        const names = (catRows || []).map((r: any) => r.name).filter(Boolean)
        categoryTagIds = await ensureTagIds(names, 'category')
      }
      let seasonTagIds: number[] = []
      if (seasonIds.length > 0) {
        const { data: seaRows } = await supabaseAdmin.from('seasons').select('id,name').in('id', seasonIds)
        const names = (seaRows || []).map((r: any) => r.name).filter(Boolean)
        seasonTagIds = await ensureTagIds(names, 'season')
      }
      const combined = Array.from(new Set([...(topicIds || []), ...(categoryTagIds || []), ...(seasonTagIds || [])]))

      const { data: existing } = await supabaseAdmin
        .from('picture_set_taggings')
        .select('tag_id')
        .eq('picture_set_id', idNum)
      const oldIds = new Set((existing || []).map((r: any) => r.tag_id))
      const newIds = new Set(combined)
      const toAdd = [...newIds].filter(id => !oldIds.has(id)).map(id => ({ picture_set_id: idNum, tag_id: id }))
      const toRemove = [...oldIds].filter(id => !newIds.has(id))
      if (toAdd.length) await supabaseAdmin.from('picture_set_taggings').insert(toAdd)
      if (toRemove.length) await supabaseAdmin.from('picture_set_taggings').delete().eq('picture_set_id', idNum).in('tag_id', toRemove)
    } catch {}

    // set categories（picture_set_categories）：按差异更新（并标记主分类）
    try {
      const desired: number[] = Array.isArray(payload.category_ids) ? Array.from(new Set(payload.category_ids)) : []
      const { data: existing } = await supabaseAdmin
        .from('picture_set_categories')
        .select('category_id')
        .eq('picture_set_id', idNum)
      const oldIds = new Set((existing || []).map((r: any) => r.category_id))
      const newIds = new Set(desired)
      const toAdd = [...newIds].filter(id => !oldIds.has(id)).map(id => ({ picture_set_id: idNum, category_id: id, is_primary: id === (payload.primary_category_id ?? null) }))
      const toRemove = [...oldIds].filter(id => !newIds.has(id))
      if (toAdd.length) await supabaseAdmin.from('picture_set_categories').insert(toAdd)
      if (toRemove.length) await supabaseAdmin.from('picture_set_categories').delete().eq('picture_set_id', idNum).in('category_id', toRemove)
      // 可选：同步 is_primary 状态
      if (payload.primary_category_id != null) {
        await supabaseAdmin.from('picture_set_categories').update({ is_primary: false }).eq('picture_set_id', idNum)
        await supabaseAdmin.from('picture_set_categories').update({ is_primary: true }).eq('picture_set_id', idNum).eq('category_id', payload.primary_category_id)
      }
    } catch {}

    // picture 翻译/标签/主位置（按 id 匹配）
    try {
      const propagateCategories = !!payload.propagate_categories_to_pictures
      const pictures: any[] = Array.isArray(payload.pictures) ? payload.pictures : []
      // 预取当前 set 的所有图片，建立 image_url -> id 的映射，便于新插入图片的后续处理
      const { data: allPicsNow } = await supabaseAdmin
        .from('pictures')
        .select('id,image_url')
        .eq('picture_set_id', idNum)
      const urlToId = new Map<string, number>()
      for (const r of allPicsNow || []) {
        if ((r as any).image_url) urlToId.set((r as any).image_url, (r as any).id)
      }
      // 预备 set 的 typed tags 供传播
      let setCategoryTagIds: number[] = []
      let setSeasonTagIds: number[] = []
      if (Array.isArray(payload.category_ids) && payload.category_ids.length) {
        const { data: catRows } = await supabaseAdmin.from('categories').select('id,name').in('id', payload.category_ids)
        const names = (catRows || []).map((r: any) => r.name).filter(Boolean)
        setCategoryTagIds = await ensureTagIds(names, 'category')
      }
      if (seasonIds.length) {
        const { data: seaRows } = await supabaseAdmin.from('seasons').select('id,name').in('id', seasonIds)
        const names = (seaRows || []).map((r: any) => r.name).filter(Boolean)
        setSeasonTagIds = await ensureTagIds(names, 'season')
      }
      for (const p of pictures) {
        let pid = p.id as number | undefined
        if (!pid && p.image_url && urlToId.has(p.image_url)) {
          pid = urlToId.get(p.image_url)
        }
        if (!pid) continue
        // 翻译
        if (p.en) await supabaseAdmin.from('picture_translations').upsert({ picture_id: pid, locale: 'en', title: p.en?.title || '', subtitle: p.en?.subtitle || null, description: p.en?.description || null }, { onConflict: 'picture_id,locale' })
        if (p.zh) await supabaseAdmin.from('picture_translations').upsert({ picture_id: pid, locale: 'zh', title: p.zh?.title || '', subtitle: p.zh?.subtitle || null, description: p.zh?.description || null }, { onConflict: 'picture_id,locale' })

        // 标签：topic + per-picture categories + 可选传播 set typed tags
        const pictureTopicTags: string[] = Array.isArray(p.tags) ? p.tags : []
        const pTopicIds = await ensureTagIds(pictureTopicTags, 'topic')
        let pCatTagIds: number[] = []
        const picCatIds = Array.isArray(p.picture_category_ids) ? p.picture_category_ids : []
        if (picCatIds.length) {
          const { data: catRows } = await supabaseAdmin.from('categories').select('id,name').in('id', picCatIds)
          const names = (catRows || []).map((r: any) => r.name).filter(Boolean)
          pCatTagIds = await ensureTagIds(names, 'category')
        } else if (propagateCategories) {
          pCatTagIds = Array.from(new Set([...(setCategoryTagIds || []), ...(setSeasonTagIds || [])]))
        }
        const combined = Array.from(new Set([...(pTopicIds || []), ...(pCatTagIds || [])]))
        // 对 picture_taggings 做集合替换
        const { data: existing } = await supabaseAdmin.from('picture_taggings').select('tag_id').eq('picture_id', pid)
        const oldIds = new Set((existing || []).map((r: any) => r.tag_id))
        const newIds = new Set(combined)
        const toAdd = [...newIds].filter(id => !oldIds.has(id)).map(id => ({ picture_id: pid, tag_id: id }))
        const toRemove = [...oldIds].filter(id => !newIds.has(id))
        if (toAdd.length) await supabaseAdmin.from('picture_taggings').insert(toAdd)
        if (toRemove.length) await supabaseAdmin.from('picture_taggings').delete().eq('picture_id', pid).in('tag_id', toRemove)

        // 主位置（若提供）
        const lnm = (p.location_name || '').trim()
        const llat = typeof p.location_latitude === 'number' ? p.location_latitude : null
        const llng = typeof p.location_longitude === 'number' ? p.location_longitude : null
        if (lnm && typeof llat === 'number' && typeof llng === 'number') {
          let locId: number | undefined
          const { data: found } = await supabaseAdmin
            .from('locations')
            .select('id')
            .eq('name', lnm)
            .eq('latitude', llat)
            .eq('longitude', llng)
            .maybeSingle()
          if (found?.id) locId = found.id
          else {
            const { data: created, error: locErr } = await supabaseAdmin
              .from('locations')
              .insert({ name: lnm, latitude: llat, longitude: llng })
              .select('id')
              .single()
            if (locErr) throw locErr
            locId = created!.id
          }
          if (locId) {
            // 允许一个主位置：直接插入（如需唯一可先删）
            await supabaseAdmin.from('picture_locations').insert({ picture_id: pid, location_id: locId, is_primary: true })
          }
        }

        // 分类（picture_categories）：按差异更新
        const pCats: number[] = Array.isArray(p.picture_category_ids) ? Array.from(new Set(p.picture_category_ids)) : []
        const { data: existingPC } = await supabaseAdmin
          .from('picture_categories')
          .select('category_id')
          .eq('picture_id', pid)
        const oldPC = new Set((existingPC || []).map((r: any) => r.category_id))
        const newPC = new Set(pCats)
        const toAddPC = [...newPC].filter(id => !oldPC.has(id)).map(id => ({ picture_id: pid, category_id: id, is_primary: false }))
        const toRemovePC = [...oldPC].filter(id => !newPC.has(id))
        if (toAddPC.length) await supabaseAdmin.from('picture_categories').insert(toAddPC)
        if (toRemovePC.length) await supabaseAdmin.from('picture_categories').delete().eq('picture_id', pid).in('category_id', toRemovePC)
      }
    } catch {}

    // 双向翻译：set 与 pictures（根据 base 和已填内容自动补全缺失的 en/zh）
    try {
      const filledSet = await fillSetTranslationsBi(payload)
      await supabaseAdmin
        .from('picture_set_translations')
        .upsert(
          { picture_set_id: idNum, locale: 'en', title: filledSet.en.title || '', subtitle: filledSet.en.subtitle || null, description: filledSet.en.description || null },
          { onConflict: 'picture_set_id,locale' },
        )
      await supabaseAdmin
        .from('picture_set_translations')
        .upsert(
          { picture_set_id: idNum, locale: 'zh', title: filledSet.zh.title || '', subtitle: filledSet.zh.subtitle || null, description: filledSet.zh.description || null },
          { onConflict: 'picture_set_id,locale' },
        )

      // 重新获取图片 id 按 order_index 对齐，用于新插入的图片
      const { data: picsNow } = await supabaseAdmin
        .from('pictures')
        .select('id,order_index')
        .eq('picture_set_id', idNum)
      const byIdx = new Map<number, number>()
      for (const r of picsNow || []) byIdx.set((r as any).order_index ?? 0, (r as any).id)

      const arr = Array.isArray(payload.pictures) ? payload.pictures : []
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i]
        const pid = (p?.id as number) || byIdx.get(i)
        if (!pid) continue
        const filledP = await fillPictureTranslationsBi(p)
        await supabaseAdmin
          .from('picture_translations')
          .upsert(
            { picture_id: pid, locale: 'en', title: filledP.en.title || '', subtitle: filledP.en.subtitle || null, description: filledP.en.description || null },
            { onConflict: 'picture_id,locale' },
          )
        await supabaseAdmin
          .from('picture_translations')
          .upsert(
            { picture_id: pid, locale: 'zh', title: filledP.zh.title || '', subtitle: filledP.zh.subtitle || null, description: filledP.zh.description || null },
            { onConflict: 'picture_id,locale' },
          )
      }
    } catch {}

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

// R2 删除工具（服务端直接删除）
const s3 = new S3Client({
  endpoint: process.env.R2_ENDPOINT_URL,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  }
})
async function deleteFromR2ByUrl(url: string) {
  try {
    const key = getObjectKeyFromUrl(url)
    if (!key) return
    const cmd = new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key })
    await s3.send(cmd)
  } catch {}
}

// 读取单个 set 的完整详情（服务端聚合，规避 RLS）
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const idNum = Number(params.id)
    if (!idNum || Number.isNaN(idNum)) {
      return NextResponse.json({ error: 'invalid id' }, { status: 400 })
    }

    const { data: setRow, error: setErr } = await supabaseAdmin
      .from('picture_sets')
      .select('*')
      .eq('id', idNum)
      .single()
    if (setErr) return NextResponse.json({ error: setErr.message }, { status: 400 })

    const { data: pics } = await supabaseAdmin
      .from('pictures')
      .select('*')
      .eq('picture_set_id', idNum)
      .order('order_index', { ascending: true })

    // translations for set
    const [{ data: tEn }, { data: tZh }] = await Promise.all([
      supabaseAdmin.from('picture_set_translations').select('*').eq('picture_set_id', idNum).eq('locale', 'en').maybeSingle(),
      supabaseAdmin.from('picture_set_translations').select('*').eq('picture_set_id', idNum).eq('locale', 'zh').maybeSingle(),
    ])

    // set typed tags (names) and categories
    const { data: setTagRows } = await supabaseAdmin
      .from('picture_set_taggings')
      .select('tags(name,type)')
      .eq('picture_set_id', idNum)
    const { data: setCats } = await supabaseAdmin
      .from('picture_set_categories')
      .select('category_id')
      .eq('picture_set_id', idNum)

    // set sections
    const { data: secAssigns } = await supabaseAdmin
      .from('picture_set_section_assignments')
      .select('section_id')
      .eq('picture_set_id', idNum)

    // set primary location
    const { data: setLocs } = await supabaseAdmin
      .from('picture_set_locations')
      .select('is_primary, locations(name,latitude,longitude)')
      .eq('picture_set_id', idNum)

    const picIds = (pics || []).map((p: any) => p.id)
    let pTransMap: Record<number, { en?: any; zh?: any }> = {}
    let pTagsMap: Record<number, string[]> = {}
    let pCatsMap: Record<number, number[]> = {}
    let pLocMap: Record<number, { name?: string; latitude?: number | null; longitude?: number | null }> = {}
    if (picIds.length) {
      const { data: pTrans } = await supabaseAdmin.from('picture_translations').select('*').in('picture_id', picIds)
      for (const t of pTrans || []) {
        const pid = (t as any).picture_id
        const entry = pTransMap[pid] || {}
        if ((t as any).locale === 'en') entry.en = { title: (t as any).title || '', subtitle: (t as any).subtitle || '', description: (t as any).description || '' }
        if ((t as any).locale === 'zh') entry.zh = { title: (t as any).title || '', subtitle: (t as any).subtitle || '', description: (t as any).description || '' }
        pTransMap[pid] = entry
      }
      const { data: pTags } = await supabaseAdmin
        .from('picture_taggings')
        .select('picture_id, tags(name,type)')
        .in('picture_id', picIds)
      for (const row of pTags || []) {
        const pid = (row as any).picture_id
        const name = (row as any).tags?.name
        const type = (row as any).tags?.type
        if (!pid || !name) continue
        // 仅回显 topic 类型到自由标签编辑框，避免把分类型标签混入
        if (type === 'topic') {
          pTagsMap[pid] = [...(pTagsMap[pid] || []), name]
        }
      }
      const { data: pCats } = await supabaseAdmin
        .from('picture_categories')
        .select('picture_id, category_id')
        .in('picture_id', picIds)
      for (const row of pCats || []) {
        const pid = (row as any).picture_id
        const cid = (row as any).category_id
        if (!pid || !cid) continue
        pCatsMap[pid] = [...(pCatsMap[pid] || []), cid]
      }
      const { data: pLocs } = await supabaseAdmin
        .from('picture_locations')
        .select('picture_id, is_primary, locations(name,latitude,longitude)')
        .in('picture_id', picIds)
      for (const row of pLocs || []) {
        const pid = (row as any).picture_id
        const loc = (row as any).locations
        if (!pid || !loc) continue
        const prev = pLocMap[pid]
        if (!prev || (row as any).is_primary) {
          pLocMap[pid] = { name: loc.name, latitude: loc.latitude, longitude: loc.longitude }
        }
      }
    }

    const enriched = {
      ...setRow,
      en: tEn ? { title: (tEn as any).title || '', subtitle: (tEn as any).subtitle || '', description: (tEn as any).description || '' } : undefined,
      zh: tZh ? { title: (tZh as any).title || '', subtitle: (tZh as any).subtitle || '', description: (tZh as any).description || '' } : undefined,
      // 仅回显 topic 类型的 set 标签
      tags: (setTagRows || [])
        .map((r: any) => (r as any).tags)
        .filter((t: any) => t && t.type === 'topic')
        .map((t: any) => t.name)
        .filter(Boolean),
      category_ids: (setCats || []).map((r: any) => r.category_id),
      section_ids: (secAssigns || []).map((r: any) => r.section_id),
      primary_location_name: (() => {
        const row = ((setLocs || []) as any[]).sort(
          (a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0),
        )[0] as any
        return row?.locations?.name || ''
      })(),
      primary_location_latitude: (() => {
        const row = ((setLocs || []) as any[])[0] as any
        return row?.locations?.latitude ?? null
      })(),
      primary_location_longitude: (() => {
        const row = ((setLocs || []) as any[])[0] as any
        return row?.locations?.longitude ?? null
      })(),
      pictures: (pics || []).map((p: any) => ({
        ...p,
        en: pTransMap[p.id]?.en,
        zh: pTransMap[p.id]?.zh,
        tags: pTagsMap[p.id] || [],
        picture_category_ids: pCatsMap[p.id] || [],
        location_name: pLocMap[p.id]?.name,
        location_latitude: pLocMap[p.id]?.latitude ?? null,
        location_longitude: pLocMap[p.id]?.longitude ?? null,
      })),
    }

    return NextResponse.json({ item: enriched })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

// 删除整个 set（服务端处理 R2 与 DB，规避 RLS）
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const idNum = Number(params.id)
    if (!idNum || Number.isNaN(idNum)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

    // 收集需要删除的 R2 文件
    const { data: setRow } = await supabaseAdmin.from('picture_sets').select('cover_image_url').eq('id', idNum).maybeSingle()
    const { data: pics } = await supabaseAdmin.from('pictures').select('id,image_url,raw_image_url').eq('picture_set_id', idNum)

    // 先删 R2 文件（容错）
    try {
      if (setRow?.cover_image_url) await deleteFromR2ByUrl(setRow.cover_image_url)
      for (const p of pics || []) {
        if ((p as any).image_url) await deleteFromR2ByUrl((p as any).image_url)
        if ((p as any).raw_image_url) await deleteFromR2ByUrl((p as any).raw_image_url)
      }
    } catch {}

    const picIds = (pics || []).map((p: any) => p.id)

    // 按依赖顺序删除从表
    if (picIds.length) {
      await supabaseAdmin.from('picture_taggings').delete().in('picture_id', picIds)
      await supabaseAdmin.from('picture_categories').delete().in('picture_id', picIds)
      await supabaseAdmin.from('picture_locations').delete().in('picture_id', picIds)
      await supabaseAdmin.from('picture_section_assignments').delete().in('picture_id', picIds)
    }
    await supabaseAdmin.from('picture_set_taggings').delete().eq('picture_set_id', idNum)
    await supabaseAdmin.from('picture_set_categories').delete().eq('picture_set_id', idNum)
    await supabaseAdmin.from('picture_set_locations').delete().eq('picture_set_id', idNum)
    await supabaseAdmin.from('picture_set_section_assignments').delete().eq('picture_set_id', idNum)
    await supabaseAdmin.from('picture_set_translations').delete().eq('picture_set_id', idNum)
    // 删除图片与 set
    await supabaseAdmin.from('pictures').delete().eq('picture_set_id', idNum)
    await supabaseAdmin.from('picture_sets').delete().eq('id', idNum)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
