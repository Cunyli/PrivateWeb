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
}

export function PortfolioDetail({ images }: PortfolioDetailProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
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
        {/* Header with back button */}
        <header className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-gray-600 hover:text-black transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Works
          </Link>
        </header>

        {/* Main content area - using flex layout */}
        <main className="flex flex-col flex-1 overflow-hidden">
          {/* Image gallery section */}
          <div className="flex flex-1 gap-4 overflow-hidden">
            {/* Left column: Main image and details */}
            <div className="flex flex-col flex-1">
              {/* Main image container */}
              <div className="flex-1 flex items-center justify-center  rounded-md overflow-hidden">
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
            </div>

            {/* Right column: Thumbnails grid */}
            <div className="w-1/5 hidden lg:block">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                <div className="grid grid-cols-2 gap-2">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => handleImageChange(index)}
                      className={`aspect-square overflow-hidden rounded-md border-2 transition-colors duration-200 ${
                        index === currentIndex ? "border-black" : "border-transparent"
                      }`}
                    >
                      <img
                        src={image.url || "/placeholder.svg"}
                        alt={`Thumbnail ${index + 1}`}
                        className="object-cover w-full h-full"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
