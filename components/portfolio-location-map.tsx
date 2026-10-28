"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import type { PortfolioLocationMapProps } from "./portfolio-location-map-canvas"
import chrome from "./portfolio-chrome.module.css"

type CanvasModule = typeof import("./portfolio-location-map-canvas")

function MapPlaceholder() {
  return <div className={chrome.coordinateLoading} aria-hidden="true"><div className={chrome.mapFrame} /><div className={chrome.coordinateLoadingAside} /></div>
}

const DynamicMap = dynamic<PortfolioLocationMapProps>(
  () => import("./portfolio-location-map-canvas").then((mod: CanvasModule) => mod.PortfolioLocationMapCanvas),
  {
    ssr: false,
    loading: MapPlaceholder,
  },
)

export type { MapLocationCluster, MapLocationSet, PortfolioLocationMapProps } from "./portfolio-location-map-canvas"

export function PortfolioLocationMap(props: PortfolioLocationMapProps) {
  const root = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const node = root.current
    if (!node) return
    const scrollRoot = node.closest<HTMLElement>("[data-portfolio-scroll-root]")
    const scroller = scrollRoot?.dataset.embedded === "true" ? window : scrollRoot || window
    let frame = 0, loaded = false
    const load = () => {
      if (loaded) return
      loaded = true
      setReady(true)
      observer.disconnect()
      scroller.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
    const check = () => {
      frame = 0
      const rect = node.getBoundingClientRect()
      if (rect.top < window.innerHeight + 320 && rect.bottom > -320) load()
    }
    const schedule = () => { if (!loaded && !frame) frame = requestAnimationFrame(check) }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) load() }, { rootMargin: "320px" })
    observer.observe(node)
    // A restored nested scroll position can land before its first intersection notification.
    scroller.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    schedule()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); scroller.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule) }
  }, [])
  return <div ref={root}>{ready ? <DynamicMap {...props} /> : <MapPlaceholder />}</div>
}
