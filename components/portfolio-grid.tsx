"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { supabase } from "@/utils/supabase"

export function PortfolioGrid() {
  const [pictureSets, setPictureSets] = useState<any[]>([])

  const fetchPictureSets = async () => {
    const { data, error } = await supabase
      .from("picture_sets")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) {
      console.error("Error fetching picture sets:", error)
    } else {
      setPictureSets(data || [])
    }
  }

  useEffect(() => {
    fetchPictureSets()
  }, [])

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-light text-center mb-16">Galleries</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {pictureSets.map((item) => (
          <Link
            key={item.id}
            href={`/work/${item.id}`}
            className="group relative aspect-[4/3] block overflow-hidden bg-gray-100"
          >
            <Image
              src={item.cover_image_url || "/placeholder.svg"}
              alt={item.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <motion.div
              initial={false}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white"
            >
              <h2 className="text-2xl font-light mb-2">{item.title}</h2>
              <p className="text-sm opacity-80">{item.subtitle}</p>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  )
}

