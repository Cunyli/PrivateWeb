"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useState } from "react"
import { Carousel } from "@/components/carousel"
import { ImageDetails } from "@/components/image-details"

interface ImageItem {
  url: string
  alt: string
  title: string
  titleCn: string
  description: string
}

interface PortfolioDetailProps {
  item: ImageItem[]
}

export function PortfolioDetail({ item }: PortfolioDetailProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentImage = item[currentIndex]
  
  const handleImageChange = (index: number) => {
    setCurrentIndex(index)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-white"
    >
      <div className="max-w-[2000px] mx-auto px-4 py-8 lg:px-8 xl:px-16">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-600 hover:text-black mb-8 transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Works
        </Link>
        <div className="grid lg:grid-cols-10 gap-8 lg:gap-16">
          <div className="lg:col-span-7">
            <Carousel 
              images={item} 
              currentIndex={currentIndex}
              onChangeImage={handleImageChange}
            />
          </div>
          <div className="lg:col-span-3 space-y-6">
            <ImageDetails image={currentImage} />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

