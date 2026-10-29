"use client"

import { useDocumentTitle } from "@/lib/use-document-title"
import Link from "next/link"
import { ArrowLeft, RotateCw } from "lucide-react"
import { useI18n } from "@/lib/i18n"

export function PortfolioStatus({ mode, retry }: { mode: "loading" | "missing" | "error" | "empty"; retry?: () => void }) {
  const { locale } = useI18n()
  const zh = locale === "zh"
  useDocumentTitle(`${mode==="loading"?(zh?"正在载入照片":"Loading photographs"):mode==="error"?(zh?"暂时无法载入":"Unable to load"):mode==="empty"?(zh?"暂无照片":"No photographs"):(zh?"页面不存在":"Page not found")} · Lijie Li`)
  const message = mode === "loading" ? (zh ? "正在载入照片" : "Loading photographs")
    : mode === "empty" ? (zh ? "这里还没有照片。" : "No photographs here yet.")
    : mode === "missing" ? (zh ? "这一页不在这里。" : "This page is not here.")
      : (zh ? "照片暂时没有载入。" : "The photographs could not load.")
  return <main className="grid min-h-[100svh] place-items-center bg-white px-6 text-[#232724]">
    <div className="w-full max-w-sm text-center">
      <p className="mb-10 text-[11px] font-medium tracking-[-.02em]">LIJIE LI</p>
      <h1 role={mode === "loading" ? "status" : undefined} className="text-2xl font-normal tracking-[-.04em]">{message}</h1>
      {mode === "loading" ? <div aria-hidden="true" className="mx-auto mt-7 h-px w-24 animate-pulse bg-[#657b6b]" /> : <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-[#657b6b]">
        <Link href="/portfolio" className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"><ArrowLeft size={15} />{zh ? "返回作品集" : "Back to photographs"}</Link>
        {retry && <button type="button" onClick={retry} className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"><RotateCw size={15} />{zh ? "重新载入" : "Try again"}</button>}
      </div>}
    </div>
  </main>
}
