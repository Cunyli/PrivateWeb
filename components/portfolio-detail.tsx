"use client"

import { ArrowLeft, ChevronDown, Grid, Info } from "lucide-react"
import Image from "next/image"
import { useState, useEffect, useCallback } from "react"
import { Carousel } from "@/components/carousel"
import { useI18n } from "@/lib/i18n"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

interface LocalizedContent {
  title?: string
  subtitle?: string
  description?: string
}

interface ImageItem {
  url: string
  rawUrl?: string | null
  setId?: number | string | null
  translations: {
    en: LocalizedContent
    zh: LocalizedContent
  }
}

interface PortfolioDetailProps {
  id: string
  images: ImageItem[]
  translations: {
    en: LocalizedContent
    zh: LocalizedContent
  }
  locations?: unknown[]
}

export default function PortfolioDetail({ images, translations, locations = [] }: PortfolioDetailProps) {
  const searchParams = useSearchParams()
  const initialIndex = parseInt(searchParams.get('index') || '0', 10)
  const styleParam = searchParams.get('style') // 获取风格参数
  const [currentIndex, setCurrentIndex] = useState(Math.max(0, Math.min(initialIndex, images.length - 1)));
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const { locale } = useI18n()
  const router = useRouter()
  const bucketUrl = process.env.NEXT_PUBLIC_BUCKET_URL || 'https://s3.cunyli.top'
  const currentImage = images[currentIndex]

  const activeSetContent = locale === 'zh' ? translations.zh : translations.en
  const fallbackSetContent = locale === 'zh' ? translations.en : translations.zh
  const displayTitle = activeSetContent.title || fallbackSetContent.title || ''
  const displaySubtitle = activeSetContent.subtitle || fallbackSetContent.subtitle || ''
  const displayDescription = activeSetContent.description || fallbackSetContent.description || ''

  const activeImageContent = locale === 'zh' ? currentImage?.translations.zh : currentImage?.translations.en
  const fallbackImageContent = locale === 'zh' ? currentImage?.translations.en : currentImage?.translations.zh
  const displayImageTitle = activeImageContent?.title || fallbackImageContent?.title || ''
  const displayImageDescription = activeImageContent?.description || fallbackImageContent?.description || ''

  const locationBadges = (locations || []).map((loc: any, index: number) => {
    const preferred =
      locale === 'zh'
        ? loc?.name_zh || loc?.name || loc?.name_en
        : loc?.name_en || loc?.name || loc?.name_zh
    const label = (preferred && preferred.toString().trim().length > 0)
      ? preferred.toString().trim()
      : locale === 'zh'
        ? '未标记地点'
        : 'Untitled Location'
    return {
      key: loc?.id ?? `loc-${index}`,
      label,
      isPrimary: Boolean(loc?.isPrimary),
    }
  })

  const handleImageChange = (index: number) => {
    setCurrentIndex(index)
  }

  const handleBack = useCallback(() => {
    if (isLeaving) return
    setIsLeaving(true)
    // allow the flash animation to read before navigation
    window.setTimeout(() => {
      // 如果有风格参数，返回到首页并自动打开对应的风格弹窗
      if (styleParam) {
        router.push(`/?style=${styleParam}`)
      } else if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back()
      } else {
        router.push('/')
      }
    }, 180)
  }, [isLeaving, router, styleParam])


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
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-white via-[#f8f6f1] to-[#eaf0ff] text-gray-900">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_45%)]" />
      <div
        className={`pointer-events-none fixed inset-0 z-[200] bg-gradient-to-br from-white via-[#f6f4f0] to-[#eef2ff] transition-opacity duration-300 ease-out ${isLeaving ? "opacity-100" : "opacity-0"}`}
        aria-hidden="true"
      />
      <div className="relative flex min-h-screen flex-col">
        <div className="w-full flex flex-col">
        {/* Main content area */}
        <main className="flex flex-1 flex-col">
          {/* Image gallery section */}
          <div className="flex flex-1 flex-col">
            {/* Main image and overlay */}
            <div className="flex flex-col w-full">
              <div className="relative">
                <div className="relative w-full min-h-[100svh] h-[100svh] max-h-[100svh] supports-[height:100dvh]:min-h-[100dvh] supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:max-h-[100dvh] sm:min-h-[520px] flex items-center justify-center rounded-none overflow-hidden border border-white/30 bg-white/10 shadow-2xl backdrop-blur">
                  <Carousel
                    images={images}
                    currentIndex={currentIndex}
                    onChangeImage={handleImageChange}
                    showThumbnails={false}
                    overlayControls={
                      <>
                        <button
                          type="button"
                          onClick={() => setShowThumbnails((prev) => !prev)}
                          className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white/90 h-9 w-9 text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:text-black"
                          aria-label={locale === 'zh' ? '缩略图' : 'Thumbnails'}
                        >
                          <Grid className="h-4 w-4" />
                        </button>
                        <span className="rounded-full border border-gray-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-gray-600 shadow-sm">
                          {currentIndex + 1}/{images.length}
                        </span>
                        <Drawer>
                          <DrawerTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white/90 h-9 w-9 text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:text-black"
                              aria-label={locale === 'zh' ? '查看详情' : 'View details'}
                            >
                              <Info className="h-4 w-4" />
                            </button>
                          </DrawerTrigger>
                          <DrawerContent className="border-gray-200 bg-white/95 text-gray-900">
                            <DrawerHeader className="text-left">
                              <DrawerTitle className="text-base font-medium tracking-[0.3em] uppercase text-gray-500">
                                {locale === 'zh' ? '信息' : 'Details'}
                              </DrawerTitle>
                            </DrawerHeader>
                            <div className="px-5 pb-6 space-y-6">
                              <div className="space-y-2">
                                {(displayTitle || displaySubtitle || displayDescription) && (
                                  <>
                                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                                      {locale === 'zh' ? '作品集' : 'Set'}
                                    </p>
                                    {displayTitle && (
                                      <p className="text-lg font-light text-gray-900">{displayTitle}</p>
                                    )}
                                    {displaySubtitle && (
                                      <p className="text-sm text-gray-600">{displaySubtitle}</p>
                                    )}
                                    {displayDescription && (
                                      <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">
                                        {displayDescription}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>

                              <div className="space-y-2">
                                {(displayImageTitle || displayImageDescription) && (
                                  <>
                                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                                      {locale === 'zh' ? '当前图片' : 'Current Image'}
                                    </p>
                                    {displayImageTitle && (
                                      <p className="text-base font-light text-gray-900">{displayImageTitle}</p>
                                    )}
                                    {displayImageDescription && (
                                      <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">
                                        {displayImageDescription}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>

                              {locationBadges.length > 0 && (
                                <div className="space-y-3">
                                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                                    {locale === 'zh' ? '地点' : 'Locations'}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {locationBadges.map((badge) => (
                                      <span
                                        key={badge.key}
                                        className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-xs font-semibold text-emerald-900 shadow-sm"
                                      >
                                        <span className={`h-2 w-2 rounded-full ${badge.isPrimary ? "bg-emerald-500" : "bg-emerald-300"}`} />
                                        {badge.label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </DrawerContent>
                        </Drawer>
                      </>
                    }
                  />
                </div>
                <div className="absolute left-3 top-3 z-30 sm:left-4 sm:top-4">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center justify-center h-9 w-9 text-gray-700 transition-all duration-200 hover:text-black"
                    aria-label={locale === 'zh' ? '返回' : 'Back'}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>
                <div
                  className={`hidden lg:block absolute bottom-20 right-4 z-30 w-[320px] origin-bottom-right transform transition-all duration-500 ${
                    showThumbnails ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2 pointer-events-none"
                  }`}
                  onMouseLeave={() => setShowThumbnails(false)}
                >
                  <div className="rounded-[28px] border border-gray-200/80 bg-white/95 backdrop-blur-md shadow-2xl">
                    <div className="max-h-[360px] overflow-hidden p-6">
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

          {/* Mobile thumbnails section */}
          <div className="lg:hidden mt-4">
            <button 
              onClick={() => setShowThumbnails(!showThumbnails)}
              className="text-gray-600 hover:text-black smooth-transition mb-3 flex items-center hover:translate-x-1"
              aria-label={showThumbnails ? 'Hide gallery' : 'Show gallery'}
            >
              <ChevronDown className={`h-4 w-4 transform smooth-transition ${showThumbnails ? 'rotate-180' : ''}`} />
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
