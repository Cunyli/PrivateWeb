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
  const description = primary.description || secondary.description || ''

  // If there's no content to display, return null
  if (!title && !subtitle && !description) {
    return null
  }

  return (
    <div className="py-2">
      <div className="flex flex-wrap items-baseline gap-x-4">
        {title && <h2 className="text-xl font-bold">{title}</h2>}
        {subtitle && <h3 className="text-lg text-gray-600">{subtitle}</h3>}
      </div>
      {description && <p className="text-gray-700 mt-2">{description}</p>}
    </div>
  )
}
