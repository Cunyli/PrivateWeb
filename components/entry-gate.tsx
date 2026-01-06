"use client"

import Link from "next/link"
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
  hrTitle: { en: "Resume & Experience", zh: "简历与经历" },
  hrBody: {
    en: "A concise view for hiring managers: background, skills, and roles.",
    zh: "给招聘经理的版本：经历、能力与岗位匹配。",
  },
  hrCta: { en: "View Resume", zh: "查看简历" },
  portfolioTitle: { en: "Portfolio & Bookings", zh: "作品集与约拍" },
  portfolioBody: {
    en: "Selected photography work with ways to get in touch for sessions.",
    zh: "摄影作品精选与约拍联系方式。",
  },
  portfolioCta: { en: "View Portfolio", zh: "查看作品集" },
}

export function EntryGate() {
  const { locale } = useI18n()
  const gateLocale: Locale = locale === "zh" ? "zh" : "en"

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <section className="relative isolate overflow-hidden px-6 py-24 sm:px-10">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(17,24,39,0.06),_transparent_60%)]" />
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 text-center">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-zinc-500">
              {gateCopy.badge[gateLocale]}
            </p>
            <h1 className="text-3xl font-light text-zinc-900 sm:text-4xl">
              {gateCopy.title[gateLocale]}
            </h1>
            <p className="text-base text-zinc-600">{gateCopy.subtitle[gateLocale]}</p>
          </div>

          <div className="grid w-full gap-6 md:grid-cols-2">
            <Link
              href="/resume"
              className="group rounded-3xl border border-zinc-200 bg-white p-8 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
                {gateCopy.hrTitle[gateLocale]}
              </p>
              <p className="mt-3 text-lg font-medium text-zinc-900">
                {gateCopy.hrBody[gateLocale]}
              </p>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-900">
                {gateCopy.hrCta[gateLocale]}
                <span className="transition group-hover:translate-x-1">→</span>
              </div>
            </Link>

            <Link
              href="/portfolio"
              className="group rounded-3xl border border-zinc-200 bg-white p-8 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
                {gateCopy.portfolioTitle[gateLocale]}
              </p>
              <p className="mt-3 text-lg font-medium text-zinc-900">
                {gateCopy.portfolioBody[gateLocale]}
              </p>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-900">
                {gateCopy.portfolioCta[gateLocale]}
                <span className="transition group-hover:translate-x-1">→</span>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
