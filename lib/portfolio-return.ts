// Shared by collection cards, the map and the style showcase.
export function capturePortfolioPosition(anchor?: HTMLElement | null) {
  const root = document.querySelector<HTMLElement>("[data-portfolio-scroll-root]")
  if (!root) return
  const embedded = root.dataset.embedded === "true"
  const store = window.sessionStorage
  store.setItem("portfolio:return-path", embedded ? "/" : "/portfolio")
  store.setItem("portfolio:return-scroll", String(embedded ? window.scrollY : root.scrollTop))
  store.setItem("portfolio:return-width", String(window.innerWidth))
  store.setItem("portfolio:return-height", String(window.innerHeight))
  store.setItem("portfolio:return-pending", "1")
  store.setItem("portfolio:return-search-open", "0")
  for (const row of ["top", "bottom"]) {
    store.setItem(`portfolio:return-${row}-row-scroll`, String(root.querySelector<HTMLElement>(`[data-portfolio-row="${row}"]`)?.scrollLeft || 0))
  }
  store.setItem("portfolio:return-anchor", anchor?.dataset.setId || "")
  store.setItem("portfolio:return-anchor-top", anchor ? String(anchor.getBoundingClientRect().top) : "")
  store.setItem("portfolio:return-section", anchor?.closest<HTMLElement>("[data-return-section]")?.dataset.returnSection || "")
}

// Briefly keep the clicked image in place while maps, fonts and images regain
// their heights. Stops immediately on user input; no persistent scroll loop.
export function settlePortfolioAnchor(root: HTMLElement, anchor: HTMLElement, top: number, embedded: boolean) {
  const content=root.querySelector<HTMLElement>("[data-portfolio-content]")
  if (!content || !Number.isFinite(top)) return
  let frame=0, stopped=false
  const events=["wheel","pointerdown","keydown"] as const
  const stop=() => {
    if (stopped) return
    stopped=true;cancelAnimationFrame(frame);observer.disconnect();window.clearTimeout(timer)
    events.forEach(event => window.removeEventListener(event,stop,true))
  }
  const align=() => {
    frame=0
    if (!root.isConnected || !anchor.isConnected) {stop();return}
    const delta=anchor.getBoundingClientRect().top-top
    if (Math.abs(delta)>1) (embedded?window:root).scrollBy({top:delta,behavior:"auto"})
  }
  const observer=new ResizeObserver(() => {if(!frame && !stopped) frame=requestAnimationFrame(align)})
  const timer=window.setTimeout(stop,1400)
  observer.observe(content);observer.observe(anchor)
  events.forEach(event => window.addEventListener(event,stop,{capture:true,passive:true}))
  align()
}
