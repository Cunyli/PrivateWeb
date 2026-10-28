import "server-only"
import { unstable_cache } from "next/cache"
import { supabaseAdmin } from "@/utils/supabaseAdmin"
import type { CurationVisibility } from "./photo-curation"

export const photoCurationTag = "portfolio-photo-curation"
export const getPhotoCurationVisibility = unstable_cache(async (): Promise<CurationVisibility> => {
  const { data, error } = await supabaseAdmin.rpc("portfolio_curation_public_state")
  if (error) throw new Error(`Curation visibility unavailable: ${error.code}`)
  return { ids: data?.ids || [], keptPortraits: data?.kept_portraits || [] }
}, ["portfolio-photo-curation-v1"], { tags: [photoCurationTag], revalidate: 300 })
