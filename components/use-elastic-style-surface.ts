"use client"

import { useEffect } from "react"
import type { RefObject } from "react"

type Pose = { x: number; y: number; sx: number; sy: number; skew: number }
const rest = (): Pose => ({ x: 0, y: 0, sx: 1, sy: 1, skew: 0 })
const axes = ["x", "y", "sx", "sy", "skew"] as const

export function useElasticStyleSurface({ stage, surface, enabled }: {
  stage: RefObject<HTMLDivElement | null>
  surface: RefObject<HTMLDivElement | null>
  enabled: boolean
}) {
  useEffect(() => {
    const hitArea = stage.current
    const sheet = surface.current
    if (!hitArea || !sheet || !enabled) return

    const wide = window.matchMedia("(min-width: 768px)")
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let pose = rest()
    let target = rest()
    const velocity: Pose = { x: 0, y: 0, sx: 0, sy: 0, skew: 0 }
    let frame = 0
    let last = 0
    let engaged = false
    let bounds = hitArea.getBoundingClientRect()
    let dirty = false

    const draw = () => {
      sheet.style.transform = `translate3d(${pose.x.toFixed(3)}px,${pose.y.toFixed(3)}px,0) skewY(${pose.skew.toFixed(4)}deg) scale(${pose.sx.toFixed(5)},${pose.sy.toFixed(5)})`
    }
    const tick = (now: number) => {
      frame = 0
      const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60)
      last = now
      let moving = false
      for (const axis of axes) {
        const acceleration = (240 * (target[axis] - pose[axis]) - 19 * velocity[axis]) / .9
        velocity[axis] += acceleration * dt
        pose[axis] += velocity[axis] * dt
        const tolerance = axis === "sx" || axis === "sy" ? .00008 : .008
        if (Math.abs(target[axis] - pose[axis]) > tolerance || Math.abs(velocity[axis]) > tolerance * 8) moving = true
      }
      draw()
      if (moving) frame = requestAnimationFrame(tick)
      else {
        pose = { ...target }
        for (const axis of axes) velocity[axis] = 0
        draw()
        last = 0
        if (!engaged) {
          sheet.style.removeProperty("transform")
          sheet.style.removeProperty("will-change")
          delete sheet.dataset.elasticActive
        }
      }
    }
    const schedule = () => {
      sheet.style.willChange = "transform"
      if (!frame) { last = 0; frame = requestAnimationFrame(tick) }
    }
    const release = () => {
      engaged = false
      target = rest()
      schedule()
    }
    const deform = (nx: number, ny: number) => {
      if (!wide.matches || motion.matches || document.hidden) return
      engaged = true
      const x = Math.max(-1, Math.min(1, nx))
      const y = Math.max(-1, Math.min(1, ny))
      target = {
        x: x * 12,
        y: y * 4 - 3,
        sx: 1.015 + Math.abs(x) * .032,
        sy: 1.065 + (1 - Math.abs(x)) * .05 + Math.abs(y) * .01,
        skew: x * .7,
      }
      sheet.dataset.elasticActive = "true"
      schedule()
    }
    const pointer = (event: PointerEvent) => {
      if (dirty) { bounds = hitArea.getBoundingClientRect(); dirty = false }
      if (bounds.width < 1 || bounds.height < 1) return
      deform((event.clientX - bounds.left) / bounds.width * 2 - 1, (event.clientY - bounds.top) / bounds.height * 2 - 1)
    }
    const focus = (event: FocusEvent) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>("[data-style-card-index]")
      if (!card?.matches(":focus-visible")) return
      const index = Number(card.dataset.styleCardIndex)
      const count = sheet.querySelectorAll("[data-style-card-index]").length
      if (count) deform((index + .5) / count * 2 - 1, 0)
    }
    const blur = (event: FocusEvent) => {
      if (!hitArea.contains(event.relatedTarget as Node | null)) release()
    }
    const leave = () => {
      if (!hitArea.querySelector(":focus-visible")) release()
    }
    const up = (event: PointerEvent) => { if (event.pointerType !== "mouse") leave() }
    const reset = () => {
      cancelAnimationFrame(frame)
      frame = 0
      last = 0
      engaged = false
      pose = rest()
      target = rest()
      for (const axis of axes) velocity[axis] = 0
      sheet.style.removeProperty("transform")
      sheet.style.removeProperty("will-change")
      delete sheet.dataset.elasticActive
      dirty = true
    }
    const scroll = () => { dirty = true }
    const visibility = () => { if (document.hidden) reset() }
    const resize = new ResizeObserver(() => {
      dirty = true
      if (!wide.matches) reset()
    })
    const offscreen = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) reset() })
    resize.observe(hitArea)
    offscreen.observe(hitArea)
    hitArea.addEventListener("pointerenter", pointer)
    hitArea.addEventListener("pointermove", pointer)
    hitArea.addEventListener("pointerleave", leave)
    hitArea.addEventListener("pointercancel", release)
    hitArea.addEventListener("pointerup", up)
    hitArea.addEventListener("focusin", focus)
    hitArea.addEventListener("focusout", blur)
    window.addEventListener("scroll", scroll, { capture: true, passive: true })
    window.addEventListener("blur", reset)
    document.addEventListener("visibilitychange", visibility)
    wide.addEventListener("change", reset)
    motion.addEventListener("change", reset)

    return () => {
      reset()
      resize.disconnect()
      offscreen.disconnect()
      hitArea.removeEventListener("pointerenter", pointer)
      hitArea.removeEventListener("pointermove", pointer)
      hitArea.removeEventListener("pointerleave", leave)
      hitArea.removeEventListener("pointercancel", release)
      hitArea.removeEventListener("pointerup", up)
      hitArea.removeEventListener("focusin", focus)
      hitArea.removeEventListener("focusout", blur)
      window.removeEventListener("scroll", scroll, true)
      window.removeEventListener("blur", reset)
      document.removeEventListener("visibilitychange", visibility)
      wide.removeEventListener("change", reset)
      motion.removeEventListener("change", reset)
    }
  }, [stage, surface, enabled])
}
