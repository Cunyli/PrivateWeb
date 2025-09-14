"use client"

import { useI18n } from "@/lib/i18n"

export function LangSwitcher() {
  const { locale, setLocale } = useI18n()
  return (
    <div className="fixed top-3 right-3 z-50">
      <select
        aria-label="Language"
        className="border rounded px-2 py-1 text-sm bg-white/90 backdrop-blur shadow"
        value={locale}
        onChange={(e)=> setLocale(e.target.value as any)}
      >
        <option value="en">English</option>
        <option value="zh">中文</option>
      </select>
    </div>
  )
}

