"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { PHOTOGRAPHY_STYLE_BY_ID } from "@/lib/photography-styles"
import type { PhotographyStyleId } from "@/lib/photography-styles"

type PictureTranslation = {
  title?: string | null
  subtitle?: string | null
  description?: string | null
}

type StylePicture = {
  id: number
  pictureSetId: number
  imageUrl: string
  rawImageUrl: string | null
  tags: string[]
  categories: string[]
  set: {
    id: number
    title: string
    subtitle: string
    coverImageUrl: string | null
    translations: {
      en: PictureTranslation
      zh: PictureTranslation
    }
  }
  translations: {
    en: PictureTranslation
    zh: PictureTranslation
  }
}

type StyleApiResponse = {
  id: string
  tagName: string
  pictures: StylePicture[]
}

type MasterShot = {
  id: number
  pictureSetId: number | null
  imageUrl: string
  styleLabel: string
}

const shuffle = <T,>(items: T[]) => {
  const array = [...items]
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

const isMasterTagged = (pool: string[]) =>
  pool.some((value) => {
    const lower = value.toLowerCase()
    return lower.includes("master") || lower.includes("大师")
  })

const toAbsoluteUrl = (rawUrl?: string | null, bucketUrl?: string) => {
  if (!rawUrl) return "/placeholder.svg?height=800&width=600"
  if (rawUrl.startsWith("http")) return rawUrl
  const prefix = bucketUrl || process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top"
  return `${prefix}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`
}

export function MasterShotsShowcase() {
  const [shots, setShots] = useState<MasterShot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bucketUrl = useMemo(() => process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top", [])

  useEffect(() => {
    let isMounted = true

    const fetchFromPictureStyles = async (): Promise<MasterShot[]> => {
      const res = await fetch("/api/picture-styles", { cache: "no-store" })
      if (!res.ok) {
        throw new Error(`Fallback fetch failed (${res.status})`)
      }
      const json = await res.json()
      const payload = (json?.styles || {}) as Record<string, StyleApiResponse>
      const shotList: MasterShot[] = []
      const seenPictureIds = new Set<number>()

      Object.values(payload).forEach((style) => {
        const meta = PHOTOGRAPHY_STYLE_BY_ID[style.id as PhotographyStyleId]
        const styleLabel = meta?.labels?.en || meta?.labels?.zh || style.tagName || "Master"
        for (const picture of style.pictures || []) {
          const pool = [...(picture.tags || []), ...(picture.categories || [])]
          if (!isMasterTagged(pool)) continue
          if (!picture.id || seenPictureIds.has(picture.id)) continue
          seenPictureIds.add(picture.id)
          shotList.push({
            id: picture.id,
            pictureSetId: picture.set?.id || picture.pictureSetId || null,
            imageUrl: toAbsoluteUrl(picture.imageUrl, bucketUrl),
            styleLabel,
          })
        }
      })

      return shuffle(shotList)
    }

    const fetchMasterShots = async () => {
      try {
        const res = await fetch("/api/master-shots?limit=11", { cache: "no-store" })
        if (!res.ok) {
          throw new Error(`Failed to load master shots (${res.status})`)
        }
        const json = await res.json()
        if (isMounted) {
          const normalized = (json?.shots || []).map((shot: MasterShot) => ({
            ...shot,
            imageUrl: toAbsoluteUrl(shot?.imageUrl, bucketUrl),
          }))
          setShots(shuffle(normalized))
          setError(null)
        }
      } catch (err: any) {
        console.error("Primary master shots fetch failed, trying fallback:", err)
        try {
          const fallbackShots = await fetchFromPictureStyles()
          if (isMounted) {
            setShots(fallbackShots.slice(0, 12))
            setError(null)
          }
        } catch (fallbackErr: any) {
          console.error("Fallback master shots fetch failed:", fallbackErr)
          if (isMounted) {
            setError(fallbackErr?.message || "Unable to load master shots")
          }
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchMasterShots()
    return () => {
      isMounted = false
    }
  }, [bucketUrl])

  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, idx) => (
          <div key={idx} className="rounded-2xl bg-white/5 p-6">
            <div className="h-48 w-full animate-pulse rounded-xl bg-white/10" />
            <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-white/10" />
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-white/5" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/20 p-6 text-sm text-red-200">{error}</div>
    )
  }

  if (!shots.length) {
    return (
      <div className="rounded-2xl border border-white/20 bg-white/5 p-6 text-sm text-white/70">
        No master-tagged images available right now. Please check back soon.
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {shots.map((shot) => (
        <Link
          key={shot.id}
          href={shot.pictureSetId ? `/work/${shot.pictureSetId}` : "#"}
          className="group block overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-white/30"
        >
          <div className="relative aspect-[3/4] w-full">
            <Image
              src={shot.imageUrl}
              alt={shot.styleLabel}
              fill
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 320px"
            />
          </div>
        </Link>
      ))}
    </div>
  )
}
