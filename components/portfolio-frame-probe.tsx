"use client"

import { useEffect, useState } from "react"
import type { MutableRefObject } from "react"
import type { DreamscapeInput } from "./portfolio-dreamscape"

type Sample = { time: number; cpu: number }
const percentile = (values: number[], fraction: number) => {
  const ordered = [...values].sort((a, b) => a - b)
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))] || 0
}
const round = (value: number) => Math.round(value * 10) / 10

// Opt-in local diagnostics: no observer, sampling loop or UI on the normal page.
export function PortfolioFrameProbe({ input }: { input: MutableRefObject<DreamscapeInput> }) {
  const [report, setReport] = useState<string | null>(null)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("perf") !== "1") return
    const motion = new URLSearchParams(window.location.search).get("motion")
    const simulate = motion === "1" || motion === "flight"
    let frame = 0, lastReport = 0
    const rafTimes: number[] = [], scene: Sample[] = []
    const record = (cpu: number) => { scene.push({ time: performance.now(), cpu }) }
    input.current.onFrame = record
    const tick = (now: number) => {
      if (simulate) { input.current.progress = (motion === "flight" ? .53 : .24) + Math.sin(now * .0011) * .20; input.current.position = (input.current.progress || 0) * 2.6 }
      rafTimes.push(now)
      if (now - lastReport > 1000) {
        lastReport = now
        const cutoff = now - 6000
        while (rafTimes.length && rafTimes[0] < cutoff) rafTimes.shift()
        while (scene.length && scene[0].time < cutoff) scene.shift()
        const intervals = rafTimes.slice(1).map((time, index) => time - rafTimes[index])
        const sceneIntervals = scene.slice(1).map((sample, index) => sample.time - scene[index].time)
        const fps = (times: number[]) => times.length > 1 ? (times.length - 1) * 1000 / (times[times.length - 1] - times[0]) : 0
        const canvas = document.querySelector("[data-scene-layers] canvas") as HTMLCanvasElement | null
        setReport(JSON.stringify({
          mode: motion === "flight" ? "cloud flight sweep" : simulate ? "camera sweep" : "native scroll",
          cloudFlight: canvas?.getAttribute("data-cloud-flight-ready"),
          windowS: round((now - (rafTimes[0] || now)) / 1000),
          pageFps: round(fps(rafTimes)),
          sceneFps: round(fps(scene.map(sample => sample.time))),
          pageP95ms: round(percentile(intervals, .95)),
          sceneP95ms: round(percentile(sceneIntervals, .95)),
          sceneCpuP95ms: round(percentile(scene.map(sample => sample.cpu), .95)),
          over25msPct: round(100 * intervals.filter(ms => ms > 25).length / Math.max(1, intervals.length)),
          canvas: canvas ? `${canvas.width}x${canvas.height}` : "none",
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          progress: round(input.current.progress || 0),
          visible: !document.hidden,
        }, null, 2))
      }
      frame = requestAnimationFrame(tick)
    }
    const visibility = () => { rafTimes.length = 0; scene.length = 0 }
    document.addEventListener("visibilitychange", visibility)
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("visibilitychange", visibility)
      if (input.current.onFrame === record) delete input.current.onFrame
    }
  }, [input])
  return report ? <aside data-portfolio-performance style={{ position: "fixed", zIndex: 1000, left: 8, bottom: 8, padding: 10, background: "#102321ed", color: "#d8f4df", borderRadius: 6, pointerEvents: "none" }}>
    <pre style={{ margin: 0, fontSize: 10, lineHeight: 1.3 }}>{report}</pre>
  </aside> : null
}
