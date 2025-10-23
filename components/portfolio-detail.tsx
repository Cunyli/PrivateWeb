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

interface PortfolioDetailProps {
  id: string
  images: ImageItem[]
  translations: {
    en: LocalizedContent
    zh: LocalizedContent
  }
}

export default function PortfolioDetail({ images, translations }: PortfolioDetailProps) {
  const searchParams = useSearchParams()
  const initialIndex = parseInt(searchParams.get('index') || '0', 10)
  const styleParam = searchParams.get('style') // 获取风格参数
  const [currentIndex, setCurrentIndex] = useState(Math.max(0, Math.min(initialIndex, images.length - 1)));
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState<Set<number>>(new Set());
  const [showSetInfo, setShowSetInfo] = useState(false);
  const { locale, t } = useI18n()
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

  // Smart preloading strategy: start preloading after page load
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (images && images.length > 0) {
      // Detect network conditions
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const isSlowConnection = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');
      
      // Load current and adjacent images first (high priority)
      const priorityIndices = [
        currentIndex,
        (currentIndex - 1 + images.length) % images.length,
        (currentIndex + 1) % images.length,
      ];

      // Start loading prioritized images immediately
      priorityIndices.forEach(index => {
        if (!preloadedImages.has(index) && images[index]?.url) {
          const img = new window.Image();
          img.onload = () => {
            setPreloadedImages(prev => new Set(prev).add(index));
          };
          img.onerror = () => {
            setPreloadedImages(prev => new Set(prev).add(index));
          };
          img.src = bucketUrl + images[index].url;
        }
      });

      // Lazy load other images based on network quality
      const loadRemainingImages = () => {
        const batchSize = isSlowConnection ? 2 : 4; // reduce concurrency on slow network
        const delay = isSlowConnection ? 200 : 100; // add delay on slow network
        
        let batchIndex = 0;
        const remainingIndices = images
          .map((_, index) => index)
          .filter(index => !priorityIndices.includes(index) && !preloadedImages.has(index));

        const loadBatch = () => {
          const currentBatch = remainingIndices.slice(batchIndex, batchIndex + batchSize);
          
          currentBatch.forEach((index, i) => {
            if (images[index]?.url) {
              setTimeout(() => {
                const img = new window.Image();
                img.onload = () => {
                  setPreloadedImages(prev => new Set(prev).add(index));
                };
                img.onerror = () => {
                  setPreloadedImages(prev => new Set(prev).add(index));
                };
                img.src = bucketUrl + images[index].url;
              }, i * 50); // 小延迟避免同时发起请求
            }
          });

          batchIndex += batchSize;
          if (batchIndex < remainingIndices.length) {
            setTimeout(loadBatch, delay);
          }
        };

        loadBatch();
      };

      // Adjust start time based on network
      const startDelay = isSlowConnection ? 1000 : 300;
      const timer = setTimeout(loadRemainingImages, startDelay);
      return () => clearTimeout(timer);
    }
  }, [images, currentIndex, preloadedImages]);

  // Preload all thumbnails when sidebar is hovered
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sidebarHovered && images && images.length > 0) {
      console.log('Sidebar expanding, preloading all thumbnails...');
      
      // Compute number of images to load
      const unloadedImages = images.filter((_, index) => !preloadedImages.has(index));
      const totalToLoad = unloadedImages.length;
      
      if (totalToLoad > 0) {
        // Load all within ~0.8s while sidebar expands
        const loadDuration = 800; // ms
        const interval = Math.max(10, Math.floor(loadDuration / totalToLoad)); // min 10ms
        
        images.forEach((image, index) => {
          if (!preloadedImages.has(index) && image.url) {
            // Compute delay for this image
            const loadDelay = (index % totalToLoad) * interval;
            
            setTimeout(() => {
              const img = new window.Image();
              img.onload = () => {
                setPreloadedImages(prev => {
                  const newSet = new Set(prev).add(index);
                  console.log(`Thumb ${index + 1}/${images.length} loaded (${newSet.size}/${images.length})`);
                  return newSet;
                });
              };
              img.onerror = () => {
                setPreloadedImages(prev => new Set(prev).add(index));
                console.log(`Thumb ${index + 1} failed, skip`);
              };
              img.src = bucketUrl + image.url;
            }, loadDelay);
          }
        });
      }
    }
  }, [sidebarHovered, images, preloadedImages]);

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
    <div className="min-h-screen bg-white flex flex-col">
      <div className="max-w-[2000px] w-full mx-auto px-4 py-6 lg:px-8 xl:px-16 flex flex-col">
        {/* Header with back button and title */}
        <header className="sticky top-0 z-40 -mx-4 lg:-mx-8 xl:-mx-16 mb-6 border-b border-gray-200/70 bg-white/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:px-8 xl:px-16">
          <div className="flex items-center justify-between gap-4 text-gray-600">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:text-black"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('backToHome')}
            </button>
            <LangSwitcher className="h-8 w-8 text-gray-600 bg-white border border-gray-200 shadow-sm" />
          </div>
        </header>

        {/* Main content area - using flex layout */}
        <main className="flex flex-col flex-1">
          {/* Image gallery section */}
          <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:gap-4">
            {/* Left column: Main image and details */}
            <div className="flex flex-col w-full lg:pr-1">
              {/* Main image container */}
              <div className="relative w-full min-h-[400px] h-[60vh] flex items-center justify-center rounded-[28px] overflow-hidden shadow-sm bg-gray-50">
                {(displayTitle || displaySubtitle || displayDescription) && (
                  <div className="absolute left-4 top-4 lg:left-6 lg:top-6 z-20 flex flex-col items-start gap-3 max-w-sm pointer-events-none">
                    <button 
                      className="group/info inline-flex items-center gap-2 rounded-full bg-black/75 px-3.5 py-1.5 text-[10px] uppercase tracking-[0.32em] text-white shadow-md backdrop-blur-sm transition-all duration-200 hover:bg-black pointer-events-auto"
                      onMouseEnter={() => setShowSetInfo(true)}
                      onMouseLeave={() => setShowSetInfo(false)}
                      onClick={() => setShowSetInfo(!showSetInfo)}
                    >
                      {locale === 'zh' ? '作品简介' : 'About Set'}
                      <span className={`text-[10px] transition-transform ${showSetInfo ? 'rotate-180' : ''}`}>▴</span>
                    </button>

                    <div className={`w-[min(70vw,280px)] rounded-3xl bg-white/95 border border-white/60 px-5 py-4 text-left text-gray-700 shadow-xl backdrop-blur-md transition-all duration-300 ${
                      showSetInfo 
                        ? 'translate-y-0 opacity-100 pointer-events-auto' 
                        : 'translate-y-2 opacity-0 pointer-events-none'
                    }`}
                    onMouseEnter={() => setShowSetInfo(true)}
                    onMouseLeave={() => setShowSetInfo(false)}
                    >
                      {(displayTitle || displaySubtitle) && (
                        <div className="mb-3 border-b border-gray-200 pb-2">
                          {displayTitle && (
                            <h2 className="text-base font-medium text-gray-900">
                              {displayTitle}
                            </h2>
                          )}
                          {displaySubtitle && (
                            <p className="text-sm text-gray-500 mt-0.5">
                              {displaySubtitle}
                            </p>
                          )}
                        </div>
                      )}

                      {displayDescription && (
                        <div className="mb-4">
                          <h3 className="text-xs uppercase tracking-[0.35em] text-gray-400 mb-2">
                            {locale === 'zh' ? '系列简介' : 'Set Overview'}
                          </h3>
                          <p className="text-sm leading-relaxed whitespace-pre-line text-gray-700">
                            {displayDescription}
                          </p>
                        </div>
                      )}

                      {(displayImageTitle || displayImageSubtitle || displayImageDescription) && (
                        <div>
                          <h3 className="text-xs uppercase tracking-[0.35em] text-gray-400 mb-2">
                            {locale === 'zh' ? '当前作品' : 'Current Image'}
                          </h3>
                          {displayImageTitle && (
                            <p className="text-sm font-medium text-gray-900">
                              {displayImageTitle}
                            </p>
                          )}
                          {displayImageSubtitle && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {displayImageSubtitle}
                            </p>
                          )}
                          {displayImageDescription && (
                            <p className="text-sm leading-relaxed text-gray-700 mt-2 whitespace-pre-line">
                              {displayImageDescription}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Carousel
                  images={images}
                  currentIndex={currentIndex}
                  onChangeImage={handleImageChange}
                  showThumbnails={false}
                />
              </div>

              {/* Image details below the main image */}
              <div className="mt-4">
                <ImageDetails image={currentImage} />
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
            </div>

            {/* Right column: Hover-triggered Thumbnails sidebar */}
            <div 
              className="relative hidden lg:block group w-3 hover:w-64" 
              style={{ transition: 'width 0.75s cubic-bezier(0.23, 1, 0.32, 1)' }}
              onMouseEnter={() => setSidebarHovered(true)}
              onMouseLeave={() => setSidebarHovered(false)}
            >
              {/* Trigger zone - always visible on the right edge */}
              <div className="absolute right-0 top-0 w-6 h-full bg-gradient-to-l from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 rounded-r-xl cursor-pointer flex items-center justify-center z-30 shadow-sm hover:shadow-md" style={{ 
                transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)' 
              }}>
                {/* Hover indicator dots */}
                <div className="flex flex-col items-center space-y-2 opacity-60 group-hover:opacity-30 group-hover:scale-75" style={{ 
                  transition: 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)' 
                }}>
                  <div className="w-1 h-8 bg-gray-500 rounded-full group-hover:bg-gray-400" style={{ 
                    transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)' 
                  }}></div>
                  <div className="w-0.5 h-4 bg-gray-400 rounded-full group-hover:bg-gray-300" style={{ 
                    transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)', 
                    transitionDelay: '0.05s' 
                  }}></div>
                  <div className="w-0.5 h-2 bg-gray-400 rounded-full group-hover:bg-gray-300" style={{ 
                    transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)', 
                    transitionDelay: '0.1s' 
                  }}></div>
                </div>
              </div>
              
              {/* Expanded content panel - slides in smoothly */}
              <div 
                className="absolute right-6 top-0 h-full w-72 bg-white/95 backdrop-blur-sm border-l border-gray-200/80 shadow-2xl rounded-l-xl overflow-hidden transform origin-right z-20" 
                style={{ 
                  transform: `scaleX(${sidebarHovered ? '1' : '0'})`,
                  opacity: sidebarHovered ? 1 : 0,
                  transition: 'all 0.8s cubic-bezier(0.23, 1, 0.32, 1)' 
                }}
              >
                <div 
                  className="h-full overflow-y-auto custom-scrollbar p-6 transform" 
                  style={{ 
                    transform: `translateX(${sidebarHovered ? '0' : '32px'})`,
                    transition: 'transform 0.7s cubic-bezier(0.23, 1, 0.32, 1)', 
                    transitionDelay: '0.1s' 
                  }}
                >
                  <h3 
                    className="text-sm font-semibold text-gray-800 mb-4 transform" 
                    style={{ 
                      transform: `translateY(${sidebarHovered ? '0' : '12px'})`,
                      opacity: sidebarHovered ? 1 : 0,
                      transition: 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)', 
                      transitionDelay: '0.25s' 
                    }}
                  >
                    Gallery ({images.length}) 
                    {sidebarHovered && preloadedImages.size < images.length && (
                      <span className="ml-2 text-xs text-blue-500 animate-pulse">
                        Loading... {preloadedImages.size}/{images.length}
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => handleImageChange(index)}
                        className={`aspect-square overflow-hidden rounded-lg border-2 transform transition-all duration-500 hover:scale-105 relative group/thumb ${
                          index === currentIndex 
                            ? "border-black ring-2 ring-black/20 scale-105 shadow-lg" 
                            : "border-transparent hover:border-gray-300 hover:shadow-md"
                        }`}
                        style={{ 
                          transform: sidebarHovered && preloadedImages.has(index) ? 'translateY(0px) scale(1)' : 'translateY(24px) scale(0.8)',
                          opacity: sidebarHovered && preloadedImages.has(index) ? 1 : 0,
                          transition: 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
                          transitionDelay: sidebarHovered && preloadedImages.has(index) ? `${0.3 + index * 0.08}s` : '0s',
                          animation: 'none'
                        }}
                      >
                        {preloadedImages.has(index) ? (
                          <img
                            src={image.url ? (bucketUrl + image.url) : "/placeholder.svg"}
                            alt={`Thumbnail ${index + 1}`}
                            className="object-cover w-full h-full transform group-hover/thumb:scale-110"
                            style={{ 
                              transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.3s ease-out',
                              opacity: 1,
                              animation: 'fadeIn 0.3s ease-out forwards'
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center border border-gray-200">
                            <div className="flex flex-col items-center space-y-1">
                              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                              <div className="text-xs text-gray-400">{index + 1}</div>
                            </div>
                          </div>
                        )}
                        {/* Active indicator overlay */}
                        <div className={`absolute inset-0 bg-black/10 pointer-events-none ${
                          index === currentIndex ? 'opacity-100' : 'opacity-0'
                        }`} style={{ 
                          transition: 'opacity 0.3s cubic-bezier(0.23, 1, 0.32, 1)' 
                        }}></div>
                        {/* Hover glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover/thumb:opacity-100 pointer-events-none" style={{ 
                          transition: 'opacity 0.3s cubic-bezier(0.23, 1, 0.32, 1)' 
                        }}></div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

    </div>
  )
}
