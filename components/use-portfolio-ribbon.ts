"use client"

import { useEffect } from "react"
import type { MutableRefObject, RefObject } from "react"

type Options = {
  root: RefObject<HTMLDivElement>
  top: RefObject<HTMLDivElement>
  bottom: RefObject<HTMLDivElement>
  topPosition: MutableRefObject<number>
  bottomPosition: MutableRefObject<number>
  topCycle: MutableRefObject<number>
  bottomCycle: MutableRefObject<number>
  active: MutableRefObject<boolean>
  pause: () => void
  resume: () => void
  disabled: boolean
  revision: unknown
}

type Tile = {
  node: HTMLAnchorElement; left: number; width: number; y: number; tilt: number; yaw: number; pitch: number; depth: number; layer: string
  focus: number; focusVelocity: number; painted: boolean
}
type Lane = { node: HTMLDivElement; tiles: Tile[]; width: number; left: number; top: number; height: number }
type Gesture = { id: number; lane: number; startX: number; startY: number; lastX: number; lastTime: number; velocity: number; moved: boolean }
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
const wrap = (value: number, cycle: number) => cycle > 0 ? ((value % cycle) + cycle) % cycle : 0

export function usePortfolioRibbon({ root, top, bottom, topPosition, bottomPosition, topCycle, bottomCycle, active, pause, resume, disabled, revision }: Options) {
  useEffect(() => {
    const mounted = root.current
    if (!mounted) return
    const surface: HTMLDivElement = mounted
    active.current = false
    if (disabled) { resume(); return }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let lanes: Lane[] = [], frame = 0, lastTime = 0, visible = false, disposed = false
    let inside = false, keyboard = false, hot: HTMLAnchorElement | null = null
    let pointerX = 0, pointerY = 0, bend = 0, momentum = 0, dragLane = 0, suppressUntil = 0
    let gesture: Gesture | null = null
    const positions = [topPosition, bottomPosition], cycles = [topCycle, bottomCycle]
    const restore = (tile: Tile) => {
      if (!tile.painted) return
      tile.node.style.removeProperty("transform")
      tile.node.style.removeProperty("z-index")
      tile.painted = false
    }
    const measure = () => {
      lanes = [top.current, bottom.current].filter((node): node is HTMLDivElement => !!node).map(node => {
        const rect = node.getBoundingClientRect()
        const bendFactor = Number.parseFloat(getComputedStyle(surface).getPropertyValue("--ribbon-bend")) || 1
        const previous = new Map(lanes.flatMap(lane => lane.tiles).map(tile => [tile.node, tile]))
        const tiles = [...node.querySelectorAll<HTMLAnchorElement>(":scope > a")].map(anchor => {
          const read = (name: string) => Number.parseFloat(anchor.style.getPropertyValue(name)) || 0
          return {node: anchor, left: anchor.offsetLeft, width: anchor.offsetWidth, y: read("--ribbon-y") * bendFactor,
            tilt: read("--ribbon-tilt") * bendFactor, yaw: read("--ribbon-yaw") * bendFactor,
            pitch: read("--ribbon-pitch") * bendFactor, depth: read("--ribbon-depth") * bendFactor,
            layer: anchor.style.getPropertyValue("--ribbon-layer") || "2", focus: previous.get(anchor)?.focus || 0,
            focusVelocity: previous.get(anchor)?.focusVelocity || 0, painted: previous.get(anchor)?.painted || false}
        })
        return {node, tiles, width: node.clientWidth, left: rect.left, top: rect.top, height: rect.height}
      })
    }
    const activate = () => {
      if (!active.current) { active.current = true; pause() }
      surface.dataset.ribbonActive = "true"
    }
    const deactivate = () => {
      if (!active.current) return
      active.current = false
      delete surface.dataset.ribbonActive
      resume()
    }
    const move = (distance: number, laneIndex: number) => {
      lanes.forEach((lane, index) => {
        const cycle = cycles[index].current
        if (cycle < 1) return
        const amount = index === laneIndex ? -distance : distance * .62
        positions[index].current = wrap(lane.node.scrollLeft + amount, cycle)
        lane.node.scrollLeft = positions[index].current
      })
    }
    const choose = (x: number, y: number) => {
      let best: {node: HTMLAnchorElement; distance: number} | null = null
      for (const lane of lanes) {
        if (y < lane.top || y > lane.top + lane.height) continue
        for (const tile of lane.tiles) {
          const center = lane.left + tile.left + tile.width / 2 - lane.node.scrollLeft
          const distance = Math.abs(center - x)
          if (distance < tile.width * .7 && (!best || distance < best.distance)) best = {node: tile.node, distance}
        }
      }
      return best?.node || null
    }
    const schedule = () => {
      if (!frame && !disposed && visible && !document.hidden) frame = requestAnimationFrame(tick)
    }
    const tick = (now: number) => {
      frame = 0
      if (disposed || !visible || document.hidden) return
      const dt = lastTime ? Math.min((now - lastTime) / 1000, .032) : 1 / 60
      lastTime = now
      if (!gesture && Math.abs(momentum) > 7 && !motion.matches) {
        move(momentum * dt, dragLane)
        momentum *= Math.exp(-6.8 * dt)
        if (inside && !keyboard) hot = choose(pointerX, pointerY)
      } else if (!gesture) momentum = 0
      const speed = gesture?.moved ? gesture.velocity : momentum
      const targetBend = motion.matches ? 0 : clamp(speed / 1300, -1, 1)
      bend += (targetBend - bend) * (1 - Math.exp(-14 * dt))
      let unsettled = Math.abs(momentum) > 7 || Math.abs(bend - targetBend) > .002 || Math.abs(bend) > .003
      let anchorX = pointerX
      for (const lane of lanes) {
        const tile = lane.tiles.find(tile => tile.node === hot)
        if (tile) anchorX = lane.left + tile.left + tile.width / 2 - lane.node.scrollLeft
      }
      lanes.forEach((lane, laneIndex) => {
        const scroll = lane.node.scrollLeft
        const focusedTile = lane.tiles.find(tile => tile.node === hot)
        const laneHasHot = !!focusedTile
        const unfolding = clamp(focusedTile?.focus || 0, 0, 1.06)
        for (const tile of lane.tiles) {
          const center = lane.left + tile.left + tile.width / 2 - scroll
          if (center < lane.left - tile.width || center > lane.left + lane.width + tile.width) { restore(tile); continue }
          const isHot = tile.node === hot
          const distance = center - anchorX
          const targetFocus = !motion.matches && !gesture?.moved && (inside || keyboard)
            ? (isHot ? 1 : Math.exp(-Math.pow(distance / 220, 2)) * (laneHasHot ? .16 : .22)) : 0
          tile.focusVelocity += ((targetFocus - tile.focus) * 230 - tile.focusVelocity * 27) * dt
          tile.focus += tile.focusVelocity * dt
          if (Math.abs(tile.focus - targetFocus) < .0008 && Math.abs(tile.focusVelocity) < .003) { tile.focus = targetFocus; tile.focusVelocity = 0 }
          else unsettled = true
          const focus = clamp(tile.focus, 0, 1.06)
          if (motion.matches || (focus < .0008 && Math.abs(bend) < .003)) { restore(tile); continue }
          const rowSign = laneIndex === dragLane ? 1 : -.62
          const fan = laneHasHot && !isHot && !gesture?.moved ? Math.sign(distance) * 39 * Math.exp(-Math.abs(distance) / 480) * unfolding : 0
          const phase = (center - lane.left) / Math.max(1, lane.width) * Math.PI * 2
          const x = fan + bend * rowSign * Math.sin(phase) * 4
          const y = tile.y * (1 - focus * .92) - focus * 5 + bend * rowSign * Math.cos(phase) * 5
          const depth = tile.depth + focus * 42
          const tilt = tile.tilt * (1 - focus * .94) + bend * rowSign * 4
          const yaw = tile.yaw * (1 - focus) + (isHot ? clamp((pointerX - center) / tile.width, -1, 1) * 7 * focus : Math.sign(distance) * focus * 8) + bend * rowSign * 10
          const pitch = tile.pitch * (1 - focus) + (isHot && !keyboard ? clamp((lane.top + lane.height / 2 - pointerY) / lane.height, -.5, .5) * 8 * focus : 0)
          tile.node.style.transform = `perspective(1000px) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${depth.toFixed(2)}px) rotateX(${pitch.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg) rotateZ(${tilt.toFixed(2)}deg) scale(${(1 + focus * .07).toFixed(4)})`
          tile.node.style.zIndex = focus > .15 ? String(20 + Math.round(focus * 30)) : tile.layer
          tile.painted = true
        }
      })
      if (unsettled || gesture?.moved) schedule()
      else {
        lastTime = 0
        if (!inside && !keyboard && !gesture) deactivate()
      }
    }
    const hover = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return
      if (gesture?.moved) return
      inside = true
      keyboard = false
      pointerX = event.clientX; pointerY = event.clientY
      hot = (event.target as Element).closest<HTMLAnchorElement>("a[data-set-id]") || choose(pointerX, pointerY)
      activate(); schedule()
    }
    const enter = (event: PointerEvent) => { measure(); hover(event) }
    const leave = () => { inside = false; if (!keyboard) hot = null; schedule() }
    const unbindGesture = () => {
      window.removeEventListener("pointermove", drag, true)
      window.removeEventListener("pointerup", end, true)
      window.removeEventListener("pointercancel", cancel, true)
    }
    const finish = (cancelled: boolean) => {
      const current = gesture
      if (!current) return
      gesture = null; unbindGesture()
      if (surface.hasPointerCapture(current.id)) surface.releasePointerCapture(current.id)
      delete surface.dataset.dragging
      if (current.moved) {
        suppressUntil = performance.now() + 350
        momentum = !cancelled && !motion.matches && performance.now() - current.lastTime < 100 ? current.velocity : 0
      }
      hot = inside ? choose(pointerX, pointerY) : null
      schedule()
      if (motion.matches || (!current.moved && !inside && !keyboard)) deactivate()
    }
    function end(event: PointerEvent) { if (gesture?.id === event.pointerId) finish(false) }
    function cancel(event: PointerEvent) { if (gesture?.id === event.pointerId) finish(true) }
    function drag(event: PointerEvent) {
      if (!gesture || gesture.id !== event.pointerId) return
      const totalX = event.clientX - gesture.startX, totalY = event.clientY - gesture.startY
      pointerX = event.clientX; pointerY = event.clientY
      if (!gesture.moved) {
        if (Math.abs(totalY) > 9 && Math.abs(totalY) > Math.abs(totalX) * 1.2) { finish(true); return }
        if (Math.abs(totalX) < 7 || Math.abs(totalX) < Math.abs(totalY) * 1.2) return
        gesture.moved = true
        surface.setPointerCapture(event.pointerId)
        surface.dataset.dragging = "true"
      }
      event.preventDefault()
      const now = performance.now(), dx = event.clientX - gesture.lastX
      const velocity = clamp(dx / Math.max(8, now - gesture.lastTime) * 1000, -2400, 2400)
      gesture.velocity = gesture.velocity * .55 + velocity * .45
      gesture.lastX = event.clientX; gesture.lastTime = now
      move(dx, gesture.lane)
      const rect = surface.getBoundingClientRect()
      inside = event.pointerType === "mouse" && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
      schedule()
    }
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      measure(); momentum = 0; suppressUntil = 0
      pointerX = event.clientX; pointerY = event.clientY
      let closest = 0, distance = Infinity
      lanes.forEach((lane,index) => { const next = Math.abs(event.clientY - lane.top - lane.height / 2); if (next < distance) { closest = index; distance = next } })
      dragLane = closest
      gesture = {id: event.pointerId, lane: closest, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastTime: performance.now(), velocity: 0, moved: false}
      activate()
      window.addEventListener("pointermove", drag, {capture: true, passive: false})
      window.addEventListener("pointerup", end, true)
      window.addEventListener("pointercancel", cancel, true)
    }
    const click = (event: MouseEvent) => {
      if (event.detail !== 0 && performance.now() < suppressUntil) { event.preventDefault(); event.stopPropagation() }
    }
    const focus = (event: FocusEvent) => {
      const anchor = (event.target as Element).closest<HTMLAnchorElement>("a[data-set-id]")
      if (!anchor || !anchor.matches(":focus-visible")) return
      measure(); keyboard = true; hot = anchor
      const rect = anchor.getBoundingClientRect(); pointerX = rect.left + rect.width / 2; pointerY = rect.top + rect.height / 2
      activate(); schedule()
    }
    const blur = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && surface.contains(event.relatedTarget)) return
      keyboard = false; if (!inside) hot = null; schedule()
    }
    const remeasure = () => { if (visible) { measure(); if (active.current) schedule() } }
    const refresh = () => {
      if (!visible) return
      lanes.forEach(lane => { const rect = lane.node.getBoundingClientRect(); lane.left = rect.left; lane.top = rect.top; lane.height = rect.height })
      if (inside && !keyboard && !gesture?.moved) hot = choose(pointerX, pointerY)
      if (active.current) schedule()
    }
    const reset = () => {
      finish(true); momentum = 0; bend = 0; inside = false; keyboard = false; hot = null
      cancelAnimationFrame(frame); frame = 0; lastTime = 0
      lanes.forEach(lane => lane.tiles.forEach(tile => {tile.focus = 0; tile.focusVelocity = 0; restore(tile)}))
      deactivate()
    }
    const visibility = () => { if (document.hidden) reset(); else refresh() }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (!visible) reset(); else remeasure() }, {rootMargin: "60px"})
    const resize = new ResizeObserver(remeasure)
    measure(); observer.observe(surface); resize.observe(surface)
    const laneNodes = lanes.map(lane => lane.node)
    const laneScroll = () => {
      if (!active.current || !visible) return
      if (inside && !keyboard && !gesture?.moved) hot = choose(pointerX, pointerY)
      schedule()
    }
    laneNodes.forEach(node => node.addEventListener("scroll", laneScroll, {passive: true}))
    const scroller = surface.closest<HTMLElement>("[data-portfolio-scroll-root]")
    const scrollTarget = scroller?.dataset.embedded === "true" ? window : scroller || window
    surface.addEventListener("pointerenter", enter)
    surface.addEventListener("pointermove", hover, {passive: true})
    surface.addEventListener("pointerleave", leave)
    surface.addEventListener("pointerdown", down)
    surface.addEventListener("click", click, true)
    surface.addEventListener("focusin", focus); surface.addEventListener("focusout", blur)
    scrollTarget.addEventListener("scroll", refresh, {passive: true})
    window.addEventListener("resize", remeasure)
    window.addEventListener("blur", reset)
    document.addEventListener("visibilitychange", visibility)
    motion.addEventListener("change", reset)
    return () => {
      disposed = true; unbindGesture(); cancelAnimationFrame(frame)
      observer.disconnect(); resize.disconnect()
      laneNodes.forEach(node => node.removeEventListener("scroll", laneScroll))
      if (gesture && surface.hasPointerCapture(gesture.id)) surface.releasePointerCapture(gesture.id)
      lanes.forEach(lane => lane.tiles.forEach(restore))
      active.current = false; delete surface.dataset.ribbonActive; delete surface.dataset.dragging
      surface.removeEventListener("pointerenter", enter); surface.removeEventListener("pointermove", hover)
      surface.removeEventListener("pointerleave", leave); surface.removeEventListener("pointerdown", down)
      surface.removeEventListener("click", click, true); surface.removeEventListener("focusin", focus); surface.removeEventListener("focusout", blur)
      scrollTarget.removeEventListener("scroll", refresh); window.removeEventListener("resize", remeasure); window.removeEventListener("blur", reset)
      document.removeEventListener("visibilitychange", visibility); motion.removeEventListener("change", reset)
    }
  }, [root, top, bottom, topPosition, bottomPosition, topCycle, bottomCycle, active, pause, resume, disabled, revision])
}
