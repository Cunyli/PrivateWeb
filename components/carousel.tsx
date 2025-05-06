"use client"

import * as React from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImageItem {
  url: string
  rawUrl: string
  alt: string
  title: string
  titleCn: string
  description: string
}

interface CarouselProps {
  images: ImageItem[]
  currentIndex: number
  onChangeImage: (index: number) => void
  showThumbnails?: boolean
}

export function Carousel({ images, currentIndex, onChangeImage, showThumbnails = true }: CarouselProps) {
  const [isHovering, setIsHovering] = React.useState(false)

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
      window.open(images[currentIndex].rawUrl, "_blank")
    }
  }

  if (!images || images.length === 0) {
    return <div>No images to display</div>
  }

  return (
    <div className="flex flex-col w-full h-full">
      {/* Main image container */}
      <div
        className="flex-1 flex items-center justify-center w-full"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Image wrapper */}
        <div className="w-full h-full flex items-center justify-center relative">
          <Image
            src={process.env.NEXT_PUBLIC_BUCKET_URL+images[currentIndex].url || "/placeholder.svg"}
            alt={process.env.NEXT_PUBLIC_BUCKET_URL+images[currentIndex].alt || "Portfolio image"}
            fill
            className="object-contain corner-lg"
            priority
          />

          {/* Download original button - appears on hover */}
          {isHovering && images[currentIndex].rawUrl && (
            <Button
              variant="secondary"
              onClick={handleOpenOriginal}
              className="absolute bottom-4 right-4 bg-white/80 hover:bg-white shadow-md z-10"
            >
              <Download className="h-4 w-4 mr-2" />
              View Original
            </Button>
          )}

          {/* Navigation buttons */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/50 hover:bg-white/75 rounded-full p-2"
            onClick={goToPrevious}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/50 hover:bg-white/75 rounded-full p-2"
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
                className={`flex-none w-24 aspect-[16/9] overflow-hidden rounded-md border-2 transition-colors duration-200 ${
                  index === currentIndex ? "border-black" : "border-transparent"
                }`}
              >
                <Image
                  src={image.url || "/placeholder.svg"}
                  alt={`Thumbnail ${index + 1}`}
                  width={96}
                  height={54}
                  className="object-cover w-full h-full"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
