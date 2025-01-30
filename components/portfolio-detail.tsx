"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import { PortfolioCarousel } from "./portfolio-carousel"
import type { PortfolioDetailProps } from "../types/portfolio"

export function PortfolioDetail({ item }: PortfolioDetailProps) {
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
            <PortfolioCarousel images={item.images} />
          </div>
          <div className="lg:col-span-3 space-y-6">
            <div>
              <h1 className="text-4xl font-light mb-2 tracking-wide">{item.title}</h1>
              <p className="text-xl text-gray-600 font-light">{item.titleCn}</p>
            </div>
            {item.description && <p className="text-gray-800 leading-relaxed text-lg font-light">{item.description}</p>}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

