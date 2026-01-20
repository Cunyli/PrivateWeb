"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import type { CSSProperties, PointerEvent } from "react"
import { useI18n } from "@/lib/i18n"

type Locale = "en" | "zh"
type LocalizedString = Record<Locale, string>

const gateCopy = {
  badge: { en: "Start Here", zh: "从这里开始" },
  title: { en: "What are you here for?", zh: "你想先看哪一部分？" },
  subtitle: {
    en: "Choose a path and jump directly to the content you need.",
    zh: "选择入口，直接进入你需要的内容。",
  },
  vintage: {
    en: "A VINTAGE PROLOGUE TO A NEW CRAFT.",
    zh: "复古序章，通往新的技艺。",
  },
  hint: {
    en: "TWO PORTALS. TWO FUTURES.",
    zh: "两条路径，两种未来。",
  },
  hrTitle: { en: "Got a job?", zh: "有坑位吗" },
  hrBody: {
    en: "Quick resume.",
    zh: "CV来喽",
  },
  portfolioTitle: { en: "Wanna see pics?", zh: "想看作品吗" },
  portfolioBody: {
    en: "The good stuff is here.",
    zh: "好看的都在这",
  },
}

export function EntryGate() {
  const { locale, setLocale } = useI18n()
  const gateLocale: Locale = locale === "zh" ? "zh" : "en"
  const router = useRouter()
  const [isExiting, setIsExiting] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const sceneRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const targetRef = useRef({
    tiltX: 0,
    tiltY: 0,
    parallaxX: 0,
    parallaxY: 0,
    focusScale: 1,
    focusOpacity: 0.35,
    focusBlur: 18,
    focusDepth: 12,
  })
  const currentRef = useRef({ ...targetRef.current })

  const animateScene = () => {
    const node = sceneRef.current
    if (!node) {
      rafRef.current = null
      return
    }
    const current = currentRef.current
    const target = targetRef.current
    const ease = 0.08
    const lerp = (from: number, to: number) => from + (to - from) * ease

    current.tiltX = lerp(current.tiltX, target.tiltX)
    current.tiltY = lerp(current.tiltY, target.tiltY)
    current.parallaxX = lerp(current.parallaxX, target.parallaxX)
    current.parallaxY = lerp(current.parallaxY, target.parallaxY)
    current.focusScale = lerp(current.focusScale, target.focusScale)
    current.focusOpacity = lerp(current.focusOpacity, target.focusOpacity)
    current.focusBlur = lerp(current.focusBlur, target.focusBlur)
    current.focusDepth = lerp(current.focusDepth, target.focusDepth)

    node.style.setProperty("--tilt-x", `${current.tiltX.toFixed(2)}deg`)
    node.style.setProperty("--tilt-y", `${current.tiltY.toFixed(2)}deg`)
    node.style.setProperty("--parallax-x", `${current.parallaxX.toFixed(2)}px`)
    node.style.setProperty("--parallax-y", `${current.parallaxY.toFixed(2)}px`)
    node.style.setProperty("--focus-scale", `${current.focusScale.toFixed(3)}`)
    node.style.setProperty("--focus-opacity", `${current.focusOpacity.toFixed(3)}`)
    node.style.setProperty("--focus-blur", `${current.focusBlur.toFixed(2)}px`)
    node.style.setProperty("--focus-depth", `${current.focusDepth.toFixed(2)}px`)

    const shouldContinue =
      Math.abs(current.tiltX - target.tiltX) > 0.01 ||
      Math.abs(current.tiltY - target.tiltY) > 0.01 ||
      Math.abs(current.parallaxX - target.parallaxX) > 0.1 ||
      Math.abs(current.parallaxY - target.parallaxY) > 0.1 ||
      Math.abs(current.focusScale - target.focusScale) > 0.001

    rafRef.current = shouldContinue ? requestAnimationFrame(animateScene) : null
  }

  const scheduleAnimation = () => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(animateScene)
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const node = sceneRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    targetRef.current.tiltX = (0.5 - y) * 10
    targetRef.current.tiltY = (x - 0.5) * 12
    targetRef.current.parallaxX = (x - 0.5) * 28
    targetRef.current.parallaxY = (y - 0.5) * 28

    const focusX = 0.64
    const focusY = 0.36
    const dx = x - focusX
    const dy = y - focusY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const intensity = Math.max(0, 1 - distance * 2.2)
    targetRef.current.focusScale = 1 + intensity * 0.18
    targetRef.current.focusOpacity = 0.35 + intensity * 0.35
    targetRef.current.focusBlur = 18 - intensity * 6
    targetRef.current.focusDepth = 12 + intensity * 10

    scheduleAnimation()
  }

  const handlePointerLeave = () => {
    targetRef.current.tiltX = 0
    targetRef.current.tiltY = 0
    targetRef.current.parallaxX = 0
    targetRef.current.parallaxY = 0
    targetRef.current.focusScale = 1
    targetRef.current.focusOpacity = 0.35
    targetRef.current.focusBlur = 18
    targetRef.current.focusDepth = 12
    scheduleAnimation()
  }

  const handleToggleLocale = () => {
    setLocale(locale === "zh" ? "en" : "zh")
  }

  const handleNavigate = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (isExiting) return
    setIsExiting(true)
    window.setTimeout(() => {
      router.push(href)
    }, 420)
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)")
    const handleChange = () => setIsMobile(mediaQuery.matches)
    handleChange()

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  useEffect(() => {
    if (!isMobile) return
    const originalOverflow = document.body.style.overflow
    const originalOverscroll = document.documentElement.style.overscrollBehavior
    document.body.style.overflow = "hidden"
    document.documentElement.style.overscrollBehavior = "none"
    return () => {
      document.body.style.overflow = originalOverflow
      document.documentElement.style.overscrollBehavior = originalOverscroll
    }
  }, [isMobile])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return (
    <main
      ref={sceneRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative min-h-[100svh] overflow-hidden bg-transparent text-zinc-900 font-['Manrope'] transition-all duration-500 ${isExiting ? "scale-[0.98] opacity-0" : "opacity-100"} ${isMobile ? "entry-animate" : ""}`}
      style={
        {
          perspective: "1200px",
          "--focus-scale": "1",
          "--focus-opacity": "0.35",
          "--focus-blur": "18px",
          "--focus-depth": "12px",
          "--parallax-x": "0px",
          "--parallax-y": "0px",
        } as CSSProperties
      }
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className={`absolute bg-cover bg-no-repeat will-change-transform ${isMobile ? "left-1/2 top-1/2" : "inset-0"}`}
          style={{
            backgroundImage: "url('/hand_with_hand.png')",
            backgroundPosition: isMobile ? "50% 50%" : "37% center",
            backgroundSize: "cover",
            width: isMobile ? "165vmax" : "100%",
            height: isMobile ? "165vmax" : "100%",
            transform:
              isMobile
                ? "translate3d(-50%, -50%, 0) rotate(90deg) scale(1.05)"
                : "translate3d(calc(var(--parallax-x, 0px) * 0.2), calc(var(--parallax-y, 0px) * 0.2), 0)",
            transformOrigin: "center",
          }}
        />
      </div>

      <section className="entry-section relative mx-auto flex min-h-[100svh] max-w-6xl items-center justify-center px-6 py-16 sm:px-10 sm:py-24">
        <div className="relative w-full">
          <button
            type="button"
            onClick={handleToggleLocale}
            className="entry-chip absolute right-[8%] top-[18%] z-20 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-1 py-1 text-[8px] font-semibold uppercase tracking-[0.24em] text-zinc-700 shadow-[0_14px_32px_-24px_rgba(58,44,35,0.6)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-26px_rgba(58,44,35,0.7)]"
            style={{
              transform:
                "translate3d(var(--parallax-x, 0px), var(--parallax-y, 0px), 50px)",
            }}
            aria-label="翻译 / Translate"
          >
            {gateLocale === "zh" ? "语言" : "Language"}
          </button>
          <div className="pointer-events-none absolute left-[62%] top-[34%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 opacity-[var(--focus-opacity,0.35)] motion-safe:animate-orb-pulse"
            style={{
              transform:
                "translate3d(-50%, -50%, var(--focus-depth, 12px)) scale(var(--focus-scale, 1))",
              filter: "blur(var(--focus-blur, 18px))",
            }}
          >
            <div className="h-full w-full rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.9),_rgba(255,255,255,0.25)_55%,_transparent_70%)]" />
          </div>

          <div
            className="grid gap-10 text-left md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"
            style={{
              transform:
                "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
              transformStyle: "preserve-3d",
              transition: "transform 300ms ease",
            }}
          >
            <div
              className="grid gap-6"
              style={{
                transform:
                  "translate3d(calc(var(--parallax-x, 0px) * 0.4), calc(var(--parallax-y, 0px) * 0.4), 42px)",
              }}
            >
              <Link
                href="/portfolio"
                className="entry-card entry-card-left group relative -translate-y-28 overflow-hidden rounded-[2.2rem] border border-white/60 bg-white/75 p-7 text-left shadow-[0_28px_70px_-50px_rgba(58,44,35,0.55)] backdrop-blur transition duration-500 hover:-translate-y-24 hover:shadow-[0_40px_90px_-60px_rgba(58,44,35,0.65)]"
                onClick={handleNavigate("/portfolio")}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.85),_transparent_70%)] opacity-0 transition duration-500 group-hover:opacity-100" />
                <div className="relative z-10 flex h-full flex-col gap-4 text-center">
                  <div className="flex items-center justify-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-600">
                      {gateCopy.portfolioTitle[gateLocale]}
                    </p>
                  </div>
                  <p className="mt-2 text-lg font-medium text-zinc-900 sm:text-xl">
                    {gateCopy.portfolioBody[gateLocale]}
                  </p>
                </div>
              </Link>
            </div>

            <div
              className="grid gap-6 md:mt-8"
              style={{
                transform:
                  "translate3d(calc(var(--parallax-x, 0px) * 0.7), calc(var(--parallax-y, 0px) * 0.7), 70px)",
              }}
            >
              <Link
                href="/resume"
                className="entry-card entry-card-right group relative translate-y-28 overflow-hidden rounded-[2.2rem] border border-white/60 bg-white/75 p-7 text-left shadow-[0_28px_70px_-50px_rgba(58,44,35,0.55)] backdrop-blur transition duration-500 hover:translate-y-24 hover:shadow-[0_40px_90px_-60px_rgba(58,44,35,0.65)]"
                onClick={handleNavigate("/resume")}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.85),_transparent_70%)] opacity-0 transition duration-500 group-hover:opacity-100" />
                <div className="relative z-10 flex h-full flex-col gap-4 text-center">
                  <div className="flex items-center justify-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-600">
                      {gateCopy.hrTitle[gateLocale]}
                    </p>
                  </div>
                  <p className="text-lg font-medium text-zinc-900 sm:text-xl">
                    {gateCopy.hrBody[gateLocale]}
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>
      <style jsx>{`
        .entry-animate .entry-section {
          animation: entry-fade 520ms ease-out both;
        }

        .entry-animate .entry-chip {
          animation: entry-rise 520ms ease-out 120ms both;
        }

        .entry-animate .entry-card {
          animation: entry-rise 620ms ease-out both;
        }

        .entry-animate .entry-card-left {
          animation-delay: 160ms;
        }

        .entry-animate .entry-card-right {
          animation-delay: 260ms;
        }

        @keyframes entry-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes entry-rise {
          from {
            opacity: 0;
            filter: blur(6px);
          }
          to {
            opacity: 1;
            filter: blur(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .entry-animate .entry-section,
          .entry-animate .entry-chip,
          .entry-animate .entry-card {
            animation: none;
          }
        }
      `}</style>
    </main>
  )
}
