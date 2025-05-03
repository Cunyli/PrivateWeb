// components/PortfolioGrid.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { supabase } from "@/utils/supabase"
import type { PictureSet } from "@/lib/pictureSet.types"

export function PortfolioGrid() {
  const [pictureSets, setPictureSets] = useState<PictureSet[]>([])
  const [loading, setLoading] = useState(true)
  const topRowRef = useRef<HTMLDivElement>(null)
  const bottomRowRef = useRef<HTMLDivElement>(null)

  const fetchPictureSets = async () => {
    setLoading(true)
    const { data, error } = await supabase.from("picture_sets").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching picture sets:", error)
    } else {
      setPictureSets(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchPictureSets()
  }, [])

  // Filter picture sets by position
  const upPictureSets = pictureSets.filter((s) => s.position?.trim().toLowerCase() === "up")
  const downPictureSets = pictureSets.filter((s) => s.position?.trim().toLowerCase() === "down")

  // Split "up" position sets into two rows
  const mid = Math.ceil(upPictureSets.length / 2)
  const firstRow = upPictureSets.slice(0, mid)
  const secondRow = upPictureSets.slice(mid)

  // Auto-scrolling effect
  useEffect(() => {
    const top = topRowRef.current
    const bottom = bottomRowRef.current
    if (!top || !bottom || upPictureSets.length === 0) return

    const tick = () => {
      if (!top.matches(":hover")) {
        if (top.scrollLeft >= top.scrollWidth - top.clientWidth - 5) {
          top.scrollTo({ left: 0, behavior: "auto" })
        } else {
          top.scrollBy({ left: 1, behavior: "auto" })
        }
      }
      if (!bottom.matches(":hover")) {
        if (bottom.scrollLeft <= 5) {
          bottom.scrollTo({
            left: bottom.scrollWidth - bottom.clientWidth,
            behavior: "auto",
          })
        } else {
          bottom.scrollBy({ left: -1, behavior: "auto" })
        }
      }
    }

    const id = setInterval(tick, 30)
    return () => clearInterval(id)
  }, [upPictureSets])

  return (
    <div className="w-full mx-auto px-0 py-16">
      <h1 className="text-4xl font-light text-center mb-16">Lijie's Galleries</h1>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-pulse">Loading galleries...</div>
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          {/* "Up" position items - two rows with auto-scrolling */}
          {upPictureSets.length > 0 && (
            <div className="space-y-3">
              {/* First row: left to right */}
              {firstRow.length > 0 && (
                <div ref={topRowRef} className="flex overflow-x-auto hide-scrollbar gap-3 w-full">
                  {/* Duplicate items for infinite scrolling effect */}
                  {[...firstRow, ...firstRow].map((item, i) => {
                    // Calculate width based on position in the array
                    // This creates a varied width pattern similar to the example
                    const widthClass =
                      i % 5 === 0 || i % 5 === 4 ? "w-[20%]" : i % 5 === 1 || i % 5 === 3 ? "w-[30%]" : "w-[25%]"

                    return (
                      <Link
                        key={`${item.id}-${i}`}
                        href={`/work/${item.id}`}
                        className={`group relative aspect-[4/3] flex-none ${widthClass} min-w-[200px] overflow-hidden bg-gray-100`}
                      >
                        <Image
                          src={item.cover_image_url || "/placeholder.svg"}
                          alt={item.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <motion.div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-4 text-center">
                          <h2 className="text-2xl font-light mb-2">{item.title}</h2>
                          <p className="text-sm opacity-80">{item.subtitle}</p>
                        </motion.div>
                      </Link>
                    )
                  })}
                </div>
              )}

              {/* Second row: right to left */}
              {secondRow.length > 0 && (
                <div ref={bottomRowRef} className="flex overflow-x-auto hide-scrollbar gap-3 w-full">
                  {/* Duplicate items for infinite scrolling effect */}
                  {[...secondRow, ...secondRow].map((item, i) => {
                    // Calculate width based on position in the array
                    // This creates a varied width pattern similar to the example
                    const widthClass =
                      i % 5 === 0 || i % 5 === 4 ? "w-[25%]" : i % 5 === 1 || i % 5 === 3 ? "w-[20%]" : "w-[30%]"

                    return (
                      <Link
                        key={`${item.id}-${i}`}
                        href={`/work/${item.id}`}
                        className={`group relative aspect-[4/3] flex-none ${widthClass} min-w-[200px] overflow-hidden bg-gray-100`}
                      >
                        <Image
                          src={item.cover_image_url || "/placeholder.svg"}
                          alt={item.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <motion.div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-4 text-center">
                          <h2 className="text-2xl font-light mb-2">{item.title}</h2>
                          <p className="text-sm opacity-80">{item.subtitle}</p>
                        </motion.div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* "Down" position items - centered grid */}
          {downPictureSets.length > 0 && (
            <div className="mt-12 flex justify-center px-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl w-full">
                {downPictureSets.map((item) => (
                  <Link
                    key={item.id}
                    href={`/work/${item.id}`}
                    className="group relative aspect-[16/9] overflow-hidden bg-gray-100"
                  >
                    <Image
                      src={item.cover_image_url || "/placeholder.svg"}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <motion.div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-4 text-center">
                      <h2 className="text-2xl font-light mb-2">{item.title}</h2>
                      <p className="text-sm opacity-80">{item.subtitle}</p>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
