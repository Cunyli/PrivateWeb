"use client"

import { useEffect, useRef, useState } from "react"

const round = (value: number) => Math.round(value * 10) / 10
const p95 = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length * .95)] || 0 }

// Runs only on the explicit diagnostic URL. Normal viewing has no sampling loop.
export function useViewerFrameProbe(ready: boolean, benchmarkStep: () => void) {
  const onMotionFrame = useRef<(() => void) | undefined>(undefined)
  const step = useRef(benchmarkStep)
  step.current = benchmarkStep
  const [report, setReport] = useState<string | null>(null)
  useEffect(() => {
    if (!ready || new URLSearchParams(window.location.search).get("perf") !== "1") return
    const benchmark = new URLSearchParams(window.location.search).get("motion") === "viewer"
    const started = performance.now()
    let frame = 0, lastReport = 0, cycles = 0
    const page: number[] = [], motion: number[] = []
    onMotionFrame.current = () => { motion.push(performance.now()) }
    const tick = (now: number) => {
      page.push(now)
      if (document.querySelector('[data-native-transition="running"]')) motion.push(now)
      const complete = benchmark && now - started >= 11000
      if (complete || now - lastReport > 1000) {
        lastReport = now
        while (page.length && page[0] < now - 6000) page.shift()
        while (motion.length && motion[0] < now - 6000) motion.shift()
        const intervals = page.slice(1).map((n, i) => n - page[i])
        const moving = motion.slice(1).map((n, i) => n - motion[i]).filter(n => n > 2 && n < 80)
        setReport(JSON.stringify({
          mode: "elastic photo viewer", method: "Page callback cadence while native animations run; not GPU presentation FPS", phase: complete ? "complete" : "sampling", benchmarkTransitions: benchmark ? Math.min(cycles, 6) : null, windowS: round((now - (page[0] || now)) / 1000),
          pageFps: page.length > 1 ? round(1000 * (page.length - 1) / (page[page.length - 1] - page[0])) : 0,
          activeMotionFps: moving.length ? round(1000 * moving.length / moving.reduce((a, b) => a + b, 0)) : 0,
          pageP95ms: round(p95(intervals)), motionP95ms: round(p95(moving)),
          over25msPct: round(100 * intervals.filter(n => n > 25).length / Math.max(1, intervals.length)),
          slides: document.querySelectorAll("[data-photo-slide]").length,
          viewport: `${innerWidth}x${innerHeight}`, visible: !document.hidden,
        }, null, 2))
      }
      if (!complete) frame = requestAnimationFrame(tick)
    }
    const clear = () => { page.length = 0; motion.length = 0 }
    document.addEventListener("visibilitychange", clear)
    frame = requestAnimationFrame(tick)
    const benchmarkTimer = benchmark
      ? window.setInterval(() => { if (++cycles <= 6) step.current(); else window.clearInterval(benchmarkTimer) }, 1400) : 0
    return () => {
      cancelAnimationFrame(frame); window.clearInterval(benchmarkTimer)
      document.removeEventListener("visibilitychange", clear)
      onMotionFrame.current = undefined
    }
  }, [ready])
  return { report, onMotionFrame }
}
