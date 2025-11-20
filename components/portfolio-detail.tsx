"use client"

import { ArrowLeft } from "lucide-react"
import Image from "next/image"
import { useState, useEffect, useCallback } from "react"
import { Carousel } from "@/components/carousel"
import { ImageDetails } from "@/components/image-details"
import { LangSwitcher } from "@/components/lang-switcher"
import { useI18n } from "@/lib/i18n"
import { useRouter, useSearchParams } from "next/navigation"

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

interface PortfolioLocation {
  id?: number | string
  isPrimary?: boolean | null
  name?: string | null
  name_en?: string | null
  name_zh?: string | null
  latitude?: number | null
  longitude?: number | null
}

interface PortfolioDetailProps {
  id: string
  images: ImageItem[]
  translations: {
    en: LocalizedContent
    zh: LocalizedContent
  }
  locations?: PortfolioLocation[]
}

export default function PortfolioDetail({ images, translations, locations = [] }: PortfolioDetailProps) {
  const searchParams = useSearchParams()
  const initialIndex = parseInt(searchParams.get('index') || '0', 10)
  const styleParam = searchParams.get('style') // 获取风格参数
  const [currentIndex, setCurrentIndex] = useState(Math.max(0, Math.min(initialIndex, images.length - 1)));
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [descriptionHovered, setDescriptionHovered] = useState(false);
  const { locale } = useI18n()
  const router = useRouter()
  const bucketUrl = process.env.NEXT_PUBLIC_BUCKET_URL || 'https://s3.cunyli.top'
  
  const currentImage = images[currentIndex];

  const activeSetContent = locale === 'zh' ? translations.zh : translations.en
  const fallbackSetContent = locale === 'zh' ? translations.en : translations.zh
  const displayTitle = activeSetContent.title || fallbackSetContent.title || ''
  const displaySubtitle = activeSetContent.subtitle || fallbackSetContent.subtitle || ''
  const displayDescription = activeSetContent.description || fallbackSetContent.description || ''

  const activeImageContent = locale === 'zh' ? currentImage?.translations.zh : currentImage?.translations.en
  const fallbackImageContent = locale === 'zh' ? currentImage?.translations.en : currentImage?.translations.zh
  const displayImageTitle = activeImageContent?.title || fallbackImageContent?.title || ''
  const displayImageSubtitle = activeImageContent?.subtitle || fallbackImageContent?.subtitle || ''
  const displayImageDescription = activeImageContent?.description || fallbackImageContent?.description || ''
  const locationBadges = (locations || []).map((loc, index) => {
    const preferred =
      locale === 'zh'
        ? loc.name_zh || loc.name || loc.name_en
        : loc.name_en || loc.name || loc.name_zh
    const label = (preferred && preferred.toString().trim().length > 0)
      ? preferred.toString().trim()
      : locale === 'zh'
        ? '未标记地点'
        : 'Untitled Location'
    return {
      key: loc.id ?? `loc-${index}`,
      label,
      isPrimary: Boolean(loc.isPrimary),
    }
  })

  const handleImageChange = (index: number) => {
    setCurrentIndex(index)
  }

  const handleBack = useCallback(() => {
    // 如果有风格参数，返回到首页并自动打开对应的风格弹窗
    if (styleParam) {
      router.push(`/?style=${styleParam}`)
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }, [router, styleParam])


  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        const newIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1
        setCurrentIndex(newIndex)
      } else if (e.key === "ArrowRight") {
        const newIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1
        setCurrentIndex(newIndex)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentIndex, images.length])

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-white via-[#f8f6f1] to-[#eaf0ff] text-gray-900">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_45%)]" />
      <div className="relative flex min-h-screen flex-col px-3 sm:px-6 lg:px-10 2xl:px-16 py-4">
        <div className="w-full max-w-[2400px] mx-auto flex flex-col gap-6">
          {/* Header with back button and summary */}
          <header className="sticky top-0 z-40 border border-gray-200/70 bg-white/90 rounded-3xl px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:px-5 space-y-2">
            <div className="relative flex flex-wrap items-center justify-between gap-3 text-gray-600">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:text-black"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {locale === 'zh' ? '返回' : 'Back'}
              </button>
              <div className="flex items-center gap-2">
                {displayDescription && (
                  <div
                    className="relative inline-flex"
                    onMouseEnter={() => setDescriptionHovered(true)}
                    onMouseLeave={() => setDescriptionHovered(false)}
                    onClick={(event) => {
                      event.preventDefault()
                      setDescriptionHovered((prev) => !prev)
                    }}
                  >
                    <div className="inline-flex items-center rounded-full border border-gray-200/70 bg-white/70 px-4 py-2 text-xs font-semibold text-gray-600 shadow-sm">
                      <span className="uppercase tracking-[0.35em] text-gray-500">
                        {locale === "zh" ? "作品集简介" : "Set Description"}
                      </span>
                    </div>
                    <div
                      className={`absolute top-full z-30 mt-2 w-[min(18rem,calc(100vw-2.5rem))] rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs leading-relaxed text-gray-600 shadow-xl transition-all duration-200 ${
                        descriptionHovered ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-1"
                      } lg:left-1/2 lg:-translate-x-1/2 lg:w-72`}
                    >
                      <p className="whitespace-pre-line">{displayDescription}</p>
                    </div>
                  </div>
                )}
                <span className="rounded-full border border-gray-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-gray-600">
                  {currentIndex + 1}/{images.length}
                </span>
                <LangSwitcher className="h-8 w-8 text-gray-600 bg-white border border-gray-200 shadow-sm" />
              </div>
              {(displayTitle || displaySubtitle) && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center px-4">
                {displayTitle && (
                  <span className="text-base font-light text-gray-900 leading-tight truncate max-w-[65vw] sm:text-lg">
                      {displayTitle}
                    </span>
                  )}
                  {displaySubtitle && (
                    <span className="text-xs text-gray-500 truncate max-w-[70vw]">{displaySubtitle}</span>
                  )}
                </div>
              )}
            </div>
            {locationBadges.length > 0 && (
              <div className="flex flex-wrap gap-2 lg:hidden">
                {locationBadges.map((badge) => (
                  <span
                    key={badge.key}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-xs font-semibold text-emerald-900 shadow-sm"
                  >
                    <span className={`h-2 w-2 rounded-full ${badge.isPrimary ? "bg-emerald-500" : "bg-emerald-300"}`} />
                    {badge.label}
                    {badge.isPrimary && (
                      <span className="text-[9px] uppercase tracking-[0.35em] text-emerald-600">
                        {locale === 'zh' ? '主' : 'Primary'}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </header>

        {/* Main content area */}
        <main className="flex flex-1 flex-col">
          {/* Image gallery section */}
          <div className="flex flex-1 flex-col gap-6">
            {/* Main image and overlay */}
            <div className="flex flex-col w-full">
              <div className="relative">
                <div className="relative w-full min-h-[520px] h-[75vh] lg:h-[82vh] 2xl:h-[86vh] flex items-center justify-center rounded-[36px] overflow-hidden border border-white/30 bg-white/10 shadow-2xl backdrop-blur">
                  <Carousel
                    images={images}
                    currentIndex={currentIndex}
                    onChangeImage={handleImageChange}
                    showThumbnails={false}
                  />
                </div>
                <div
                  className="hidden lg:flex absolute inset-y-0 right-0 translate-x-12 items-center"
                  onMouseEnter={() => setSidebarHovered(true)}
                  onMouseLeave={() => setSidebarHovered(false)}
                >
                  <div
                    className={`transition-all duration-300 ${
                      sidebarHovered ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"
                    }`}
                  >
                    <div className="flex h-28 w-10 flex-col items-center justify-center rounded-full bg-white/90 px-1 py-2 text-[11px] font-semibold tracking-[0.3em] text-gray-600 shadow-lg">
                      <span className="-rotate-90">
                        {locale === "zh" ? "缩略图" : "GALLERY"}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`absolute top-1/2 right-0 -translate-y-1/2 w-[320px] origin-right transform transition-all duration-500 ${
                      sidebarHovered ? "opacity-100 scale-100 translate-x-0" : "opacity-0 scale-95 translate-x-6 pointer-events-none"
                    }`}
                  >
                    <div className="rounded-[28px] border border-gray-200/80 bg-white/95 backdrop-blur-md shadow-2xl">
                      <div className="border-b border-gray-200/70 px-6 py-5 space-y-3">
                        <ImageDetails image={currentImage} />
                        {displayImageDescription && (
                          <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">
                            {displayImageDescription}
                          </p>
                        )}
                        <div>
                          <p className="text-xs uppercase tracking-[0.35em] text-gray-500">
                            {locale === "zh" ? "拍摄地点" : "Locations"}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {locationBadges.map((badge) => (
                              <span
                                key={`overlay-${badge.key}`}
                                className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1.5 text-xs font-semibold text-emerald-900 shadow-sm"
                              >
                                <span className={`h-2 w-2 rounded-full ${badge.isPrimary ? "bg-emerald-500" : "bg-emerald-300"}`} />
                                {badge.label}
                                {badge.isPrimary && (
                                  <span className="text-[9px] uppercase tracking-[0.35em] text-emerald-600">
                                    {locale === "zh" ? "主" : "Primary"}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="max-h-[360px] overflow-y-auto custom-scrollbar p-6">
                        <div className="mb-4 flex items-center justify-between text-sm font-semibold text-gray-700">
                          <span>{locale === "zh" ? "缩略图" : "Gallery"}</span>
                          <span>{images.length}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {images.map((image, index) => (
                            <button
                              key={index}
                              onClick={() => handleImageChange(index)}
                              className={`aspect-square overflow-hidden rounded-lg border-2 transition-all duration-200 hover:scale-105 relative ${
                                index === currentIndex
                                  ? "border-black ring-2 ring-black/20 scale-105 shadow-lg"
                                  : "border-transparent hover:border-gray-300 hover:shadow-md"
                              }`}
                            >
                              <Image
                                src={image.url ? bucketUrl + image.url : "/placeholder.svg"}
                                alt={`Thumbnail ${index + 1}`}
                                fill
                                sizes="120px"
                                className="object-cover w-full h-full"
                                loading="lazy"
                              />
                              <div
                                className={`absolute inset-0 bg-black/10 pointer-events-none ${
                                  index === currentIndex ? "opacity-100" : "opacity-0"
                                }`}
                                style={{ transition: "opacity 0.3s cubic-bezier(0.23, 1, 0.32, 1)" }}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile info block */}
          <div className="mt-6 space-y-3 lg:hidden">
            <ImageDetails image={currentImage} />

            {displayImageDescription && (
              <div className="rounded-2xl border border-gray-200 bg-white/80 px-4 py-4 text-sm text-gray-700 shadow-sm">
                <p className="leading-relaxed whitespace-pre-line">{displayImageDescription}</p>
              </div>
            )}
          </div>

          {/* Mobile thumbnails section */}
          <div className="lg:hidden mt-4">
            <button 
              onClick={() => setShowThumbnails(!showThumbnails)}
              className="text-sm text-gray-600 hover:text-black smooth-transition mb-3 flex items-center hover:translate-x-1"
            >
              {showThumbnails ? 'Hide' : 'Show'} Gallery ({images.length})
              <span className={`ml-2 transform smooth-transition ${showThumbnails ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            
            <div className={`overflow-hidden smooth-transition-slow ${showThumbnails ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pb-4">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => handleImageChange(index)}
                    className={`aspect-square overflow-hidden rounded-md border-2 smooth-transition hover:scale-105 gpu-accelerated ${
                      index === currentIndex ? "border-black ring-2 ring-black ring-opacity-20 scale-105" : "border-transparent hover:border-gray-300"
                    }`}
                    style={{ 
                      transitionDelay: showThumbnails ? `${index * 30}ms` : '0ms',
                      animationDelay: showThumbnails ? `${index * 30}ms` : '0ms'
                    }}
                  >
                    <Image
                      src={image.url ? (bucketUrl + image.url) : "/placeholder.svg"}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 25vw, (max-width: 1200px) 16vw, 16vw"
                      className="object-cover w-full h-full smooth-transition hover:scale-110"
                      priority={index < 8} // 预加载前8张图片
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

    </div>
  </div>
  )
}
