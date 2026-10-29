"use client"

import Link from "next/link"
import { ArrowUpRight, Check, Copy } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useI18n } from "@/lib/i18n"
import styles from "./portfolio-chrome.module.css"

export function PortfolioFooter() {
  const { locale } = useI18n()
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")
  const reset = useRef<number | null>(null)
  const wechat = "Llj773882712"
  useEffect(() => () => { if (reset.current !== null) window.clearTimeout(reset.current) }, [])
  const copy = async () => {
    try { await navigator.clipboard.writeText(wechat); setCopyState("copied") }
    catch { setCopyState("failed") }
    if (reset.current !== null) window.clearTimeout(reset.current)
    reset.current = window.setTimeout(() => setCopyState("idle"), 2600)
  }
  return <footer className={styles.footer}>
    <Link href="/" className={styles.signature}>LIJIE LI</Link>
    <div className={styles.footerLinks}>
      <a href="https://www.instagram.com/cunyli_lijie/" target="_blank" rel="noreferrer">Instagram<ArrowUpRight size={12} aria-hidden="true" /></a>
      <a href="https://www.xiaohongshu.com/user/profile/608e62a5000000000100bc40" target="_blank" rel="noreferrer">{locale === "zh" ? "小红书" : "Xiaohongshu"}<ArrowUpRight size={12} aria-hidden="true" /></a>
      <button type="button" onClick={copy} aria-label={locale === "zh" ? `复制微信号 ${wechat}` : `Copy WeChat ID ${wechat}`}>{copyState === "copied" ? (locale === "zh" ? "已复制" : "Copied") : (locale === "zh" ? "微信" : "WeChat")}{copyState === "copied" ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}</button>
    </div>
    <div className={styles.footerAside}>
      <span className={styles.copyStatus} role="status">{copyState === "failed" ? `${locale === "zh" ? "微信" : "WeChat"} · ${wechat}` : copyState === "copied" ? (locale === "zh" ? "微信号已复制" : "WeChat ID copied") : ""}</span>
    </div>
  </footer>
}
