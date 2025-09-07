import type { PictureSet } from "./pictureSet.types"

// Define shared form data types to be used across components
export interface PictureFormData {
  id?: number
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
