import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const idNum = Number(ctx.params.id)
    if (!Number.isFinite(idNum) || idNum <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const { data: setRow, error: setErr } = await supabaseAdmin
      .from('picture_sets')
      .select('*')
      .eq('id', idNum)
      .single()
    if (setErr || !setRow) return NextResponse.json({ error: setErr?.message || 'Not found' }, { status: 404 })

    // Set translations
    const [{ data: enT }, { data: zhT }] = await Promise.all([
      supabaseAdmin.from('picture_set_translations').select('title,subtitle,description').eq('picture_set_id', idNum).eq('locale','en').maybeSingle(),
      supabaseAdmin.from('picture_set_translations').select('title,subtitle,description').eq('picture_set_id', idNum).eq('locale','zh').maybeSingle(),
    ])

    // Set sections and categories
    const [{ data: secAssigns }, { data: catAssigns }] = await Promise.all([
      supabaseAdmin.from('picture_set_section_assignments').select('section_id').eq('picture_set_id', idNum),
      supabaseAdmin.from('picture_set_categories').select('category_id').eq('picture_set_id', idNum),
    ])
    const section_ids = (secAssigns || []).map(r => (r as any).section_id as number)
    const category_ids = (catAssigns || []).map(r => (r as any).category_id as number)

    // Set primary location (avoid nested select for maximum compatibility)
    let primary_location_name: string | undefined = undefined
    let primary_location_latitude: number | null = null
    let primary_location_longitude: number | null = null
    const { data: setLocRow } = await supabaseAdmin
      .from('picture_set_locations')
      .select('location_id')
      .eq('picture_set_id', idNum)
      .eq('is_primary', true)
      .maybeSingle()
    const setLocationId = (setLocRow as any)?.location_id as number | undefined
    if (setLocationId) {
      const { data: loc } = await supabaseAdmin
        .from('locations')
        .select('name,latitude,longitude')
        .eq('id', setLocationId)
        .maybeSingle()
      if (loc) {
        primary_location_name = (loc as any).name as string | undefined
        primary_location_latitude = (loc as any).latitude ?? null
        primary_location_longitude = (loc as any).longitude ?? null
      }
    }

    // Set tags (topics only)
    const { data: setTagRows } = await supabaseAdmin
      .from('picture_set_taggings')
      .select('tag_id')
      .eq('picture_set_id', idNum)
    let setTags: string[] = []
    if (setTagRows && setTagRows.length) {
      const tagIds = Array.from(new Set((setTagRows as any[]).map(r => (r as any).tag_id).filter(Boolean)))
      if (tagIds.length) {
        const { data: tags } = await supabaseAdmin
          .from('tags')
          .select('id,name,type')
          .in('id', tagIds)
        setTags = (tags || [])
          .filter((t: any) => String(t.type || '') === 'topic')
          .map((t: any) => String(t.name || ''))
          .filter(Boolean)
      }
    }

    // Pictures
    const { data: pictures, error: picErr } = await supabaseAdmin
      .from('pictures')
      .select('*')
      .eq('picture_set_id', idNum)
      .order('order_index', { ascending: true })
    if (picErr) return NextResponse.json({ error: picErr.message }, { status: 400 })
    const picIds = (pictures || []).map(p => p.id)

    const [pen, pzh, pcat, ptagRows, pLocRows] = await Promise.all([
      supabaseAdmin.from('picture_translations').select('picture_id,title,subtitle,description').eq('locale','en').in('picture_id', picIds),
      supabaseAdmin.from('picture_translations').select('picture_id,title,subtitle,description').eq('locale','zh').in('picture_id', picIds),
      supabaseAdmin.from('picture_categories').select('picture_id,category_id').in('picture_id', picIds),
      supabaseAdmin.from('picture_taggings').select('picture_id,tag_id').in('picture_id', picIds),
      supabaseAdmin.from('picture_locations').select('picture_id,location_id').eq('is_primary', true).in('picture_id', picIds),
    ])

    const enMap: Record<number, any> = {}
    for (const r of pen.data || []) enMap[(r as any).picture_id] = { title: (r as any).title || '', subtitle: (r as any).subtitle || '', description: (r as any).description || '' }
    const zhMap: Record<number, any> = {}
    for (const r of pzh.data || []) zhMap[(r as any).picture_id] = { title: (r as any).title || '', subtitle: (r as any).subtitle || '', description: (r as any).description || '' }
    const catMap: Record<number, number[]> = {}
    for (const r of pcat.data || []) {
      const pid = (r as any).picture_id as number
      const cid = (r as any).category_id as number
      catMap[pid] = Array.from(new Set([...(catMap[pid] || []), cid]))
    }
    const tagMap: Record<number, string[]> = {}
    if (ptagRows.data && ptagRows.data.length) {
      const tagIds = Array.from(new Set((ptagRows.data as any[]).map(r => (r as any).tag_id).filter(Boolean)))
      const { data: tags } = await supabaseAdmin.from('tags').select('id,name,type').in('id', tagIds)
      const tagNameById: Record<number, { name: string; type: string }> = {}
      for (const t of tags || []) tagNameById[(t as any).id] = { name: String((t as any).name || ''), type: String((t as any).type || '') }
      for (const r of ptagRows.data) {
        const pid = (r as any).picture_id as number
        const tinfo = tagNameById[(r as any).tag_id]
        if (!tinfo || tinfo.type !== 'topic' || !tinfo.name) continue
        tagMap[pid] = Array.from(new Set([...(tagMap[pid] || []), tinfo.name]))
      }
    }
    const locMap: Record<number, { name?: string; latitude?: number | null; longitude?: number | null }> = {}
    if (pLocRows.data && pLocRows.data.length) {
      const locIds = Array.from(new Set((pLocRows.data as any[]).map(r => (r as any).location_id).filter(Boolean)))
      const { data: locs } = await supabaseAdmin.from('locations').select('id,name,latitude,longitude').in('id', locIds)
      const byId: Record<number, any> = {}
      for (const l of locs || []) byId[(l as any).id] = l
      for (const r of pLocRows.data) {
        const pid = (r as any).picture_id as number
        const l = byId[(r as any).location_id]
        if (l) locMap[pid] = { name: l.name, latitude: l.latitude ?? null, longitude: l.longitude ?? null }
      }
    }

    const pictureOut = (pictures || []).map((p: any) => ({
      id: p.id,
      picture_set_id: p.picture_set_id,
      order_index: p.order_index,
      title: p.title || '',
      subtitle: p.subtitle || '',
      description: p.description || '',
      image_url: p.image_url || '',
      raw_image_url: p.raw_image_url || '',
      season_id: p.season_id ?? null,
      location_name: locMap[p.id]?.name || '',
      location_latitude: locMap[p.id]?.latitude ?? null,
      location_longitude: locMap[p.id]?.longitude ?? null,
      picture_category_ids: catMap[p.id] || [],
      tags: tagMap[p.id] || [],
      en: enMap[p.id] || { title: '', subtitle: '', description: '' },
      zh: zhMap[p.id] || { title: '', subtitle: '', description: '' },
    }))

    const item = {
      ...setRow,
      section_ids,
      category_ids,
      primary_location_name,
      primary_location_latitude,
      primary_location_longitude,
      en: enT || { title: '', subtitle: '', description: '' },
      zh: zhT || { title: '', subtitle: '', description: '' },
      tags: setTags,
      pictures: pictureOut,
    }

    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
