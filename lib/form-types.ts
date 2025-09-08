import type { PictureSet } from "./pictureSet.types"

// Define shared form data types to be used across components
export interface PictureFormData {
  id?: number
  tempId?: string
  title: string
  subtitle: string
  description: string
  cover?: File | null
  image_url?: string
  raw_image_url?: string
  previewUrl?: string
  originalSize?: number
  compressedSize?: number
  compressedFile?: File | null
  // per-picture season & location
  season_id?: number | null
  location_name?: string
  location_latitude?: number | null
  location_longitude?: number | null
  // optional per-picture extensions (not yet wired end-to-end)
  en?: LocaleTexts
  zh?: LocaleTexts
  tags?: string[]
}

export interface PictureSetFormData {
  title: string
  subtitle: string
  description: string
  cover_image_url: string
  position: string
  pictures: PictureFormData[]
  // new editable fields
  is_published?: boolean
  primary_category_id?: number | null
  season_id?: number | null
  // multi-select (editor-facing)
  category_ids?: number[]
  season_ids?: number[]
  section_ids?: number[]
  // simple primary location editor values
  primary_location_name?: string
  primary_location_latitude?: number | null
  primary_location_longitude?: number | null
  // translations and tags
  en?: LocaleTexts
  zh?: LocaleTexts
  tags?: string[]
}

export interface PictureSetSubmitData extends Omit<PictureSet, "id" | "created_at" | "updated_at" | "pictures"> {
  pictures: Omit<PictureFormData, "cover" | "previewUrl" | "originalSize" | "compressedSize" | "compressedFile">[]
  en?: LocaleTexts
  zh?: LocaleTexts
  tags?: string[]
}

export interface LocaleTexts {
  title?: string
  subtitle?: string
  description?: string
}
