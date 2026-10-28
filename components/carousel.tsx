"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion"
import type { PanInfo } from "framer-motion"
import { useI18n } from "@/lib/i18n"
import { photoSource } from "@/lib/portfolio-photo-source"
import { viewerPhotoSource } from "@/lib/viewer-photo-source"
import { PhotoPreviewCache } from "@/lib/photo-preview-cache"
import type { LoadedPhoto, PhotoSource } from "@/lib/photo-preview-cache"
import styles from "./portfolio-viewer.module.css"
import { useViewerFrameProbe } from "./viewer-frame-probe"
import { useViewerNativeProbe } from "./viewer-native-probe"

export { photoSource } from "@/lib/portfolio-photo-source"

export interface CarouselImage {
  id?: number | string | null
  url: string
  displayUrl?: string | null
  rawUrl?: string | null
  setId?: number | string | null
  translations: { en: { title?: string; subtitle?: string; description?: string }; zh: { title?: string; subtitle?: string; description?: string } }
}
type Slide = { serial: number; index: number; direction: number; photo: LoadedPhoto }
type Bounds = { width: number; height: number; left: number; density: number }
type Navigation = { direction: number; travel: number }
const SPRING = { type: "spring" as const, stiffness: 260, damping: 25, mass: 1.15 }
const modulo = (n: number, total: number) => ((n % total) + total) % total

// Sample a damped spring once. Playback uses native transform/opacity keyframes;
// the browser owns the animation clock, even when photo loading occupies JS.
function entranceFrames(fromX: number, fromY: number, travel: number): Keyframe[] {
  return Array.from({ length: 37 }, (_, index) => {
    const offset = index / 36, t = offset * .66
    const rest = index === 36 ? 0 : Math.exp(-10.87 * t) * (Math.cos(10.39 * t) + 1.046 * Math.sin(10.39 * t))
    const x = fromX * rest, y = fromY * rest, amount = Math.min(1, Math.abs(x) / travel)
    return { offset, transform: `translate3d(${x}px,${y}px,0) rotate(${Math.max(-4,Math.min(4,x/travel*3.5))}deg) scale(${1-amount*.055},${1+amount*.035})`, opacity: Math.min(1,.3+offset*3.2) }
  })
}

function PhotoSlide({ slide, image, bounds, active, navigation, navigable, onNavigate, onDragState, onFinish, failed }: {
  slide: Slide; image: CarouselImage; bounds: Bounds; active: boolean; navigation: Navigation; navigable: boolean
  onNavigate: (direction: number) => void; onDragState: (dragging: boolean) => void
  onFinish: (serial: number, active: boolean) => void; failed: boolean
}) {
  const { locale } = useI18n()
  const reduced = useReducedMotion()
  const pose = useRef<HTMLDivElement>(null)
  const animation = useRef<Animation | null>(null)
  const finish = useRef(onFinish)
  finish.current = onFinish
  const entered = useRef(false)
  const x = useMotionValue(0)
  // Dragging follows the pointer; the full slide transition does not use JS RAF.
  const rotate = useTransform(x, value => reduced ? 0 : Math.max(-4, Math.min(4, value / navigation.travel * 3.5)))
  const scaleX = useTransform(x, value => reduced ? 1 : 1 - Math.min(1, Math.abs(value) / navigation.travel) * .055)
  const scaleY = useTransform(x, value => reduced ? 1 : 1 + Math.min(1, Math.abs(value) / navigation.travel) * .035)
  const [settled, setSettled] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const ratio = slide.photo.width / slide.photo.height
  const width = Math.min(bounds.width * .97, bounds.height * .98 * ratio), height = width / ratio
  const text = image.translations[locale === "zh" ? "zh" : "en"]
  const fallback = image.translations[locale === "zh" ? "en" : "zh"]
  const alt = text.title || fallback.title || (locale === "zh" ? `照片 ${slide.index + 1}` : `Photograph ${slide.index + 1}`)

  useLayoutEffect(() => {
    const node = pose.current
    if (!node) return
    if (active && entered.current && settled) { node.style.transform = "translate3d(0,0,0)"; return }
    const fromX = slide.direction === 0 ? navigation.travel * .14 : slide.direction * navigation.travel
    const incoming = reduced ? [{ opacity: .3 },{ opacity: 1 }] : entranceFrames(fromX,slide.direction === 0 ? 18 : 0,navigation.travel)
    const outgoing = [
      { transform: node.style.transform || "translate3d(0,0,0)", opacity: node.style.opacity || "1" },
      { transform: reduced ? "translate3d(0,0,0)" : `translate3d(${-navigation.direction*navigation.travel}px,0,0) rotate(${-navigation.direction*3.5}deg) scale(.945,1.035)`, opacity: 0 },
    ]
    node.dataset.nativeTransition = "running"
    const player = node.animate(active ? incoming : outgoing, { duration: reduced ? 120 : active ? 660 : 400, easing: active ? "linear" : "cubic-bezier(.32,.05,.16,1)", fill: "both" })
    animation.current = player
    player.onfinish = () => {
      node.style.transform = active ? "translate3d(0,0,0)" : String(outgoing[1].transform)
      node.style.opacity = active ? "1" : "0"
      node.dataset.nativeTransition = "idle"
      animation.current = null; player.cancel()
      if (active) { entered.current = true; setSettled(true) }
      finish.current(slide.serial,active)
    }
    return () => {
      if (animation.current !== player) return
      // Freeze only when an incoming slide is interrupted, once per transition.
      if (node.isConnected && active) { const current = getComputedStyle(node); node.style.transform = current.transform; node.style.opacity = current.opacity }
      player.onfinish = null; player.cancel(); animation.current = null
    }
  }, [active, slide.serial, slide.direction, navigation.direction, navigation.travel, reduced])

  useEffect(() => {
    if (failed && active) { animation.current?.play(); animate(x,0,reduced ? { duration:0 } : SPRING) }
  },[failed,active,reduced,x])

  const dragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false); onDragState(false)
    const predicted = info.offset.x+info.velocity.x*.16
    const threshold = Math.max(48,Math.min(140,bounds.width*.14))
    if (Math.abs(info.offset.x) >= 24 && Math.abs(predicted) > threshold) onNavigate(predicted < 0 ? 1 : -1)
    else { animation.current?.play(); animate(x,0,reduced ? { duration:.12 } : SPRING) }
  }

  return <div ref={pose} className={styles.slide} data-photo-slide data-photo-index={slide.index} data-settled={active && settled && !isDragging}
    aria-hidden={!active} role="group" aria-roledescription="slide" aria-label={locale === "zh" ? `照片 ${slide.index+1}` : `Photograph ${slide.index+1}`}
    style={{ zIndex:active?2:1, pointerEvents:active?"auto":"none" }}>
    <motion.div className={styles.dragPlane} style={{ x,rotate,scaleX,scaleY }} drag={active && navigable?"x":false} dragMomentum={false} dragElastic={.15}
      dragConstraints={{ left:-navigation.travel*.48,right:navigation.travel*.48 }}
      onDragStart={() => {animation.current?.pause();setIsDragging(true);onDragState(true)}} onDragEnd={dragEnd}>
      <div className={styles.photoFrame} style={{width,height}}>
        <img className={styles.photo} src={slide.photo.src} alt={alt} width={slide.photo.width} height={slide.photo.height} draggable={false} decoding="async" />

      </div>
    </motion.div>
  </div>
}

export function Carousel({ images, currentIndex, onChangeImage, onDisplayImage, onBusyChange, keyboardInDialog = false }: {
  images: CarouselImage[]; currentIndex: number; onChangeImage: (index: number) => void
  onDisplayImage?: (index: number) => void; onBusyChange?: (busy: boolean) => void; keyboardInDialog?: boolean
}) {
  const { locale } = useI18n()
  const stage = useRef<HTMLDivElement>(null)
  const nativeProbe = useViewerNativeProbe(stage)
  const activeRef = useRef<Slide | null>(null)
  const serial = useRef(0)
  const cache = useRef<PhotoPreviewCache | null>(null)
  if (!cache.current) cache.current = new PhotoPreviewCache()
  const explicitDirection = useRef<{ target: number; direction: number } | null>(null)
  const lastDrag = useRef(-1000)
  const pointerStart = useRef<{ id:number; x:number; y:number; moved:boolean } | null>(null)
  const callbacks = useRef({ onDisplayImage, onBusyChange })
  callbacks.current = { onDisplayImage, onBusyChange }
  const [bounds, setBounds] = useState<Bounds>({ width: 1, height: 1, left: 0, density: 1 })
  const [view, setView] = useState<{ active: Slide | null; outgoing: Slide | null; direction: number }>({ active: null, outgoing: null, direction: 1 })
  const [pending, setPending] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const bucket = process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top"
  const sources = useMemo(() => images.map(image => ({ preview: viewerPhotoSource(image,bucket,bounds), original: photoSource(image.url, bucket, 1920, true) })), [images, bucket,bounds.width,bounds.height,bounds.density])
  const navigation = { direction: view.direction, travel: Math.max(1, bounds.width * 1.04) }

  const preload = useCallback((source: PhotoSource, priority: "high" | "low" = "low") => cache.current!.load(source,priority), [])
  useEffect(() => () => cache.current?.clear(), [])

  useEffect(() => {
    const node = stage.current
    if (!node) return
    const measure = () => {
      const r = node.getBoundingClientRect()
      const width = node.clientWidth, height = node.clientHeight
      const left = r.left - (width - r.width) / 2
      const density=window.devicePixelRatio || 1
      setBounds(previous => previous.width === width && previous.height === height && previous.left === left && previous.density===density ? previous : { width, height, left, density })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node); measure()
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!images.length) { setPending(false); return }
    if (bounds.width<=1 || bounds.height<=1) return
    if (activeRef.current?.index === currentIndex && (activeRef.current.photo.src===sources[currentIndex].preview || Math.max(activeRef.current.photo.width,activeRef.current.photo.height)>=(sources[currentIndex].preview.includes("/w2560.webp")?2560:1280))) { setPending(false); setError(false); callbacks.current.onBusyChange?.(false); return }
    let cancelled = false
    nativeProbe.record.current?.("request", currentIndex)
    setPending(true); setError(false); callbacks.current.onBusyChange?.(true)
    preload(sources[currentIndex], "high").then(photo => {
      if (cancelled) return
      const previous = activeRef.current
      const offset = previous ? modulo(currentIndex - previous.index, images.length) : 0
      const direction = !previous ? 0 : explicitDirection.current?.target === currentIndex
        ? explicitDirection.current.direction : offset <= images.length / 2 ? 1 : -1
      const same=previous?.index===currentIndex
      const next: Slide = { serial: same?previous.serial:++serial.current, index: currentIndex, direction:same?previous.direction:direction, photo }
      activeRef.current = next
      nativeProbe.record.current?.("presented", currentIndex)
      setView({ active: next, outgoing: same?null:previous, direction: direction || 1 })
      setPending(false); setMoving(!same); callbacks.current.onBusyChange?.(false); callbacks.current.onDisplayImage?.(currentIndex)
    }, () => {
      if (!cancelled) { setPending(false); setError(true); callbacks.current.onBusyChange?.(false) }
    })
    return () => { cancelled = true }
  }, [currentIndex, images.length, sources, preload, retry,bounds.width,bounds.height])

  useEffect(() => {
    if (pending || moving || dragging || error || !view.active || images.length < 2) return
    let cancelled = false, timer = 0
    const current = view.active.index, direction = view.direction || 1
    const neighbors = [...new Set([modulo(current+direction,images.length),modulo(current-direction,images.length)])].filter(index => index !== current)
    const next = (position: number) => {
      if (cancelled || position >= neighbors.length) return
      preload(sources[neighbors[position]]).catch(() => {}).finally(() => {
        if (!cancelled) timer=window.setTimeout(() => next(position+1),200)
      })
    }
    timer=window.setTimeout(() => next(0),150)
    return () => {cancelled=true;window.clearTimeout(timer)}
  },[pending,moving,dragging,error,view.active,view.direction,images.length,sources,preload])

  const navigate = useCallback((direction: number) => {
    if (images.length < 2) return
    const target = modulo(currentIndex + direction, images.length)
    explicitDirection.current = { target, direction }
    onChangeImage(target)
  }, [currentIndex, images.length, onChangeImage])
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const initialIndex = useRef(currentIndex)
  const { report } = useViewerFrameProbe(Boolean(view.active), () => navigateRef.current(activeRef.current?.index === initialIndex.current ? 1 : -1))

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.altKey || event.ctrlKey || event.metaKey || target?.isContentEditable || target?.closest('input,textarea,select') || (!keyboardInDialog && document.querySelector('[role="dialog"][data-state="open"]'))) return
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); navigateRef.current(event.key === "ArrowRight" ? 1 : -1) }
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [keyboardInDialog])

  useEffect(() => {
    const node = stage.current
    if (!node) return
    let accumulated = 0, last = 0, locked = false
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 2) return
      event.preventDefault()
      const now = performance.now()
      if (now - last > 180) { accumulated = 0; locked = false }
      last = now
      if (locked) return
      accumulated += event.deltaX
      if (Math.abs(accumulated) > 60) { locked = true; navigateRef.current(accumulated > 0 ? 1 : -1) }
    }
    node.addEventListener("wheel", wheel, { passive: false })
    return () => node.removeEventListener("wheel", wheel)
  }, [])

  const dragState = (value: boolean) => { lastDrag.current = performance.now(); setDragging(value) }
  const finish = (id: number, active: boolean) => {
    if (active && activeRef.current?.serial === id) { nativeProbe.record.current?.("settled", activeRef.current.index); setMoving(false) }
    if (!active) setView(previous => previous.outgoing?.serial === id ? { ...previous, outgoing: null } : previous)
  }
  return <div ref={stage} className={styles.stage} data-elastic-viewer data-cursor={images.length < 2 ? "static" : "next"}
    data-gallery-state={error ? "error" : pending ? "loading" : dragging ? "dragging" : moving ? "moving" : "idle"}
    data-visible-index={view.active?.index ?? ""} data-dragging={dragging || undefined}
    role="region" aria-roledescription="carousel" aria-label={locale === "zh" ? "照片浏览" : "Photograph viewer"}
    onPointerDownCapture={event => { if (event.isPrimary && event.button === 0) pointerStart.current={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false} }}
    onPointerMoveCapture={event => {
      const start=pointerStart.current
      if (start?.id === event.pointerId && Math.hypot(event.clientX-start.x,event.clientY-start.y)>6) {start.moved=true;lastDrag.current=performance.now()}
    }}
    onPointerUpCapture={event => { if (pointerStart.current?.id === event.pointerId) {if (pointerStart.current.moved) lastDrag.current=performance.now();pointerStart.current=null} }}
    onPointerCancelCapture={() => {if (pointerStart.current?.moved) lastDrag.current=performance.now();pointerStart.current=null}}
    onPointerMove={event => {
      if (images.length < 2 || event.pointerType !== "mouse" || dragging) return
      const cursor = event.clientX - bounds.left < bounds.width * .25 ? "previous" : "next"
      if (event.currentTarget.dataset.cursor !== cursor) event.currentTarget.dataset.cursor = cursor
    }}
    onClick={event => {
      if (performance.now() - lastDrag.current < 250 || (event.target as HTMLElement).closest('button')) return
      navigate(event.clientX - bounds.left < bounds.width * .25 ? -1 : 1)
    }}>
    {[view.outgoing, view.active].filter((slide): slide is Slide => slide !== null).map(slide => <PhotoSlide key={slide.serial}
      slide={slide} image={images[slide.index]} bounds={bounds} active={slide.serial === view.active?.serial}
      navigation={navigation} navigable={images.length > 1} onNavigate={navigate} onDragState={dragState} onFinish={finish} failed={error} />)}
    {pending && <span className={styles.loadingLine} role="status" aria-label={locale === "zh" ? "正在载入照片" : "Loading photograph"} />}
    {error && <div className={styles.loadError} role="alert"><span>{locale === "zh" ? "这张照片暂时无法载入" : "This photograph could not load"}</span><button onClick={() => setRetry(value => value + 1)}>{locale === "zh" ? "重试" : "Retry"}</button></div>}
    {nativeProbe.report && <aside className={styles.performance} data-viewer-native-report>{(() => { const { events, ...summary } = JSON.parse(nativeProbe.report); return <><pre>{JSON.stringify(summary)}</pre><pre>{JSON.stringify(events.map((event: { event: string; index: number; atMs: number }) => [event.event, event.index, event.atMs]))}</pre></> })()}</aside>}
    {report && <aside className={styles.performance} data-viewer-performance><pre>{report}</pre></aside>}
  </div>
}
