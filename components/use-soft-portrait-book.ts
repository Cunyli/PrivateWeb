"use client"

import { useEffect, useLayoutEffect, useRef } from "react"
import { createSoftPageRenderer } from "@/lib/soft-page-renderer"
import type { SoftPageRenderer } from "@/lib/soft-page-renderer"

export type BookDirection = 1 | -1
export const portraitSpreadKey = "portfolio:portrait-spread"
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value))

export function useSoftPortraitBook({book, canvas, spread, count, paused, onSpread, onBusy}: {
  book: HTMLDivElement | null
  canvas: HTMLCanvasElement | null
  spread: number
  count: number
  paused: boolean
  onSpread: (spread: number) => void
  onBusy: (busy: boolean) => void
}) {
  const advance = useRef<(direction: BookDirection) => void>(() => {})
  const currentSpread = useRef(spread)
  useLayoutEffect(() => {currentSpread.current = spread}, [spread])

  useEffect(() => {
    if (!book || !canvas || paused) {if (book) book.dataset.turning = "false"; onBusy(false); return}
    const pages = [...book.querySelectorAll<HTMLElement>("[data-book-leaf]")]
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const timeScale = process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).has("paperSlow") ? .3 : 1
    const saved = Number(window.sessionStorage.getItem(portraitSpreadKey))
    let current = Number.isInteger(saved) && saved >= 0 && saved < count ? saved : currentSpread.current
    let renderer: SoftPageRenderer | null | undefined
    let turn: {from: number; to: number; direction: BookDirection} | null = null
    let gesture: {id: number; x: number; y: number; lastX: number; time: number; speed: number; width: number; grip: number; dragging: boolean; cancelled: boolean} | null = null
    let frame = 0, last = 0, token = 0
    let fallbackAnimations: Animation[] = []
    let progress = 0, velocity = 0, target = 0, bend = 0, bendVelocity = 0, grip = .75
    let ready = false, curved = false, settling = false, suppressClick = false, disposed = false, near = false
    let width = book.clientWidth, height = book.clientHeight, pixelRatio = window.devicePixelRatio
    const frameTimes: number[] = []
    const show = (left: number, right: number) => pages.forEach((page, index) => {
      const visible = index === left || index === right
      page.dataset.pageVisible = String(visible)
      page.setAttribute("aria-hidden", String(!visible))
      page.tabIndex = visible ? 0 : -1
    })
    const showSpread = (index: number) => show(index * 2, index * 2 + 1)
    const busy = (value: boolean) => {book.dataset.turning = String(value); onBusy(value)}
    const ensureRenderer = () => {
      if (renderer === undefined && !motion.matches) {
        renderer = createSoftPageRenderer(book, canvas)
        book.dataset.paperRenderer = renderer ? "webgl-mesh" : "fade"
      }
      return renderer
    }
    const warm = () => {
      pages.forEach(page => page.querySelectorAll("img").forEach(image => {image.loading = "eager"}))
      if (motion.matches) return
      const paper = ensureRenderer()
      if (paper) void paper.warm().then(() => {if (!disposed && !turn) void paper.showSpread(current)})
    }
    const isNear = () => {
      const rect = book.getBoundingClientRect()
      return rect.top < window.innerHeight + 200 && rect.bottom > -200
    }
    const stopFallback = () => {
      fallbackAnimations.forEach(animation => {animation.onfinish = null; animation.cancel()})
      fallbackAnimations = []
    }
    const finish = (commit: boolean) => {
      const next = commit && turn ? turn.to : current
      // Paint the exact end pose before updating the link/React state. The
      // visible sheet stays on its prepared textures through this commit.
      if (turn && ready && curved) renderer?.draw(commit ? 1 : 0, 0, grip, turn.direction)
      if (renderer) void renderer.showSpread(next)
      showSpread(next); stopFallback()
      current = next
      window.sessionStorage.setItem(portraitSpreadKey, String(next))
      if (frameTimes.length > 3) {
        const ordered = frameTimes.slice().sort((a, b) => a - b)
        book.dataset.paperFrameMs = ordered[Math.floor(ordered.length / 2)].toFixed(2)
        book.dataset.paperFrameP95Ms = ordered[Math.floor((ordered.length - 1) * .95)].toFixed(2)
        book.dataset.paperFrameMaxMs = ordered[ordered.length - 1].toFixed(2)
        book.dataset.paperFramesOver25Ms = String(ordered.filter(ms => ms > 25).length)
        book.dataset.paperFrames = String(frameTimes.length)
      }
      turn = null; ready = false; settling = false
      progress = 0; velocity = 0; bend = 0; bendVelocity = 0; last = 0
      delete book.dataset.turnProgress; delete book.dataset.paperBend
      busy(false); onSpread(next)
    }
    const tick = (now: number) => {
      frame = 0
      if (!turn || !ready) return
      const elapsed = last ? now - last : 1000 / 60
      if (last) frameTimes.push(elapsed)
      const dt = Math.min(1 / 30, elapsed / 1000) * timeScale
      last = now
      const dragging = !!gesture?.dragging
      velocity += ((target - progress) * (dragging ? 500 : 165) - velocity * (dragging ? 38 : 20)) * dt
      progress = clamp(progress + velocity * dt, -.035, 1.035)
      const bendTarget = Math.sin(Math.PI * clamp(progress)) * 2.05
      bendVelocity += ((bendTarget - bend) * 195 - bendVelocity * 23) * dt
      bend += bendVelocity * dt
      const paperBend = bendTarget * .8 + bend * .2
      renderer?.draw(progress, paperBend, grip, turn.direction)
      book.dataset.turnProgress = progress.toFixed(4); book.dataset.paperBend = paperBend.toFixed(4)
      const moving = Math.abs(target - progress) > .0008 || Math.abs(velocity) > .012 || Math.abs(bendTarget - bend) > .002 || Math.abs(bendVelocity) > .02
      if (moving) frame = requestAnimationFrame(tick)
      else if (settling) finish(target === 1)
      else last = 0
    }
    const schedule = () => {if (ready && curved && !frame) frame = requestAnimationFrame(tick)}
    const settle = (commit: boolean) => {
      settling = true; target = commit ? 1 : 0
      if (!ready) return
      if (motion.matches || !commit && !curved) {finish(commit); return}
      if (!curved) {
        canvas.style.opacity = "0"; book.dataset.paperReady = "false"
        const next = turn!.to
        const outgoing = [pages[current * 2], pages[current * 2 + 1]]
        const incoming = [pages[next * 2], pages[next * 2 + 1]]
        for (const page of [...outgoing, ...incoming]) page.dataset.pageVisible = "true"
        fallbackAnimations = [
          ...outgoing.map(page => page.animate([{opacity: 1}, {opacity: 0}], {duration: 220, fill: "both"})),
          ...incoming.map(page => page.animate([{opacity: 0}, {opacity: 1}], {duration: 220, fill: "both"})),
        ]
        fallbackAnimations[fallbackAnimations.length - 1].onfinish = () => finish(true)
        return
      }
      last = 0; schedule()
    }
    const start = async (direction: BookDirection, at: number) => {
      if (turn || document.hidden) return
      const sequence = ++token
      turn = {from: current, to: (current + direction + count) % count, direction}
      grip = at; ready = false; settling = false; target = 0
      progress = 0; bend = 0; velocity = 0; bendVelocity = 0; last = 0; frameTimes.length = 0
      busy(true)
      const paper = ensureRenderer(), started = performance.now()
      const front = current * 2 + (direction === 1 ? 1 : 0)
      const back = turn.to * 2 + (direction === 1 ? 0 : 1)
      const success = paper ? await paper.prepare(front, back) : false
      if (disposed || sequence !== token || !turn) return
      book.dataset.paperPrepareMs = (performance.now() - started).toFixed(2)
      curved = success; ready = true
      if (curved) renderer!.draw(0, 0, grip, direction)
      // Keep the outgoing DOM spread intact until commit. The canvas already
      // includes the under-pages; exposing them again as HTML causes a second
      // picture change when Safari composites its transformed layers.
      if (settling) settle(target === 1)
      else schedule()
    }
    advance.current = direction => {if (!turn) {void start(direction, .75); settle(true)}}
    const down = (event: PointerEvent) => {
      if (turn || event.button !== 0 || !event.isPrimary) return
      suppressClick = false
      const rect = book.getBoundingClientRect()
      gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, time: event.timeStamp, speed: 0, width: rect.width / 2, grip: clamp((event.clientY - rect.top) / rect.height, .05, .95), dragging: false, cancelled: false}
    }
    const move = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id || gesture.cancelled) return
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y
      if (!gesture.dragging) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {gesture.cancelled = true; return}
        if (Math.abs(dx) < 9 || Math.abs(dx) < Math.abs(dy) * 1.15) return
        gesture.dragging = true; suppressClick = true
        book.setPointerCapture(event.pointerId); book.dataset.dragging = "true"
        void start(dx < 0 ? 1 : -1, gesture.grip)
      }
      event.preventDefault()
      const elapsed = event.timeStamp - gesture.time
      if (elapsed > 0) gesture.speed = (event.clientX - gesture.lastX) / elapsed
      gesture.lastX = event.clientX; gesture.time = event.timeStamp
      target = clamp(-dx * (turn?.direction ?? 1) / (gesture.width * .95)); schedule()
    }
    const up = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return
      const dragged = gesture.dragging
      const flick = event.timeStamp - gesture.time < 100 && -gesture.speed * (turn?.direction ?? 1) > .45
      gesture = null; delete book.dataset.dragging
      if (book.hasPointerCapture(event.pointerId)) book.releasePointerCapture(event.pointerId)
      if (dragged) settle(target > .22 || flick)
    }
    const cancel = () => {
      token++; cancelAnimationFrame(frame); frame = 0; stopFallback()
      if (gesture && book.hasPointerCapture(gesture.id)) book.releasePointerCapture(gesture.id)
      gesture = null; delete book.dataset.dragging
      if (turn) finish(false)
    }
    const click = (event: MouseEvent) => {
      if (!suppressClick && !turn) return
      event.preventDefault(); event.stopPropagation(); suppressClick = false
    }
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Enter") {suppressClick = false; return}
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      event.preventDefault(); advance.current(event.key === "ArrowRight" ? 1 : -1)
    }
    const visibility = () => {if (document.hidden) cancel()}
    const resizeBook = () => {
      if (width === book.clientWidth && height === book.clientHeight && pixelRatio === window.devicePixelRatio) return
      width = book.clientWidth; height = book.clientHeight; pixelRatio = window.devicePixelRatio
      cancel(); renderer?.resize(); if (near || isNear()) warm()
    }
    const resize = new ResizeObserver(resizeBook)
    const content = new MutationObserver(records => {
      if (!records.some(record => record.type === "attributes"
        ? record.target instanceof HTMLImageElement || record.attributeName === "data-book-layout"
        : record.target instanceof Element && !!record.target.closest("[data-book-leaf]"))) return
      cancel(); renderer?.resize(); if (near || isNear()) warm()
    })
    const scrollRoot = book.closest<HTMLElement>("[data-portfolio-scroll-root]")
    const scroller = scrollRoot?.dataset.embedded === "true" ? window : scrollRoot || window
    let visibilityFrame = 0, initiallyWarmed = false
    const stopInitialCheck = () => {
      initiallyWarmed = true
      scroller.removeEventListener("scroll", scheduleInitialCheck)
      window.removeEventListener("resize", scheduleInitialCheck)
    }
    const checkInitialView = () => {
      visibilityFrame = 0
      if (initiallyWarmed || disposed) return
      if (isNear()) {near = true; warm(); stopInitialCheck()}
    }
    const scheduleInitialCheck = () => {if (!initiallyWarmed && !visibilityFrame) visibilityFrame = requestAnimationFrame(checkInitialView)}
    // Restoring the nested gallery scroll can precede WebKit's first intersection notification.
    const visible = new IntersectionObserver(([entry]) => {
      near = entry.isIntersecting
      if (near) {warm(); stopInitialCheck()} else cancel()
    }, {rootMargin: "200px"})
    showSpread(current); busy(false); onSpread(current)
    resize.observe(book); visible.observe(book)
    scroller.addEventListener("scroll", scheduleInitialCheck, {passive: true})
    window.addEventListener("resize", scheduleInitialCheck)
    scheduleInitialCheck()
    content.observe(book, {subtree: true, childList: true, attributes: true, attributeFilter: ["src", "srcset", "sizes", "width", "height", "data-book-layout"]})
    book.addEventListener("pointerdown", down); book.addEventListener("pointermove", move)
    book.addEventListener("click", click, true); book.addEventListener("keydown", keyboard)
    book.addEventListener("portrait-renderer-lost", cancel)
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cancel)
    window.addEventListener("blur", cancel); window.addEventListener("resize", resizeBook)
    document.addEventListener("visibilitychange", visibility); motion.addEventListener("change", cancel)
    return () => {
      disposed = true; token++; cancelAnimationFrame(frame); cancelAnimationFrame(visibilityFrame); stopFallback()
      stopInitialCheck()
      advance.current = () => {}; resize.disconnect(); visible.disconnect(); content.disconnect()
      renderer?.dispose(); showSpread(current); delete book.dataset.dragging
      book.removeEventListener("pointerdown", down); book.removeEventListener("pointermove", move)
      book.removeEventListener("click", click, true); book.removeEventListener("keydown", keyboard)
      book.removeEventListener("portrait-renderer-lost", cancel)
      window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel)
      window.removeEventListener("blur", cancel); window.removeEventListener("resize", resizeBook)
      document.removeEventListener("visibilitychange", visibility); motion.removeEventListener("change", cancel)
    }
  }, [book, canvas, count, paused, onBusy, onSpread])
  return advance
}
