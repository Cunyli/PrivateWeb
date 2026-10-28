"use client"

import { useEffect, useRef, useState } from "react"
import type { RefObject } from "react"

type EventName = "request" | "presented" | "settled"
const rounded = (n: number) => Math.round(n * 10) / 10
const p95 = (values: number[]) => [...values].sort((a,b) => a-b)[Math.floor(values.length * .95)] || 0

// Explicit Safari/native-input audit. No listeners, timer or RAF on ordinary URLs.
export function useViewerNativeProbe(stage: RefObject<HTMLDivElement | null>) {
  const record = useRef<((event: EventName, index: number) => void) | undefined>(undefined)
  const [report, setReport] = useState<string | null>(null)
  useEffect(() => {
    if (new URLSearchParams(location.search).get("audit") !== "viewer") return
    const started = performance.now(), events: {event: EventName; index: number; atMs: number}[] = []
    const frames: number[] = [], movingFrames: number[] = [], delays: number[] = []
    const originalSizes = new Set<string>()
    let frame = 0, previous = 0, lastReport = 0, wasMoving = false, peakPhotoPixels = 0, peakMovingPixels = 0
    const inspect = () => {
      const photos = [...(stage.current?.querySelectorAll<HTMLImageElement>("img") || [])]
      const pixels = photos.reduce((total,image) => total + image.naturalWidth * image.naturalHeight,0)
      peakPhotoPixels = Math.max(peakPhotoPixels,pixels)
      if (stage.current?.dataset.galleryState === "moving") peakMovingPixels = Math.max(peakMovingPixels,pixels)
      photos.filter(image => image.hasAttribute("data-original-photo") && image.naturalWidth).forEach(image => originalSizes.add(`${image.naturalWidth}x${image.naturalHeight}`))
    }
    record.current = (event,index) => { events.push({ event,index,atMs: rounded(performance.now()-started) }); inspect() }
    const input = (event: Event) => {
      if (event.type === "keydown" && !["ArrowLeft","ArrowRight"].includes((event as KeyboardEvent).key)) return
      const stamp = event.timeStamp > 1e12 ? event.timeStamp-performance.timeOrigin : event.timeStamp
      const delay = performance.now()-stamp
      if (delay >= 0 && delay < 10000) delays.push(delay)
      inspect()
    }
    const stop = () => {
      record.current = undefined
      window.removeEventListener("pointerdown",input,true)
      window.removeEventListener("keydown",input,true)
      stage.current?.removeEventListener("load",inspect,true)
    }
    const tick = (now: number) => {
      const moving = stage.current?.dataset.galleryState === "moving"
      if (previous && !document.hidden) {
        const gap = now-previous
        frames.push(gap)
        if (moving && wasMoving) movingFrames.push(gap)
      }
      previous=now; wasMoving=moving
      const complete=now-started >= 20000
      if (complete || now-lastReport >= 1000) {
        lastReport=now; inspect()
        const nav=performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
        const fullNavigation=nav && new URL(nav.name).pathname === location.pathname
        setReport(JSON.stringify({mode:"native photo input",phase:complete?"complete":"sampling",durationS:rounded((now-started)/1000),
          method:"Real input; callback intervals, not GPU presentation. Moving gaps include stalls over 80ms.",
          viewport:`${innerWidth}x${innerHeight}`,density:devicePixelRatio,visible:!document.hidden,
          documentResponseMs:fullNavigation?rounded(nav.responseStart):null,viewerMountedAtMs:rounded(started),
          pageP95ms:rounded(p95(frames)),maxPageGapMs:rounded(Math.max(0,...frames)),
          movingP95ms:rounded(p95(movingFrames)),maxMovingGapMs:rounded(Math.max(0,...movingFrames)),movingGapsOver25ms:movingFrames.filter(n=>n>25).length,
          inputQueueP95ms:rounded(p95(delays)),peakDOMPhotoMiB:rounded(peakPhotoPixels*4/1024/1024),peakMovingDOMPhotoMiB:rounded(peakMovingPixels*4/1024/1024),originalSizes:[...originalSizes],
          events:events.slice(-36),
        },null,2))
      }
      if (complete) stop()
      else frame=requestAnimationFrame(tick)
    }
    window.addEventListener("pointerdown",input,{capture:true,passive:true})
    window.addEventListener("keydown",input,true)
    stage.current?.addEventListener("load",inspect,true)
    frame=requestAnimationFrame(tick)
    return () => {cancelAnimationFrame(frame);stop()}
  },[stage])
  return {record,report}
}
