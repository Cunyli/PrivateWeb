"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowUpRight, ChevronDown } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { capturePortfolioPosition } from "@/lib/portfolio-return"
import { bindMapWheelGestures } from "@/lib/map-wheel-gestures"
import chrome from "./portfolio-chrome.module.css"

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
  const mapRootRef = useRef<HTMLDivElement | null>(null)
  const leafletMapRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const latestActiveKeyRef = useRef<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [embedded, setEmbedded] = useState(false)
  useEffect(() => setEmbedded(document.querySelector<HTMLElement>("[data-portfolio-scroll-root]")?.dataset.embedded === "true"), [])
  const { locale } = useI18n()

  const buildWorkHref = useCallback((setId: number | string) => {
    const params = new URLSearchParams()
    params.set("origin", embedded ? "home" : "portfolio")
    params.set("returnSection", "coordinates")
    params.set("returnSet", String(setId))
    return `/work/${setId}?${params.toString()}`
  }, [embedded])

  useEffect(() => {
    if (!locations.length) {
      setActiveKey(null)
      return
    }
    if (!activeKey || !locations.some(location => location.key === activeKey)) {
      const saved = window.sessionStorage.getItem("portfolio:return-map-location")
      setActiveKey(saved && locations.some(location => location.key === saved) ? saved : locations[0]?.key ?? null)
    }
  }, [locations, activeKey])
  useEffect(() => {
    latestActiveKeyRef.current = activeKey
  }, [activeKey])

  const activeLocation = useMemo(() => {
    if (!activeKey) return null
    return locations.find((loc) => loc.key === activeKey) ?? null
  }, [activeKey, locations])

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

  const mapKey = useMemo(
    () => `${tileConfig.key}:${locations.map((loc) => loc.key).join("|")}`,
    [locations, tileConfig.key],
  )

  useEffect(() => {
    let cancelled = false
    let resizeFrame = 0
    let resizeObserver: ResizeObserver | null = null
    let releaseWheelGestures: (() => void) | undefined
    setMapReady(false)

    const mountMap = async () => {
      const root = mapRootRef.current
      if (!root) return

      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
        markersLayerRef.current = null
      }

      root.innerHTML = ""

      const leaflet = await import("leaflet")
      if (cancelled || !mapRootRef.current) return

      const map = leaflet.map(root, {
        center: [locations[0].latitude, locations[0].longitude],
        zoom: 4,
        minZoom: 2,
        maxZoom: 12,
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
        dragging: true,
        touchZoom: true,
        preferCanvas: true,
        keyboard: true,
        zoomSnap: .25,
      })

      leaflet
        .tileLayer(tileConfig.url, {
          tileSize: 256,
          maxZoom: 18,
          attribution: tileConfig.attribution,
          ...(tileConfig.subdomains ? { subdomains: tileConfig.subdomains } : {}),
        })
        .addTo(map)

      const markersLayer = leaflet.layerGroup().addTo(map)
      leafletMapRef.current = map
      releaseWheelGestures = bindMapWheelGestures(map, root.parentElement || root)
      markersLayerRef.current = markersLayer

      const bounds = leaflet.latLngBounds(locations.map((loc) => [loc.latitude, loc.longitude]))
      map.fitBounds(bounds.pad(0.2), { animate: false })
      resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame)
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = 0
          if (!cancelled) map.invalidateSize({ pan: false, animate: false })
        })
      })
      resizeObserver.observe(root)
      setMapReady(true)
    }

    void mountMap()

    return () => {
      cancelled = true
      releaseWheelGestures?.()
      cancelAnimationFrame(resizeFrame)
      resizeObserver?.disconnect()
      setMapReady(false)
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
        markersLayerRef.current = null
      }
    }
  }, [mapKey])

  useEffect(() => {
    let cancelled = false
    let markerSyncFrame = 0

    const syncMarkers = async () => {
      if (!mapReady || !leafletMapRef.current || !markersLayerRef.current) return
      const leaflet = await import("leaflet")
      if (cancelled || !leafletMapRef.current || !markersLayerRef.current) return

      const map = leafletMapRef.current
      const bounds = map.getBounds()
      const west = bounds.getWest()
      const east = bounds.getEast()
      const centerLng = map.getCenter().lng
      const span = Math.max(360, Math.abs(east - west))
      const paddedWest = west - span
      const paddedEast = east + span

      markersLayerRef.current.clearLayers()

      for (const loc of locations) {
        const isActive = (latestActiveKeyRef.current ?? activeKey) === loc.key
        const minCopy = Math.floor((paddedWest - loc.longitude) / 360)
        const maxCopy = Math.ceil((paddedEast - loc.longitude) / 360)
        const centerCopy = Math.round((centerLng - loc.longitude) / 360)
        const safeMinCopy = Math.max(minCopy, centerCopy - 4)
        const safeMaxCopy = Math.min(maxCopy, centerCopy + 4)

        for (let copy = safeMinCopy; copy <= safeMaxCopy; copy += 1) {
          leaflet
            .circleMarker([loc.latitude, loc.longitude + copy * 360], {
            radius: isActive ? 10 : 6,
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.65,
            color: isActive ? "#f3f0e9" : "#eef0df",
            fillColor: isActive ? "#334d3f" : "#657b6b",
          })
            .on("click", () => setActiveKey(loc.key))
            .on("mouseover", () => setActiveKey(loc.key))
            .addTo(markersLayerRef.current)
        }
      }
    }

    const scheduleMarkerSync = () => {
      if (typeof window === "undefined") return
      if (markerSyncFrame) return
      markerSyncFrame = window.requestAnimationFrame(() => {
        markerSyncFrame = 0
        void syncMarkers()
      })
    }

    void syncMarkers()
    const map = leafletMapRef.current
    map?.on("moveend", scheduleMarkerSync)
    map?.on("zoomend", scheduleMarkerSync)
    map?.on("resize", scheduleMarkerSync)

    return () => {
      cancelled = true
      if (markerSyncFrame && typeof window !== "undefined") {
        window.cancelAnimationFrame(markerSyncFrame)
      }
      map?.off("moveend", scheduleMarkerSync)
      map?.off("zoomend", scheduleMarkerSync)
      map?.off("resize", scheduleMarkerSync)
    }
  }, [activeKey, locations, mapReady])

  if (!locations.length) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-slate-300/60 bg-white/60 p-6 text-center text-sm text-slate-500">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className={chrome.coordinateLayout}>
      <div className={chrome.mapFrame} role="region" aria-label={heading}>
        <div ref={mapRootRef} className="h-full w-full" />
        {!mapReady && <div className="pointer-events-none absolute inset-0 animate-pulse bg-white/40" />}
      </div>
      <div className={chrome.coordinateAside}>
        {activeLocation ? <>
          <label className={chrome.placeField}>
            <span className={chrome.placeSelectWrap}>
              <select className={chrome.placeSelect} value={activeKey || ""} aria-label={locale === "zh" ? "选择拍摄地点" : "Choose a location"}
                onChange={event => {
                  const location = locations.find(item => item.key === event.target.value)
                  if (!location) return
                  setActiveKey(location.key)
                  leafletMapRef.current?.panTo([location.latitude, location.longitude], {animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches, duration: .45})
                }}>
                {locations.map(location => <option key={location.key} value={location.key}>{location.name}</option>)}
              </select>
              <ChevronDown size={18} strokeWidth={1.4} aria-hidden="true" />
            </span>
          </label>
          <div className={chrome.locationSets}>
            {activeLocation.sets.map(set => <Link key={set.id} href={buildWorkHref(set.id)} data-set-id={set.id}
              aria-label={[set.title,set.subtitle].filter(Boolean).join(" · ")}
              onClick={event => {window.sessionStorage.setItem("portfolio:return-map-location",activeKey || "");capturePortfolioPosition(event.currentTarget)}}
              className={chrome.locationSet}>
              <span className={chrome.locationThumb}><Image src={set.coverUrl} alt="" fill sizes="(max-width: 1023px) 96px, 108px" className="object-cover" /></span>
              <div className={chrome.locationSetCopy}>
                <h4>{set.title}</h4>{set.subtitle && <p>{set.subtitle}</p>}
              </div>
              <ArrowUpRight size={16} strokeWidth={1.4} aria-hidden="true" />
            </Link>)}
          </div>
        </> : <div className="rounded-sm border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">{emptyLabel}</div>}
      </div>
    </div>
  )
}
