import type { Map as LeafletMap, Point } from "leaflet"

// Gestures over the map stay inside the map. Trackpad pinch (Ctrl+wheel)
// zooms around the pointer; other wheel gestures pan along either axis.
export function bindMapWheelGestures(map: LeafletMap, container: HTMLElement = map.getContainer()) {
  const previousOverscroll = container.style.overscrollBehavior
  const previousTouchAction = container.style.touchAction
  container.style.overscrollBehavior = "contain"
  container.style.touchAction = "none"
  let frame = 0, lastInput = 0, panX = 0, panY = 0, zoomRemainder = 0
  let zoomAnchor: Point | null = null
  const zoomStep = map.options.zoomSnap || .25

  const flush = () => {
    frame = 0
    const x = Math.round(panX), y = Math.round(panY)
    panX -= x; panY -= y
    if (x || y) map.panBy([x, y], {animate: false})
    const steps = Math.trunc(zoomRemainder / zoomStep)
    if (steps && zoomAnchor) {
      zoomRemainder -= steps * zoomStep
      map.setZoomAround(zoomAnchor, map.getZoom() + steps * zoomStep, {animate: false})
    }
  }

  const wheel = (event: WheelEvent) => {
    if (event.defaultPrevented) return
    const size = map.getSize()
    const scaleX = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.x : 1
    const scaleY = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.y : 1
    let x = event.deltaX * scaleX, y = event.deltaY * scaleY
    if (event.shiftKey && !x) { x = y; y = 0 }
    const pinch = event.ctrlKey && y !== 0
    if (!x && !y) return

    event.preventDefault()
    event.stopPropagation()
    const now = performance.now()
    if (now - lastInput > 180) {
      map.stop()
      panX = 0; panY = 0; zoomRemainder = 0
    }
    lastInput = now
    if (pinch) {
      zoomAnchor = map.mouseEventToContainerPoint(event)
      zoomRemainder -= y / 80
    } else {
      panX += x; panY += y
    }
    if (!frame) frame = window.requestAnimationFrame(flush)
  }

  container.addEventListener("wheel", wheel, {passive: false, capture: true})
  return () => {
    container.removeEventListener("wheel", wheel, {capture: true})
    container.style.overscrollBehavior = previousOverscroll
    container.style.touchAction = previousTouchAction
    window.cancelAnimationFrame(frame)
  }
}
