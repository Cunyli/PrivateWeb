import "server-only"
import { unstable_cache } from "next/cache"
import { supabaseAdmin } from "@/utils/supabaseAdmin"
import { catalogVisibility } from "./photo-curation-catalog"
import type { CurationCatalog } from "./photo-curation-catalog"

export const photoCurationTag = "portfolio-photo-curation"
export const getPhotoCurationCatalog = unstable_cache(async (): Promise<CurationCatalog> => {
  const { data, error } = await supabaseAdmin.rpc("portfolio_curation_catalog")
  if (error) throw new Error(`Curation catalog unavailable: ${error.code}`)
  return { ids:data?.ids || [],photos:data?.photos || [],assets:data?.assets || [] }
}, ["portfolio-photo-curation-catalog-v2"], { tags: [photoCurationTag], revalidate: 300 })

export const getPhotoCurationVisibility = async () => catalogVisibility(await getPhotoCurationCatalog())
