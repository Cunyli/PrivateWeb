"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { portfolioItems } from "../data/portfolio"

export function PortfolioGrid() {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-light text-center mb-16">WORKS</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {portfolioItems.map((item) => (
          <Link
            key={item.id}
            href={`/work/${item.id}`}
            className="group relative aspect-[4/3] block overflow-hidden bg-gray-100"
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <Image
              src={item.images[0].url || "/placeholder.svg"}
              alt={item.images[0].alt}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <motion.div
              initial={false}
              animate={{
                opacity: hoveredId === item.id ? 1 : 0,
              }}
              className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white"
            >
              <h2 className="text-2xl font-light mb-2">{item.title}</h2>
              <p className="text-sm opacity-80">{item.titleCn}</p>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  )
}

