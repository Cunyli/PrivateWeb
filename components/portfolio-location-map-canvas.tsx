"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import type { Map as LeafletMap } from "leaflet"
import { LatLngBounds } from "leaflet"
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { useI18n } from "@/lib/i18n"

export interface MapLocationSet {
  id: number
  title: string
  subtitle?: string
  coverUrl: string
}

export interface MapLocationCluster {
  key: string
  name: string
  latitude: number
  longitude: number
  sets: MapLocationSet[]
}

export interface PortfolioLocationMapProps {
  locations: MapLocationCluster[]
  heading: string
  subheading: string
  emptyLabel: string
  viewAllLabel: string
}

export function PortfolioLocationMapCanvas({ locations, heading, subheading, emptyLabel, viewAllLabel }: PortfolioLocationMapProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null)
  const { locale } = useI18n()

  useEffect(() => {
    if (!locations.length) {
      setActiveKey(null)
      return
    }
    if (!activeKey || !locations.find((loc) => loc.key === activeKey)) {
      setActiveKey(locations[0]?.key ?? null)
    }
  }, [locations, activeKey])

  useEffect(() => {
    if (!mapInstance || !locations.length) return
    const bounds = new LatLngBounds(locations.map((loc) => [loc.latitude, loc.longitude]))
    mapInstance.fitBounds(bounds.pad(0.2), { animate: true, duration: 0.8 })
  }, [mapInstance, locations])

  const activeLocation = useMemo(() => {
    if (!activeKey) return null
    return locations.find((loc) => loc.key === activeKey) ?? null
  }, [activeKey, locations])

  const formattedCTA = useMemo(() => {
    if (!activeLocation) return emptyLabel
    return viewAllLabel.replace("{{count}}", String(activeLocation.sets.length))
  }, [activeLocation, emptyLabel, viewAllLabel])

  const tileConfig = useMemo(() => {
    if (locale === 'zh') {
      return {
        key: 'zh-tile',
        url: 'https://webrd0{s}.is.autonavi.com/appmaptile?style=7&lang=zh_cn&size=1&scale=1&x={x}&y={y}&z={z}',
        subdomains: ['1', '2', '3', '4'] as string[] | undefined,
        attribution: 'Map data © AutoNavi',
      }
    }
    return {
      key: 'en-tile',
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      subdomains: undefined,
      attribution: 'Map data © Esri & contributors',
    }
  }, [locale])

  if (!locations.length) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-slate-300/60 bg-white/60 p-6 text-center text-sm text-slate-500">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="text-center max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
          {heading}
        </h2>
        <p className="mt-2 text-sm sm:text-base text-slate-500">
          {subheading}
        </p>
      </div>

      <div className="mt-10 sm:mt-14 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="relative h-[420px] w-full overflow-hidden rounded-[2.5rem] border border-slate-200/60 shadow-[0_40px_90px_-45px_rgba(15,23,42,0.7)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(236,72,153,0.18),transparent_55%),radial-gradient(circle_at_80%_15%,rgba(56,189,248,0.18),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(129,140,248,0.16),transparent_65%)]" />
          <div className="absolute inset-0 mix-blend-screen opacity-40" style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(148,163,184,0.1), rgba(148,163,184,0.1) 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, rgba(148,163,184,0.08), rgba(148,163,184,0.08) 1px, transparent 1px, transparent 64px)" }} />
          <MapContainer
            center={[locations[0].latitude, locations[0].longitude]}
            zoom={4}
            minZoom={2}
            maxZoom={12}
            whenCreated={(map) => setMapInstance(map)}
            className="h-full w-full focus:outline-none focus-visible:outline-none [&_.leaflet-control-container]:hidden"
            zoomControl={false}
            attributionControl={false}
            preferCanvas
            keyboard={false}
          >
            <TileLayer
              key={tileConfig.key}
              url={tileConfig.url}
              tileSize={256}
              maxZoom={18}
              attribution={tileConfig.attribution}
              {...(tileConfig.subdomains ? { subdomains: tileConfig.subdomains } : {})}
            />
            {locations.map((loc) => {
              const isActive = activeLocation?.key === loc.key
              return (
                <CircleMarker
                  key={loc.key}
                  center={[loc.latitude, loc.longitude]}
                  radius={isActive ? 14 : 9}
                  weight={2}
                  opacity={0.9}
                  fillOpacity={0.65}
                  color={isActive ? "#22d3ee" : "#38bdf8"}
                  fillColor={isActive ? "#f472b6" : "#0ea5e9"}
                  eventHandlers={{
                    click: () => setActiveKey(loc.key),
                    mouseover: () => setActiveKey(loc.key),
                  }}
                  className="transition-all duration-300"
                >
                  <Popup>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-900">{loc.name}</p>
                      <p className="text-xs text-slate-500">
                        {viewAllLabel.replace("{{count}}", String(loc.sets.length))}
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
        </div>

        <div className="rounded-3xl border border-slate-200/60 bg-white/80 p-6 sm:p-8 shadow-[0_30px_70px_-35px_rgba(30,41,59,0.6)] backdrop-blur">
          {activeLocation ? (
            <div className="flex h-full flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{formattedCTA}</p>
                  <h3 className="text-xl sm:text-2xl font-semibold text-slate-900">
                    {activeLocation.name}
                  </h3>
                </div>
                <div className="text-xs sm:text-sm font-mono uppercase tracking-[0.4em] text-slate-400">
                  {`LAT ${activeLocation.latitude.toFixed(2)}° • LON ${activeLocation.longitude.toFixed(2)}°`}
                </div>
              </div>

              <div className="grid gap-4 overflow-y-auto pr-1 sm:grid-cols-1 md:grid-cols-2" style={{ maxHeight: "22rem" }}>
                {activeLocation.sets.map((set) => (
                  <Link
                    key={set.id}
                    href={`/work/${set.id}`}
                    className="group overflow-hidden rounded-2xl border border-slate-200/60 bg-white/50 transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_-25px_rgba(30,41,59,0.45)]"
                  >
                    <div className="relative aspect-[5/4] overflow-hidden">
                      <Image
                        src={set.coverUrl}
                        alt={set.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        priority={false}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/55 via-slate-900/0 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    </div>
                    <div className="px-4 py-3">
                      <h4 className="text-base font-semibold text-slate-900 line-clamp-1">
                        {set.title}
                      </h4>
                      {set.subtitle && (
                        <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                          {set.subtitle}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300/60 bg-white/60 p-6 text-center text-sm text-slate-500">
              {emptyLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
