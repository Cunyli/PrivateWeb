import type { StyleApiResponse } from "./photography-style-previews"
import type { PictureSet } from "@/lib/pictureSet.types"

export interface InitialPortfolioPayload {
  stylePreviews?: Record<string,StyleApiResponse>
  pictureSets: PictureSet[]
  transMap: Record<number, { en?: { title?: string; subtitle?: string; description?: string }; zh?: { title?: string; subtitle?: string; description?: string } }>
  setLocations: Record<number, { name?: string | null; name_en?: string | null; name_zh?: string | null; latitude: number; longitude: number }>
  upSets: PictureSet[]
  downSets: PictureSet[]
}
