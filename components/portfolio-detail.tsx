"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useState, useEffect, useRef, useCallback } from "react"
import { Carousel } from "@/components/carousel"
import { ImageDetails } from "@/components/image-details"

interface ImageItem {
  url: string
  rawUrl: string
  alt: string
  title: string
  titleCn: string
  description: string
}

interface PortfolioDetailProps {
  images: ImageItem[]
  title?: string
  subtitle?: string
  description?: string
}

export default function PortfolioDetail({ 
  images, 
  title, 
  subtitle, 
  description 
}: { 
  images: ImageItem[]
  title?: string
  subtitle?: string
  description?: string
  id: string 
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState<Set<number>>(new Set());
  
  const currentImage = images[currentIndex];

  const handleImageChange = (index: number) => {
    setCurrentIndex(index)
  }

  // 智能预加载策略：页面加载后立即开始预加载图片
  useEffect(() => {
    if (images && images.length > 0) {
      // 检测网络连接质量
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const isSlowConnection = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');
      
      // 首先加载当前图片和相邻图片（高优先级）
      const priorityIndices = [
        currentIndex,
        (currentIndex - 1 + images.length) % images.length,
        (currentIndex + 1) % images.length,
      ];

      // 立即开始加载优先级图片
      priorityIndices.forEach(index => {
        if (!preloadedImages.has(index) && images[index]?.url) {
          const img = new window.Image();
          img.onload = () => {
            setPreloadedImages(prev => new Set(prev).add(index));
          };
          img.onerror = () => {
            setPreloadedImages(prev => new Set(prev).add(index));
          };
          img.src = process.env.NEXT_PUBLIC_BUCKET_URL + images[index].url;
        }
      });

      // 延迟加载其他图片，根据网络状况调整
      const loadRemainingImages = () => {
        const batchSize = isSlowConnection ? 2 : 4; // 慢网络时减少并发数
        const delay = isSlowConnection ? 200 : 100; // 慢网络时增加延迟
        
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
                img.src = process.env.NEXT_PUBLIC_BUCKET_URL + images[index].url;
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

      // 根据网络状况调整开始时间
      const startDelay = isSlowConnection ? 1000 : 300;
      const timer = setTimeout(loadRemainingImages, startDelay);
      return () => clearTimeout(timer);
    }
  }, [images, currentIndex, preloadedImages]);

  // 侧边栏悬停时立即加载所有缩略图
  useEffect(() => {
    if (sidebarHovered && images && images.length > 0) {
      console.log('侧边栏展开中，立即加载所有缩略图...');
      
      // 计算需要加载的图片数量
      const unloadedImages = images.filter((_, index) => !preloadedImages.has(index));
      const totalToLoad = unloadedImages.length;
      
      if (totalToLoad > 0) {
        // 在侧边栏展开的0.8秒内完成所有加载
        const loadDuration = 800; // 毫秒
        const interval = Math.max(10, Math.floor(loadDuration / totalToLoad)); // 最小间隔10ms
        
        images.forEach((image, index) => {
          if (!preloadedImages.has(index) && image.url) {
            // 计算这张图片的加载延迟
            const loadDelay = (index % totalToLoad) * interval;
            
            setTimeout(() => {
              const img = new window.Image();
              img.onload = () => {
                setPreloadedImages(prev => {
                  const newSet = new Set(prev).add(index);
                  console.log(`缩略图 ${index + 1}/${images.length} 加载完成 (${newSet.size}/${images.length})`);
                  return newSet;
                });
              };
              img.onerror = () => {
                setPreloadedImages(prev => new Set(prev).add(index));
                console.log(`缩略图 ${index + 1} 加载失败，跳过`);
              };
              img.src = process.env.NEXT_PUBLIC_BUCKET_URL + image.url;
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
      <div className="max-w-[2000px] w-full mx-auto px-4 py-4 lg:px-8 xl:px-16 flex flex-col h-screen">
        {/* Header with back button and title */}
        <header className="mb-4 flex justify-between items-center">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-gray-600 hover:text-black transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Works
          </Link>

          {title && (
            <div className="text-right">
              <h1 className="text-xl font-medium">{title}</h1>
              {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
            </div>
          )}
        </header>

        {/* Main content area - using flex layout */}
        <main className="flex flex-col flex-1 overflow-hidden">
          {/* Image gallery section */}
          <div className="flex flex-1 gap-4 overflow-hidden">
            {/* Left column: Main image and details */}
            <div className="flex flex-col pr-2 w-full group-hover:w-[calc(100%-20rem)] smooth-transition">
              {/* Main image container */}
              <div className="flex-1 flex items-center justify-center rounded-md overflow-hidden">
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
                          src={process.env.NEXT_PUBLIC_BUCKET_URL+image.url || "/placeholder.svg"}
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
              className="relative hidden lg:block group w-6 hover:w-80" 
              style={{ transition: 'width 0.8s cubic-bezier(0.23, 1, 0.32, 1)' }}
              onMouseEnter={() => setSidebarHovered(true)}
              onMouseLeave={() => setSidebarHovered(false)}
            >
              {/* Trigger zone - always visible on the right edge */}
              <div className="absolute right-0 top-0 w-6 h-full bg-gradient-to-l from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 rounded-r-md cursor-pointer flex items-center justify-center z-30 shadow-sm hover:shadow-md" style={{ 
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
                            src={process.env.NEXT_PUBLIC_BUCKET_URL+image.url || "/placeholder.svg"}
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

          {/* Portfolio description */}
          {description && (
            <div className="mt-6 pb-4">
              <p className="text-gray-700">{description}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
