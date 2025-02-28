import * as React from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImageItem {
  url: string
  alt: string
  title: string
  titleCn: string
  description: string
}

interface CarouselProps {
  images: ImageItem[]
  currentIndex: number
  onChangeImage: (index: number) => void
}

export function Carousel({ images, currentIndex, onChangeImage }: CarouselProps) {
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

  if (!images || images.length === 0) {
    return <div>No images to display</div>
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full">
        <div className="overflow-hidden relative w-full h-[500px]">
          <Image
            src={images[currentIndex].url}
            alt={images[currentIndex].alt || "Portfolio image"}
            fill
            className="object-contain"
            priority
          />
        </div>
        
        {/* Navigation buttons */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/50 hover:bg-white/75 rounded-full p-2"
          onClick={goToPrevious}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/50 hover:bg-white/75 rounded-full p-2"
          onClick={goToNext}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Thumbnail carousel */}
      <div className="overflow-hidden">
        <div className="flex gap-2 overflow-x-auto py-2 px-1">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => onChangeImage(index)}
              className={`relative aspect-[16/9] flex-[0_0_100px] overflow-hidden rounded-md border-2 transition-colors duration-200 ${
                index === currentIndex ? "border-black" : "border-transparent"
              }`}
            >
              <Image
                src={image.url || "/placeholder.svg"}
                alt={`Thumbnail ${index + 1}`}
                fill
                className="object-cover"
              />
            </button>
          ))}
        </div>
      </div>

      {/* Dot indicators (optional, can remove if you prefer just thumbnails)
      <div className="flex justify-center gap-2">
        {images.map((_, index) => (
          <button
            key={index}
            className={`w-2 h-2 rounded-full ${
              index === currentIndex ? "bg-black" : "bg-gray-300"
            }`}
            onClick={() => onChangeImage(index)}
          />
        ))}
      </div> */}
    </div>
  )
}
