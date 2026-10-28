import photoData from "@/data/portfolio-editorial-photos.json"
import type { EditorialIndex, EditorialTranslations } from "./portfolio-editorial"

const photographs = photoData.photographs as EditorialIndex

export function photoEditorial(id: number | string): EditorialTranslations | undefined {
  return photographs[String(id)]
}
