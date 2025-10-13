// @ts-nocheck
"use client"

import dynamic from "next/dynamic"
import { useMemo } from "react"

interface LocationPreviewMapProps {
  latitude: number | string
  longitude: number | string
  locationName?: string
}

const DynamicMapCanvas = dynamic(() => import("./location-preview-map-canvas").then(mod => ({ default: mod.LocationPreviewMapCanvas })), {
  ssr: false,
  loading: () => (
    <div className="mt-2 h-[200px] w-full animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
  ),
})

export function LocationPreviewMap({ latitude, longitude, locationName }: LocationPreviewMapProps) {
  const lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude
  const lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude

  // Validate coordinates
  const isValid = useMemo(() => {
    return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  }, [lat, lng])

  if (!isValid) {
    return (
      <div className="mt-2 h-[200px] w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-sm text-slate-400">
        输入有效的经纬度以预览位置
      </div>
    )
  }

  return <DynamicMapCanvas latitude={lat} longitude={lng} locationName={locationName} />
}
