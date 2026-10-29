"use client"

import Link from "next/link"
import { ArrowDown } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { MouseEvent } from "react"
import { useI18n } from "@/lib/i18n"
import { PortfolioDreamscape, type DreamscapeInput } from "./portfolio-dreamscape"
import styles from "./portfolio-entry.module.css"
import { PortfolioFrameProbe } from "./portfolio-frame-probe"

const phase = (start: number, end: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)))
  return t * t * (3 - 2 * t)
}

export function EntryGate() {
  const { locale } = useI18n()
  const heroRef = useRef<HTMLElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const pointerBounds = useRef({ width: 1, height: 1 })
  const sceneInput = useRef<DreamscapeInput>({ position: 0, impulse: 0, progress: 0 })
  const reducedRef = useRef(false)
  const enteredRef = useRef(false)
  const [entered, setEntered] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [inView, setInView] = useState(true)
  const enter = useCallback(() => {
    if (!enteredRef.current) { enteredRef.current = true; setEntered(true) }
  }, [])

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => {
      reducedRef.current = motion.matches
      sceneInput.current.reducedMotion = motion.matches
      setReducedMotion(motion.matches)
      sceneInput.current.requestRender?.()
    }
    sync()
    motion.addEventListener("change", sync)
    return () => motion.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    const hero = heroRef.current, viewport = frameRef.current
    if (!hero || !viewport) return
    const works = document.getElementById("works")
    if(works)works.inert=true
    const written = new Map<string, string>()
    let height = 1, heroHeight = 1, heroTop = 0, distance = 1, inset = .04
    let frame = 0, smoothTravel = 0, lastScroll = window.scrollY
    const write = (key: string, value: string) => {
      if (written.get(key) === value) return
      written.set(key, value)
      hero.style.setProperty(key, value)
    }
    const update = () => {
      frame = 0
      // Geometry is cached on resize; this hot path performs no layout reads.
      const scroll = window.scrollY
      const raw = Math.max(0, scroll - heroTop)
      const target = Math.min(distance, raw)
      if (target > 16) enter()
      smoothTravel = target
      const progress = Math.min(1, smoothTravel / distance)
      const inactive = progress < .735
      if (works && works.hasAttribute("inert") !== inactive) works.inert = inactive
      const scenePresence = 1 - phase(.50, .54, progress)
      const nameVisibility = phase(.035, .22, progress) * (1 - phase(.37, .54, progress))
      const chrome = 1 - phase(.40, .50, progress)
      const header = (1 - nameVisibility) * chrome
      write("--scene-scale", String(1 - inset * (1 - phase(.40, .54, progress))))
      write("--scene-radius", (5 * (1 - phase(.40, .54, progress))).toFixed(2) + "px")
      write("--inset-duration", progress > .38 ? "0ms" : "420ms")
      write("--scene-presence", String(scenePresence))
      write("--frame-backing-opacity",String(1-phase(.54,.585,progress)))
      write("--frame-visibility", progress >= .735 ? "hidden" : "visible")
      write("--frame-events", progress >= .735 ? "none" : "auto")
      write("--header-opacity", String(header))
      write("--header-visibility", header > .02 ? "visible" : "hidden")
      write("--chrome-opacity", String(chrome))
      write("--chrome-visibility", chrome > .02 ? "visible" : "hidden")
      const progressText = progress.toFixed(3)
      if (hero.dataset.storyProgress !== progressText) hero.dataset.storyProgress = progressText
      const storyPhase = progress >= .735 ? "portfolio" : progress > .53 ? "revealing-portfolio" : progress > .28 ? "passing-foreground" : "name"
      if (hero.dataset.storyPhase !== storyPhase) hero.dataset.storyPhase = storyPhase
      sceneInput.current.progress = progress
      sceneInput.current.position = smoothTravel * .002
      sceneInput.current.impulse = reducedRef.current ? 0 : Math.min(.6, Math.abs(scroll - lastScroll) * .006)
      if (raw < heroHeight + height * .2) sceneInput.current.requestRender?.()
      lastScroll = scroll
    }
    const requestTick = () => { if (!frame) frame = requestAnimationFrame(update) }
    const measure = () => {
      height = viewport.offsetHeight
      pointerBounds.current = { width: viewport.offsetWidth, height }
      heroHeight = hero.offsetHeight
      heroTop = hero.getBoundingClientRect().top + window.scrollY
      distance = Math.max(1, heroHeight / .735)
      inset = window.matchMedia("(max-width: 640px)").matches ? .03 : .04
      requestTick()
    }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.intersectionRatio > .01), { threshold: [0, .01] })
    observer.observe(hero)
    const sizes = new ResizeObserver(measure)
    sizes.observe(hero); sizes.observe(viewport)
    window.addEventListener("scroll", requestTick, { passive: true })
    window.addEventListener("resize", measure)
    window.visualViewport?.addEventListener("resize",measure)
    measure()
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); sizes.disconnect()
      if (works) works.inert = false
      window.removeEventListener("scroll", requestTick)
      window.removeEventListener("resize", measure)
      window.visualViewport?.removeEventListener("resize",measure)
    }
  }, [enter])

  const seeWorks = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const works = document.getElementById("works")
    if (works) { event.preventDefault(); works.scrollIntoView({ behavior: reducedRef.current ? "auto" : "smooth", block: "start" }) }
  }
  return <section ref={heroRef} className={styles.hero} data-entered={entered}
    aria-label={locale === "zh" ? "Lijie Li 的摄影作品集" : "Photography by Lijie Li"}>
    <h1 className="sr-only">Lijie Li</h1>
    <PortfolioFrameProbe input={sceneInput} />
    <div ref={frameRef} className={styles.cinemaFrame} onPointerMove={event => {
      if (event.pointerType !== "mouse" || reducedRef.current) return
      const bounds = pointerBounds.current
      sceneInput.current.pointerX = (event.clientX / bounds.width - .5) * .016
      sceneInput.current.pointerY = (event.clientY / bounds.height - .5) * .012
    }} onPointerLeave={() => { sceneInput.current.pointerX = 0; sceneInput.current.pointerY = 0 }}>
      <div className={styles.sceneInset}>
        <div className={styles.stage}>
          <PortfolioDreamscape className={styles.scene} isPlaying={inView && !reducedMotion} input={sceneInput} />
          <div className={styles.shade} aria-hidden="true" />
        </div>
      </div>
      {!entered && <button type="button" className={styles.sceneEntry} onClick={enter}
        aria-label={locale === "zh" ? "点击进入，滚动穿过梦境" : "Enter the scene, then scroll through the dream"} />}
      <header className={styles.header}><Link href="/" className={styles.identity}>LIJIE LI</Link></header>
      <footer className={styles.footer}>
        <a href="#works" className={styles.worksLink} onClick={seeWorks}><span>{locale === "zh" ? "看作品" : "View work"}</span><ArrowDown aria-hidden="true" strokeWidth={1.25} /></a>
      </footer>
    </div>
  </section>
}
