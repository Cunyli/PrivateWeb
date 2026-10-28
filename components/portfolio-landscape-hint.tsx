"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import styles from "./portfolio-landscape-hint.module.css"

const DISMISSED_KEY = "portfolio:landscape-hint-dismissed"

export function PortfolioLandscapeHint() {
  const pathname = usePathname()
  const { locale } = useI18n()
  const [visible, setVisible] = useState(false)
  const dismissed = useRef(false)
  const preview = useRef(false)
  const portfolioRoute = pathname === "/" || pathname === "/portfolio" || pathname.startsWith("/work/")

  const dismiss = () => {
    dismissed.current = true
    setVisible(false)
    if (preview.current) return
    try { window.sessionStorage.setItem(DISMISSED_KEY, "1") }
    catch { /* The hint still stays dismissed when session storage is unavailable. */ }
  }

  useEffect(() => {
    if (!portfolioRoute) { setVisible(false); return }
    // Explicit local visual QA; narrow desktop windows stay unaffected on normal URLs.
    preview.current = process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).get("rotate") === "preview"
    if (!preview.current) {
      try { if (window.sessionStorage.getItem(DISMISSED_KEY) === "1") dismissed.current = true }
      catch { /* Persistence is optional; the current view still remembers dismissal. */ }
    }
    const portrait = window.matchMedia("(orientation: portrait)")
    const touch = window.matchMedia("(any-pointer: coarse)")
    const sync = () => {
      const phone = preview.current || ((touch.matches || navigator.maxTouchPoints > 0) && Math.min(window.screen.width, window.screen.height) <= 767)
      if (phone && !portrait.matches) { dismiss(); return }
      setVisible(phone && portrait.matches && window.innerWidth <= 767 && !dismissed.current)
    }
    portrait.addEventListener("change", sync)
    touch.addEventListener("change", sync)
    window.addEventListener("resize", sync, { passive: true })
    sync()
    return () => {
      portrait.removeEventListener("change", sync)
      touch.removeEventListener("change", sync)
      window.removeEventListener("resize", sync)
    }
  }, [portfolioRoute])

  if (!visible || !portfolioRoute) return null
  return <aside className={styles.hint} data-landscape-hint role="status" aria-live="polite">
    <svg className={styles.icon} viewBox="0 0 40 36" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className={styles.phone}><rect x="12" y="7" width="14" height="23" rx="2.5" /><path d="M17 26.5h4" /></g>
      <path className={styles.arrow} d="M31 17A12 12 0 0 0 21 5m3-3-3 3 3 3" />
    </svg>
    <p>{locale === "zh" ? "横过来，画面更完整" : "Turn for the full picture"}</p>
    <button type="button" className={styles.close} onClick={dismiss} aria-label={locale === "zh" ? "关闭横屏提示" : "Dismiss rotation hint"}><X size={15} strokeWidth={1.4} aria-hidden="true" /></button>
  </aside>
}
