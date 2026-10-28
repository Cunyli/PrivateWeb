"use client"

import { useCallback, useEffect, useRef } from "react"
import type { MouseEvent, RefObject } from "react"
import { useI18n } from "@/lib/i18n"
import styles from "./portfolio-entry.module.css"

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

export function DreamscapeCapture({ heroRef, reducedMotion, active }: {
  heroRef: RefObject<HTMLElement>
  reducedMotion: boolean
  active: boolean
}) {
  const { locale } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef(0)
  const gestureRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  const clear = useCallback(() => {
    cancelAnimationFrame(animationRef.current)
    animationRef.current = 0
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (canvas && context) {
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      canvas.dataset.capturePhase = "idle"
    }
  }, [])

  useEffect(() => {
    const cancel = () => { if (animationRef.current) clear() }
    window.addEventListener("scroll", cancel, { passive: true })
    window.addEventListener("resize", cancel)
    return () => {
      window.removeEventListener("scroll", cancel)
      window.removeEventListener("resize", cancel)
      clear()
    }
  }, [clear])

  useEffect(() => { if (!active) clear() }, [active, clear])

  const capture = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0 && gestureRef.current?.moved) return
    const hero = heroRef.current
    const canvas = canvasRef.current
    const source = hero?.querySelector<HTMLCanvasElement>("canvas[data-ready='true']")
    const context = canvas?.getContext("2d")
    if (!hero || !canvas || !source || !context) return
    clear()
    const bounds = hero.getBoundingClientRect()
    const scene = source.getBoundingClientRect()
    const foreground = hero.querySelector<HTMLImageElement>('img[src$="dreamcore-photographer-foreground.png"]')
    const width = bounds.width
    const height = bounds.height
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)

    const paperWidth = Math.min(132, width * 0.28)
    const paperHeight = paperWidth * 0.66
    const startX = Math.max(paperWidth / 2, Math.min(width - paperWidth / 2,
      event.detail === 0 ? width * 0.28 : event.clientX - bounds.left))
    const startY = Math.max(paperHeight / 2, Math.min(height - paperHeight / 2,
      event.detail === 0 ? height * 0.4 : event.clientY - bounds.top))

    // Match the scene renderer's object-fit cover and horizontal crop at 46%.
    const scale = Math.max(scene.width / 1672, scene.height / 941)
    const visibleX = scene.width / (1672 * scale)
    const visibleY = scene.height / (941 * scale)
    const endX = scene.left - bounds.left + (0.506 - (1 - visibleX) * 0.46) / visibleX * scene.width
    const endY = scene.top - bounds.top + (0.522 - (1 - visibleY) * 0.5) / visibleY * scene.height
    canvas.dataset.cameraX = endX.toFixed(1)
    canvas.dataset.cameraY = endY.toFixed(1)

    // Lift only the clicked piece of the live frame; the landscape keeps its size.
    const paper = document.createElement("canvas")
    paper.width = Math.round(paperWidth * 2)
    paper.height = Math.round(paperHeight * 2)
    const paperContext = paper.getContext("2d")
    if (!paperContext) return
    paperContext.drawImage(source,
      (startX - paperWidth / 2 + bounds.left - scene.left) / scene.width * source.width,
      (startY - paperHeight / 2 + bounds.top - scene.top) / scene.height * source.height,
      paperWidth / scene.width * source.width, paperHeight / scene.height * source.height,
      0, 0, paper.width, paper.height)
    const dx = endX - startX
    const arc = Math.min(110, Math.hypot(dx, endY - startY) * 0.28)
    const controlY1 = Math.max(16, startY - arc)
    const controlY2 = Math.max(16, endY - arc * 0.7)
    const started = performance.now()
    canvas.dataset.capturePhase = "flying"
    const draw = (now: number) => {
      const elapsed = now - started
      const p = reducedMotion ? 1 : Math.min(1, Math.max(0, (elapsed - 70) / 1180))
      const travel = smooth(p)
      const remaining = 1 - travel
      const x = remaining ** 3 * startX
        + 3 * remaining ** 2 * travel * (startX + dx * 0.22)
        + 3 * remaining * travel ** 2 * (endX - dx * 0.18) + travel ** 3 * endX
      const y = remaining ** 3 * startY
        + 3 * remaining ** 2 * travel * controlY1
        + 3 * remaining * travel ** 2 * controlY2 + travel ** 3 * endY
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)
      canvas.dataset.captureProgress = p.toFixed(3)

      if (p < 1) {
        const fold = smooth((p - 0.04) / 0.3)
        const arrival = smooth((p - 0.84) / 0.16)
        const w = paperWidth * (1 - arrival * 0.72)
        const h = paperHeight * (1 - arrival * 0.72)
        const tangentX = 3 * remaining ** 2 * dx * 0.22
          + 6 * remaining * travel * dx * 0.60 + 3 * travel ** 2 * dx * 0.18
        const tangentY = 3 * remaining ** 2 * (controlY1 - startY)
          + 6 * remaining * travel * (controlY2 - controlY1) + 3 * travel ** 2 * (endY - controlY2)
        context.save()
        context.translate(x, y - Math.sin(p * Math.PI) * 8)
        context.rotate(Math.atan2(tangentY, tangentX) * smooth(p / 0.18))
        context.globalAlpha = smooth(elapsed / 90) * (1 - smooth((p - 0.94) / 0.06))

        const wing = (points: [number, number][], shade: number) => {
          context.save()
          context.beginPath()
          points.forEach(([px, py], index) => {
            if (index === 0) context.moveTo(px, py)
            else context.lineTo(px, py)
          })
          context.closePath()
          context.clip()
          context.drawImage(paper, -w / 2, -h / 2, w, h)
          context.fillStyle = `rgba(19, 24, 44, ${shade})`
          context.fillRect(-w / 2, -h / 2, w, h)
          context.restore()
        }
        // The clicked landscape folds into two light wings, rather than a floating card.
        wing([[w / 2, -h / 2 * (1 - fold)], [-w / 2, -h / 2],
          [-w / 2 + w * 0.37 * fold, 0], [w / 2, 0]], fold * 0.03)
        wing([[w / 2, 0], [-w / 2 + w * 0.37 * fold, 0],
          [-w / 2, h / 2], [w / 2, h / 2 * (1 - fold)]], fold * 0.19)
        context.strokeStyle = `rgba(255, 249, 236, ${fold * 0.5})`
        context.lineWidth = 0.7
        context.beginPath()
        context.moveTo(-w / 2 + w * 0.37 * fold, 0)
        context.lineTo(w / 2, 0)
        context.stroke()
        context.restore()
      }

      // Keep the travelling fragment behind the boy and meadow, without touching the scene.
      if (foreground?.complete && foreground.naturalWidth > 0) {
        context.save()
        context.globalCompositeOperation = "destination-out"
        context.drawImage(foreground,
          (1 - visibleX) * 0.46 * foreground.naturalWidth,
          (1 - visibleY) * 0.5 * foreground.naturalHeight,
          visibleX * foreground.naturalWidth, visibleY * foreground.naturalHeight,
          scene.left - bounds.left, scene.top - bounds.top, scene.width, scene.height)
        context.restore()
      }

      const received = reducedMotion ? elapsed / 220 : (elapsed - 1180) / 280
      if (received > 0 && received < 1) {
        canvas.dataset.capturePhase = "received"
        context.strokeStyle = `rgba(255, 248, 232, ${Math.sin(received * Math.PI) * 0.65})`
        context.lineWidth = 1
        context.beginPath()
        context.ellipse(endX, endY, 9, 6, -0.2, 0, Math.PI * 2)
        context.stroke()
      }
      if (elapsed < (reducedMotion ? 220 : 1460)) animationRef.current = requestAnimationFrame(draw)
      else clear()
    }
    animationRef.current = requestAnimationFrame(draw)
  }

  return (
    <button type="button" className={styles.captureTrigger} onClick={capture}
      aria-label={locale === "zh" ? "点击梦境画面，把一片风景收进相机" : "Click the scene to fold a piece of the landscape into the camera"}
      onPointerDown={event => { gestureRef.current = { x: event.clientX, y: event.clientY, moved: false } }}
      onPointerMove={event => {
        const gesture = gestureRef.current
        if (gesture && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) gesture.moved = true
      }}
      onPointerCancel={() => { gestureRef.current = null }}>
      <canvas ref={canvasRef} className={styles.captureCanvas} data-capture-phase="idle" aria-hidden="true" />
    </button>
  )
}
