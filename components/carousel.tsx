"use client"

import * as React from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"

interface LocalizedContent {
  title?: string
  subtitle?: string
  description?: string
}

interface ImageItem {
  url: string
  rawUrl?: string | null
  translations: {
    en: LocalizedContent
    zh: LocalizedContent
  }
}

interface CarouselProps {
  images: ImageItem[]
  currentIndex: number
  onChangeImage: (index: number) => void
  showThumbnails?: boolean
}

export function Carousel({ images, currentIndex, onChangeImage, showThumbnails = true }: CarouselProps) {
  const { t, locale } = useI18n()
  const primaryLocale = locale === 'zh' ? 'zh' : 'en'
  const secondaryLocale = primaryLocale === 'zh' ? 'en' : 'zh'
  const bucketUrl = React.useMemo(() => process.env.NEXT_PUBLIC_BUCKET_URL || 'https://s3.cunyli.top', [])
  
  const goToPrevious = () => {
    const isFirstImage = currentIndex === 0
    const newIndex = isFirstImage ? images.length - 1 : currentIndex - 1
    onChangeImage(newIndex)
  }

  const goToNext = () => {
    const isLastImage = currentIndex === images.length - 1
    const newIndex = isLastImage ? 0 : currentIndex + 1
    onChangeImage(newIndex)
  }

  const handleOpenOriginal = () => {
    if (images[currentIndex].rawUrl) {
      window.open(bucketUrl + images[currentIndex].rawUrl, "_blank")
    }
  }

  if (!images || images.length === 0) {
    return <div>{t('noPictures') || 'No images'}</div>
  }

  const activeImage = images[currentIndex]
  const activeText = activeImage.translations[primaryLocale]
  const fallbackText = activeImage.translations[secondaryLocale]
  const computedAlt = activeText.title || fallbackText.title || "Portfolio image"

  return (
    <div className="flex flex-col w-full h-full">
      {/* Main image container */}
      <div
        className="flex-1 flex items-center justify-center w-full relative group"
      >
        {/* Image wrapper */}
        <div className="w-full h-full flex items-center justify-center relative">
          <Image
            src={activeImage.url ? (bucketUrl + activeImage.url) : "/placeholder.svg"}
            alt={computedAlt}
            fill
            className="object-contain corner-lg smooth-transition"
            priority
          />

          {/* Download original button - appears on hover */}
          {activeImage.rawUrl && (
            <Button
              variant="secondary"
              onClick={handleOpenOriginal}
              className="absolute bottom-4 right-4 bg-white/80 hover:bg-white shadow-md z-10 opacity-0 group-hover:opacity-100 smooth-transition transform translate-y-2 group-hover:translate-y-0"
            >
              <Download className="h-4 w-4 mr-2" />
              {t('viewOriginal') || 'View Original'}
            </Button>
          )}

          {/* Navigation buttons */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/50 hover:bg-white/75 rounded-full p-2 opacity-0 group-hover:opacity-100 smooth-transition transform -translate-x-2 group-hover:translate-x-0"
            onClick={goToPrevious}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/50 hover:bg-white/75 rounded-full p-2 opacity-0 group-hover:opacity-100 smooth-transition transform translate-x-2 group-hover:translate-x-0"
            onClick={goToNext}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Horizontal thumbnail carousel - only shown if showThumbnails is true */}
      {showThumbnails && (
        <div className="mt-2 overflow-x-auto">
          <div className="flex gap-2 py-2">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => onChangeImage(index)}
                className={`flex-none w-24 aspect-[16/9] overflow-hidden rounded-md border-2 smooth-transition hover:scale-105 gpu-accelerated ${
                  index === currentIndex ? "border-black ring-2 ring-black ring-opacity-20 scale-105" : "border-transparent hover:border-gray-300"
                }`}
              >
                <Image
                  src={image.url ? (bucketUrl + image.url) : "/placeholder.svg"}
                  alt={`Thumbnail ${index + 1}`}
                  width={96}
                  height={54}
                  className="object-cover w-full h-full smooth-transition hover:scale-110"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
