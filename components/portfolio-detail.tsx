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

export function PortfolioDetail({ images, title, subtitle, description }: PortfolioDetailProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showThumbnails, setShowThumbnails] = useState(false)
  const currentImage = images[currentIndex]

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
            <div className="flex flex-col pr-2" style={{ width: 'calc(100% - 1.5rem)' }}>
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
                  className="text-sm text-gray-600 hover:text-black transition-colors duration-200 mb-3 flex items-center"
                >
                  {showThumbnails ? 'Hide' : 'Show'} Gallery ({images.length})
                  <span className={`ml-2 transform transition-transform duration-200 ${showThumbnails ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                
                {showThumbnails && (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                    {images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => handleImageChange(index)}
                        className={`aspect-square overflow-hidden rounded-md border-2 transition-all duration-200 ${
                          index === currentIndex ? "border-black ring-2 ring-black ring-opacity-20" : "border-transparent hover:border-gray-300"
                        }`}
                      >
                        <img
                          src={process.env.NEXT_PUBLIC_BUCKET_URL+image.url || "/placeholder.svg"}
                          alt={`Thumbnail ${index + 1}`}
                          className="object-cover w-full h-full"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right column: Collapsible Thumbnails grid */}
            <div className="relative hidden lg:block group">
              {/* Collapsed trigger area */}
              <div className="w-6 h-full bg-gray-50 hover:bg-gray-100 transition-all duration-300 rounded-l-md cursor-pointer flex items-center justify-center group-hover:w-80 group-hover:bg-white group-hover:shadow-lg group-hover:border-l group-hover:border-gray-200 group-hover:rounded-l-none">
                {/* Collapsed state indicator */}
                <div className="group-hover:hidden flex flex-col items-center space-y-2">
                  <div className="w-1 h-8 bg-gray-400 rounded-full"></div>
                  <div className="w-0.5 h-4 bg-gray-300 rounded-full"></div>
                  <div className="w-0.5 h-2 bg-gray-300 rounded-full"></div>
                </div>
                
                {/* Expanded state content */}
                <div className="hidden group-hover:block w-full h-full p-4">
                  <div className="h-full overflow-y-auto custom-scrollbar">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Gallery ({images.length})</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {images.map((image, index) => (
                        <button
                          key={index}
                          onClick={() => handleImageChange(index)}
                          className={`aspect-square overflow-hidden rounded-md border-2 transition-all duration-200 ${
                            index === currentIndex ? "border-black ring-2 ring-black ring-opacity-20" : "border-transparent hover:border-gray-300"
                          }`}
                        >
                          <img
                            src={process.env.NEXT_PUBLIC_BUCKET_URL+image.url || "/placeholder.svg"}
                            alt={`Thumbnail ${index + 1}`}
                            className="object-cover w-full h-full"
                          />
                        </button>
                      ))}
                    </div>
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
