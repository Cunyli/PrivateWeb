"use client"

import { useI18n } from "@/lib/i18n"

interface LocalizedContent {
  title?: string
  subtitle?: string
  description?: string
}

interface ImageItem {
  translations: {
    en: LocalizedContent
    zh: LocalizedContent
  }
}

interface ImageDetailsProps {
  image: ImageItem
}

export function ImageDetails({ image }: ImageDetailsProps) {
  const { locale } = useI18n()
  const primary = locale === 'zh' ? image.translations.zh : image.translations.en
  const secondary = locale === 'zh' ? image.translations.en : image.translations.zh

  const title = primary.title || secondary.title || ''
  const subtitle = primary.subtitle || secondary.subtitle || ''

  // If there's no title or subtitle to display, return null
  if (!title && !subtitle) {
    return null
  }

  return (
    <div className="py-2">
      <div className="flex flex-wrap items-baseline gap-x-4">
        {title && <h2 className="text-xl font-bold">{title}</h2>}
        {subtitle && <h3 className="text-lg text-gray-600">{subtitle}</h3>}
      </div>
    </div>
  )
}
