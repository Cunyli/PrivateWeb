"use client"

import clsx from "clsx"
import { useI18n } from "@/lib/i18n"

interface LangSwitcherProps {
  className?: string
}

export function LangSwitcher({ className }: LangSwitcherProps) {
  const { locale, setLocale } = useI18n()
  const toggleLocale = () => {
    setLocale((locale === "en" ? "zh" : "en") as "en" | "zh")
  }

  const nextLocale = locale === "en" ? "zh" : "en"

  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label={locale === "en" ? "Switch to Chinese" : "切换到英文"}
      title={locale === "en" ? "Switch to Chinese" : "切换到英文"}
      className={clsx(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-current/15 bg-transparent text-[#232724] transition-[background,transform] duration-200 hover:-translate-y-0.5 hover:bg-black/5 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#657b6b]",
        className,
      )}
    >
      <span aria-hidden="true" className="text-[11px] font-medium leading-none tracking-[-.02em]">
        {nextLocale === "en" ? "EN" : "中"}
      </span>
      <span className="sr-only">{locale === "en" ? "Switch to Chinese" : "切换到英文"}</span>
    </button>
  )
}
