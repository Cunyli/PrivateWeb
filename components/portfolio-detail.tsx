"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
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
  
  const currentImage = images[currentIndex];

  const handleImageChange = (index: number) => {
    setCurrentIndex(index)
  }

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
                        <img
                          src={process.env.NEXT_PUBLIC_BUCKET_URL+image.url || "/placeholder.svg"}
                          alt={`Thumbnail ${index + 1}`}
                          className="object-cover w-full h-full smooth-transition hover:scale-110"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right column: Hover-triggered Thumbnails sidebar */}
            <div className="relative hidden lg:block group w-6 hover:w-80" style={{ 
              transition: 'width 0.8s cubic-bezier(0.23, 1, 0.32, 1)' 
            }}>
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
              <div className="absolute right-6 top-0 h-full w-72 bg-white/95 backdrop-blur-sm border-l border-gray-200/80 shadow-2xl rounded-l-xl overflow-hidden transform origin-right scale-x-0 group-hover:scale-x-100 opacity-0 group-hover:opacity-100 z-20" style={{ 
                transition: 'all 0.8s cubic-bezier(0.23, 1, 0.32, 1)' 
              }}>
                <div className="h-full overflow-y-auto custom-scrollbar p-6 transform translate-x-8 group-hover:translate-x-0" style={{ 
                  transition: 'transform 0.7s cubic-bezier(0.23, 1, 0.32, 1)', 
                  transitionDelay: '0.1s' 
                }}>
                  <h3 className="text-sm font-semibold text-gray-800 mb-4 transform translate-y-3 group-hover:translate-y-0 opacity-0 group-hover:opacity-100" style={{ 
                    transition: 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)', 
                    transitionDelay: '0.25s' 
                  }}>
                    Gallery ({images.length})
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
                          transform: 'translateY(24px) scale(0.8)',
                          opacity: 0,
                          transition: 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
                          transitionDelay: `${0.3 + index * 0.08}s`,
                          animation: 'none'
                        }}
                        onMouseEnter={(e) => {
                          if (window.getComputedStyle(e.currentTarget.parentElement!.parentElement!.parentElement!).width !== '24px') {
                            e.currentTarget.style.transform = 'translateY(0px) scale(1)';
                            e.currentTarget.style.opacity = '1';
                          }
                        }}
                      >
                        <img
                          src={process.env.NEXT_PUBLIC_BUCKET_URL+image.url || "/placeholder.svg"}
                          alt={`Thumbnail ${index + 1}`}
                          className="object-cover w-full h-full transform group-hover/thumb:scale-110" style={{ 
                            transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)' 
                          }}
                        />
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
