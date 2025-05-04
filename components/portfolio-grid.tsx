// components/PortfolioGrid.tsx
"use client"

import { useState, useEffect, useRef, useMemo } from "react"
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
    try {
      console.log("Fetching picture sets for portfolio grid")
      const { data, error } = await supabase.from("picture_sets").select("*").order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching picture sets:", error)
        setPictureSets([])
      } else {
        console.log(`Found ${data?.length || 0} picture sets`)
        setPictureSets(data || [])
      }
    } catch (error) {
      console.error("Error in fetchPictureSets:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPictureSets()
  }, [])

  const upPictureSets = pictureSets.filter((s) => s.position?.trim().toLowerCase() === "up")
  const downPictureSets = pictureSets.filter((s) => s.position?.trim().toLowerCase() === "down")
  const shuffledDown = useMemo(() => [...downPictureSets].sort(() => Math.random() - 0.5), [downPictureSets])

  const mid = Math.ceil(upPictureSets.length / 2)
  const firstRow = upPictureSets.slice(0, mid)
  const secondRow = upPictureSets.slice(mid)

  useEffect(() => {
    const top = topRowRef.current!
    const bottom = bottomRowRef.current!
    if (!upPictureSets.length) return

    const tick = () => {
      if (!top.matches(":hover")) {
        top.scrollLeft >= top.scrollWidth - top.clientWidth - 5
          ? top.scrollTo({ left: 0, behavior: "auto" })
          : top.scrollBy({ left: 1, behavior: "auto" })
      }
      if (!bottom.matches(":hover")) {
        bottom.scrollLeft <= 5
          ? bottom.scrollTo({ left: bottom.scrollWidth - bottom.clientWidth, behavior: "auto" })
          : bottom.scrollBy({ left: -1, behavior: "auto" })
      }
    }

    const id = setInterval(tick, 30)
    return () => clearInterval(id)
  }, [upPictureSets])

  return (
    <div className="w-full mx-auto px-4 py-16 flex flex-col min-h-screen">
      <h1 className="text-4xl font-light text-center mb-16">Lijie&apos;s Galleries</h1>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-pulse">Loading galleries...</div>
        </div>
      ) : (
        <div className="flex flex-col gap-12 flex-1">
          {/* 上部两行自动滚动 */}
          {firstRow.length > 0 && (
            <div className="space-y-3">
              <div ref={topRowRef} className="flex overflow-x-auto hide-scrollbar gap-3 w-full">
                {[...firstRow, ...firstRow].map((item, i) => {
                  const widthClass =
                    i % 5 === 0 || i % 5 === 4 ? "w-[15%]" : i % 5 === 1 || i % 5 === 3 ? "w-[25%]" : "w-[20%]"

                  return (
                    <Link
                      key={`${item.id}-${i}`}
                      href={`/work/${item.id}?t=${Date.now()}`}
                      className={`group relative aspect-[16/9] flex-none ${widthClass} min-w-[200px] overflow-hidden bg-gray-100`}
                    >
                      <Image
                        src={item.cover_image_url || "/placeholder.svg"}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />

                      <motion.div
                        className="
                          absolute inset-0
                          bg-black/60
                          opacity-100
                          transition-opacity duration-200
                          group-hover:opacity-0
                          flex flex-col items-center justify-center text-white p-4 text-center
                        "
                      >
                        <h2 className="text-2xl font-light mb-2">{item.title}</h2>
                        <p className="text-sm opacity-80">{item.subtitle}</p>
                      </motion.div>
                    </Link>
                  )
                })}
              </div>

              <div ref={bottomRowRef} className="flex overflow-x-auto hide-scrollbar gap-3 w-full">
                {[...secondRow, ...secondRow].map((item, i) => {
                  const widthClass =
                    i % 5 === 0 || i % 5 === 4 ? "w-[20%]" : i % 5 === 1 || i % 5 === 3 ? "w-[15%]" : "w-[25%]"

                  return (
                    <Link
                      key={`${item.id}-${i}`}
                      href={`/work/${item.id}?t=${Date.now()}`}
                      className={`group relative aspect-[16/9] flex-none ${widthClass} min-w-[200px] overflow-hidden bg-gray-100`}
                    >
                      <Image
                        src={item.cover_image_url || "/placeholder.svg"}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />

                      <motion.div
                        className="
                          absolute inset-0
                          bg-black/60
                          opacity-100
                          transition-opacity duration-200
                          group-hover:opacity-0
                          flex flex-col items-center justify-center text-white p-4 text-center
                        "
                      >
                        <h2 className="text-2xl font-light mb-2">{item.title}</h2>
                        <p className="text-sm opacity-80">{item.subtitle}</p>
                      </motion.div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* 下部 Masonry 缩小 5/6 */}
          {shuffledDown.length > 0 && (
            <div className="mt-12 flex justify-center">
              <div className="w-full max-w-7xl columns-3 gap-4 transform scale-[0.833] origin-center">
                {shuffledDown.map((item) => (
                  <Link
                    key={item.id}
                    href={`/work/${item.id}?t=${Date.now()}`}
                    className="group block mb-4 break-inside-avoid relative overflow-hidden"
                  >
                    <img
                      src={item.cover_image_url || "/placeholder.svg"}
                      alt={item.title}
                      className="w-full h-auto object-cover"
                    />

                    <motion.div
                      className="
                        absolute inset-0
                        bg-black/60
                        opacity-100
                        transition-opacity duration-200
                        group-hover:opacity-0
                        flex flex-col items-center justify-center text-white p-4 text-center
                      "
                    >
                      <h2 className="text-2xl font-light mb-1">{item.title}</h2>
                      <p className="text-sm opacity-80">{item.subtitle}</p>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="mt-auto pt-8 pb-4 text-center">
        <p className="text-gray-500">
          Copyright © <span className="text-black">Lijie Li</span>
        </p>
      </footer>
    </div>
  )
}
