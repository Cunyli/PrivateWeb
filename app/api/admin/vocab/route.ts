import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

export async function GET() {
  try {
    const [{ data: cats, error: ce }, { data: seas, error: se }, { data: secs, error: sxe }] = await Promise.all([
      supabaseAdmin.from('categories').select('id,name').order('name', { ascending: true }),
      supabaseAdmin.from('seasons').select('id,name').order('id', { ascending: true }),
      supabaseAdmin.from('sections').select('id,name,display_order').order('display_order', { ascending: true })
    ])
    if (ce) return NextResponse.json({ error: ce.message }, { status: 400 })
    if (se) return NextResponse.json({ error: se.message }, { status: 400 })
    if (sxe) return NextResponse.json({ error: sxe.message }, { status: 400 })
    return NextResponse.json({ categories: cats || [], seasons: seas || [], sections: secs || [] })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

