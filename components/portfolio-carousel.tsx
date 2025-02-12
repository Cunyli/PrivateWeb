"use client"

import * as React from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import useEmblaCarousel from "embla-carousel-react"
import { Button } from "@/components/ui/button"
import type { PortfolioImage } from "../types/portfolio"

interface PortfolioCarouselProps {
  images: PortfolioImage[]
}

export function PortfolioCarousel({ images }: PortfolioCarouselProps) {
  const [mainCarouselRef, mainEmblaApi] = useEmblaCarousel()
  const [thumbCarouselRef, thumbEmblaApi] = useEmblaCarousel({
    containScroll: "keepSnaps",
    dragFree: true,
  })
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  const scrollPrev = React.useCallback(() => {
    if (mainEmblaApi) mainEmblaApi.scrollPrev()
  }, [mainEmblaApi])

  const scrollNext = React.useCallback(() => {
    if (mainEmblaApi) mainEmblaApi.scrollNext()
  }, [mainEmblaApi])

  const onThumbClick = React.useCallback(
    (index: number) => {
      if (!mainEmblaApi || !thumbEmblaApi) return
      mainEmblaApi.scrollTo(index)
    },
    [mainEmblaApi, thumbEmblaApi],
  )

  const onSelect = React.useCallback(() => {
    if (!mainEmblaApi || !thumbEmblaApi) return
    setSelectedIndex(mainEmblaApi.selectedScrollSnap())
    thumbEmblaApi.scrollTo(mainEmblaApi.selectedScrollSnap())
  }, [mainEmblaApi, thumbEmblaApi])

  React.useEffect(() => {
    if (!mainEmblaApi) return
    onSelect()
    mainEmblaApi.on("select", onSelect)
    return () => {
      mainEmblaApi.off("select", onSelect)
    }
  }, [mainEmblaApi, onSelect])

  return (
    <div className="space-y-4">
      <div className="relative rounded-lg overflow-hidden shadow-lg">
        <div className="overflow-hidden" ref={mainCarouselRef}>
          <div className="flex">
            {images.map((image, index) => (
              <div key={index} className="relative aspect-[16/9] min-w-0 flex-[0_0_100%]">
                <Image
                  src={image.url || "/placeholder.svg"}
                  alt={image.alt}
                  fill
                  className="object-contain"
                  priority={index === 0}
                />
              </div>
            ))}
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 hover:bg-white transition-colors duration-200"
          onClick={scrollPrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 hover:bg-white transition-colors duration-200"
          onClick={scrollNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="overflow-hidden" ref={thumbCarouselRef}>
        <div className="flex gap-2">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => onThumbClick(index)}
              className={`relative aspect-[16/9] flex-[0_0_100px] overflow-hidden rounded-md border-2 transition-colors duration-200 ${
                index === selectedIndex ? "border-black" : "border-transparent"
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
    </div>
  )
}

