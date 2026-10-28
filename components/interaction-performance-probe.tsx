"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

const percentile = (values: number[], fraction: number) => {
  const ordered = values.slice().sort((a, b) => a - b)
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))] || 0
}
const round = (value: number) => Math.round(value * 10) / 10
const summary = (values: number[], budget: number) => ({
  frames: values.length,
  callbackHz: values.length ? round(1000 * values.length / values.reduce((sum, value) => sum + value, 0)) : 0,
  p95ms: round(percentile(values, .95)),
  maxMs: round(Math.max(0, ...values)),
  overBudgetPct: values.length ? round(values.filter(value => value > budget * 1.5).length * 100 / values.length) : 0,
})

// Explicit local audit only. Normal visits install no sampler or input listeners.
// RAF cadence is a main-thread diagnostic, not a GPU presentation counter.
export function InteractionPerformanceProbe() {
  const pathname = usePathname()
  const [report, setReport] = useState<string | null>(null)
  const [hud, setHud] = useState(false)
  const capture = useRef<(() => void) | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("audit") !== "1") { setReport(null); setHud(false); return }
    setHud(params.get("hud") === "1")
    let started = performance.now()
    const frames: number[] = [], activeFrames: number[] = [], inputDelay: number[] = []
    const taskDetails: Array<{durationMs: number; sinceStartMs: number; section: string | null; scrollY: number; duringInput: boolean}> = []
    const eventCounts: Record<string, number> = {}
    const gaps: Array<{ms:number;sinceStartMs:number;section:string;bookTurning:boolean}> = []
    const sectionAtCenter = () => {
      const node=document.elementFromPoint(innerWidth/2,innerHeight/2)
      return node?.closest("[data-performance-section]")?.getAttribute("data-performance-section") ||
        node?.closest("[data-return-section]")?.getAttribute("data-return-section") ||
        node?.closest("[data-photo-series]")?.getAttribute("data-photo-series") ||
        node?.closest("section")?.id || (document.querySelector('[data-native-transition="running"]') ? "photo-transition" : pathname)
    }
    let frame = 0, previous = 0, lastReport = 0, activeUntil = 0, lastInput = -Infinity
    let longTaskTotal = 0, longTaskCount = 0, calibratedBudget = Infinity, recording = true, deadline = 0
    const supported = typeof PerformanceObserver !== "undefined" ? PerformanceObserver.supportedEntryTypes : []
    const hasLongTasks = supported.includes("longtask")
    const observer = hasLongTasks ? new PerformanceObserver(list => {
      if(!recording)return
      for (const entry of list.getEntries()) {
        longTaskCount++; longTaskTotal += entry.duration
        taskDetails.push({durationMs:round(entry.duration),sinceStartMs:round(entry.startTime-started),
          section:document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest("section")?.id || null,
          scrollY:round(window.scrollY),duringInput:entry.startTime<activeUntil})
      }
      if (taskDetails.length > 40) taskDetails.splice(0,taskDetails.length-40)
    }) : undefined
    observer?.observe({type:"longtask"})
    const events = ["scroll", "wheel", "pointerdown", "pointermove", "pointerup", "keydown"] as const
    const input = (event: Event) => {
      if(!recording)return
      const now = performance.now()
      const stamp = event.timeStamp > 1e12 ? event.timeStamp - performance.timeOrigin : event.timeStamp
      if (event.type !== "scroll" && stamp > 0 && now - stamp >= 0 && now - stamp < 10000) inputDelay.push(now - stamp)
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1
      lastInput = now
      const duration = event.type === "scroll" || event.type === "wheel" || event.type === "pointermove" ? 260 : 1400
      activeUntil = Math.max(activeUntil,now+duration)
    }
    const publish = (now: number) => {
      // Bound audit memory, and do sorting/DOM attribution once per second.
      if (frames.length>7200) frames.splice(0,frames.length-7200)
      if (activeFrames.length>7200) activeFrames.splice(0,activeFrames.length-7200)
      if (inputDelay.length>4096) inputDelay.splice(0,inputDelay.length-4096)
      const median = percentile(frames.slice(-240),.5) || 1000/60
      const observedHz = 1000/median
      const rates = [30,48,50,60,72,75,80,90,100,120,144,165,180,240]
      const nearest = rates.reduce((best,rate)=>Math.abs(rate-observedHz)<Math.abs(best-observedHz)?rate:best,rates[0])
      const candidate = Math.abs(nearest-observedHz)/observedHz<.08 ? 1000/nearest : median
      if(frames.length>=120)calibratedBudget=Math.min(calibratedBudget,candidate)
      const budget = Number.isFinite(calibratedBudget)?calibratedBudget:candidate
      const hz = 1000/budget
      const unique = new Map<string, HTMLImageElement>()
      document.querySelectorAll<HTMLImageElement>("img").forEach(image => {
        if(image.complete && image.naturalWidth) unique.set(image.currentSrc||image.src,image)
      })
      const pixels = [...unique.values()].reduce((sum,image)=>sum+image.naturalWidth*image.naturalHeight,0)
      setReport(JSON.stringify({phase:recording?"sampling":"complete",path:pathname,viewport:`${innerWidth}x${innerHeight}`,
        durationS:round((now-started)/1000),method:"Native input; RAF callback cadence. Not GPU or physical-panel FPS.",
        deliveredRefreshHz:round(hz),frameBudgetMs:round(budget),page:summary(frames,budget),active:summary(activeFrames,budget),
        inputEvents:eventCounts,inputQueueP95ms:round(percentile(inputDelay,.95)),lastInputAgoMs:Number.isFinite(lastInput)?round(now-lastInput):null,
        longTasks:hasLongTasks?longTaskCount:null,longTaskTotalMs:hasLongTasks?round(longTaskTotal):null,longTaskDetailsAtDelivery:taskDetails,
        section:sectionAtCenter(),rafGapDetails:gaps,
        worstGap:gaps.reduce((worst,item)=>item.ms>(worst?.ms||0)?item:worst,null as typeof gaps[number]|null),
        paper:document.querySelector<HTMLElement>("[data-portrait-book]")?.dataset,
        imageElements:document.querySelectorAll("img").length,decodedUniqueImages:unique.size,decodedPixelEstimateMiB:round(pixels*4/1024/1024),
        visible:!document.hidden,focused:document.hasFocus(),slowPaper:params.has("paperSlow"),reducedMotion:matchMedia("(prefers-reduced-motion: reduce)").matches,
      },null,2))
    }
    const tick = (now: number) => {
      frame=0
      if(!recording)return
      const foreground=!document.hidden && document.hasFocus()
      if(previous && foreground){
        const delta=now-previous
        frames.push(delta)
        if(delta>Math.max((Number.isFinite(calibratedBudget)?calibratedBudget:1000/60)*1.5,24)){
          gaps.push({ms:round(delta),sinceStartMs:round(now-started),section:sectionAtCenter(),
            bookTurning:document.querySelector('[data-portrait-book][data-turning="true"]')!==null})
          if(gaps.length>40)gaps.shift()
        }
        if(now<=activeUntil)activeFrames.push(delta)
      }
      previous=foreground?now:0
      if(deadline && now>=deadline){recording=false;publish(now);return}
      if(now-lastReport>1000){lastReport=now;publish(now)}
      frame=requestAnimationFrame(tick)
    }
    capture.current=()=>{
      frames.length=0;activeFrames.length=0;inputDelay.length=0;taskDetails.length=0;gaps.length=0
      Object.keys(eventCounts).forEach(key=>delete eventCounts[key])
      longTaskCount=0;longTaskTotal=0;previous=0;lastReport=0;lastInput=-Infinity;activeUntil=0
      started=performance.now();deadline=started+6000;recording=true
      publish(started)
      if(!frame)frame=requestAnimationFrame(tick)
    }
    const visibility = () => {previous=0;activeUntil=0}
    events.forEach(name=>window.addEventListener(name,input,{passive:true,capture:true}))
    document.addEventListener("visibilitychange",visibility)
    window.addEventListener("blur",visibility)
    window.addEventListener("focus",visibility)
    window.addEventListener("pagehide",visibility)
    window.addEventListener("pageshow",visibility)
    frame=requestAnimationFrame(tick)
    return()=>{
      capture.current=null
      cancelAnimationFrame(frame);observer?.disconnect()
      events.forEach(name=>window.removeEventListener(name,input,true))
      document.removeEventListener("visibilitychange",visibility)
      window.removeEventListener("blur",visibility)
      window.removeEventListener("focus",visibility)
      window.removeEventListener("pagehide",visibility)
      window.removeEventListener("pageshow",visibility)
    }
  },[pathname])
  if(!report)return null
  const info = JSON.parse(report)
  return <>
    <pre hidden data-interaction-performance>{report}</pre>
    {hud && <aside aria-label="Local performance audit" style={{
      position:"fixed",zIndex:20000,left:8,bottom:8,maxWidth:"min(330px,65vw)",
      padding:"9px 12px",borderRadius:6,background:"#102321ed",color:"#d8f4df",fontFamily:"monospace",fontSize:11,lineHeight:1.6,pointerEvents:"none",
    }}>
      <div>{info.path} · {info.viewport}</div>
      <div>Browser cadence: {info.deliveredRefreshHz} Hz</div>
      <div>Page: {info.page.callbackHz} Hz · p95 {info.page.p95ms} ms</div>
      <div>Active: {info.active.callbackHz} Hz · p95 {info.active.p95ms} ms</div>
      <div>Active gaps: {info.active.overBudgetPct}% · max {info.active.maxMs} ms</div>
      <div>Input p95: {info.inputQueueP95ms} ms · tasks {info.longTasks ?? "n/a"}</div>
      <div>Frames: {info.page.frames} / {info.active.frames} active</div>
      {info.worstGap && <div>Worst: {info.worstGap.ms} ms @ {info.worstGap.section}</div>}
      {info.paper && <div>Book setup {info.paper.paperSetupMs||"–"} ms / page {info.paper.paperBuildMaxMs||"–"} ms</div>}
      <div>{info.phase === "complete" ? "Capture complete" : "Live"} · callback timing</div>
      <button type="button" aria-label="Capture performance for six seconds" onClick={()=>capture.current?.()} style={{pointerEvents:"auto",marginTop:5,padding:"2px 6px",border:"1px solid #527966",borderRadius:3,font: "inherit",color:"inherit",background:"transparent"}}>Capture 6s</button>
    </aside>}
  </>
}
