import { createClient } from "@supabase/supabase-js"

// 使用服务端 key 创建 admin client（需要在部署环境配置 SUPABASE_SERVICE_ROLE_KEY）。
// 如果未配置，则回退到 anon key（可能因 RLS 无法写入）。
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl) {
  console.warn("[supabaseAdmin] Missing NEXT_PUBLIC_SUPABASE_URL")
}
if (!serviceKey) {
  console.warn("[supabaseAdmin] Missing SUPABASE_SERVICE_ROLE_KEY, falling back to anon key. Writes may fail due to RLS.")
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceKey || (anonKey as string),
)

