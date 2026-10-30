"use client"

import { useLayoutEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, ArrowUpRight, MoveHorizontal } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { capturePortfolioPosition } from "@/lib/portfolio-return"
import { usePhotoCuration } from "./photo-curation-provider"
import { curatedPortraitBookPages } from "@/lib/curated-portrait-book"
import { portraitSpreadKey, useSoftPortraitBook } from "./use-soft-portrait-book"
import chrome from "./portfolio-chrome.module.css"
import styles from "./portfolio-photo-sessions.module.css"


export function PortfolioPhotoSessions({ paused = false }: { paused?: boolean }) {
  const { locale } = useI18n()
  const curation = usePhotoCuration()
  const pages = useMemo(() => curatedPortraitBookPages(curation, process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top"), [curation])
  const spreadCount = Math.max(1,pages.length / 2)
  const zh = locale === "zh"
  const [book, setBook] = useState<HTMLDivElement | null>(null)
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [spread, setSpread] = useState(0)
  const [busy, setBusy] = useState(false)
  const [restored, setRestored] = useState(false)
  useLayoutEffect(() => {
    if (!book) return
    const saved = Number(window.sessionStorage.getItem(portraitSpreadKey))
    if (Number.isInteger(saved) && saved >= 0 && saved < spreadCount) setSpread(saved)
    setRestored(true)
  }, [book, spreadCount])
  const advance = useSoftPortraitBook({book, canvas, spread, count: spreadCount, paused, onSpread: setSpread, onBusy: setBusy})
  if (!pages.length) return null
  const entryLabel = zh ? "查看人像作品，了解约拍" : "View portraits and book a photo session"
  return <section className={chrome.section} data-return-section="sessions" aria-label={zh ? "预约拍" : "Book a photo session"}>
    <div className={styles.album} data-photo-sessions-entry data-session-spread={spread + 1}>
      <div ref={setBook} className={styles.book} data-portrait-book role="group"
        data-book-restored={String(restored)} aria-busy={!restored || busy} aria-roledescription={zh ? "可拖动翻页的摄影集" : "Draggable photo book"}
        aria-label={zh ? "人像摄影集，点击查看约拍，拖动或使用左右方向键翻页" : "Portrait photo book. Click for photo sessions; drag or use arrow keys to turn pages."}>
        {pages.map((photos, page) => {
          const visible = page === spread * 2 || page === spread * 2 + 1
          return <Link key={page} href="/helsinki-photo-session" className={`${styles.page} ${page % 2 ? styles.right : styles.left}`}
            draggable={false} data-book-leaf={page} data-page-visible={String(visible)} aria-hidden={!visible} tabIndex={visible ? 0 : -1}
            aria-label={entryLabel} onClick={event => capturePortfolioPosition(event.currentTarget.closest<HTMLElement>("[data-return-section]"))}>
            <span className={styles.pageContent} data-book-layout={photos[0] && photos[0].width < photos[0].height ? "vertical" : "horizontal"}>
              {photos.map(photo => <span key={photo.src} className={styles.image} data-book-photo>
                <img src={photo.src} srcSet={photo.srcSet} width={photo.width} height={photo.height} alt={photo.alt[zh ? "zh" : "en"]}
                  loading="lazy" decoding="async" draggable={false} />
              </span>)}
            </span>
          </Link>
        })}
        <canvas key="continuous-paper" ref={setCanvas} className={styles.paperCanvas} aria-hidden="true" />
        <span className={styles.spine} aria-hidden="true" />
        <span className={styles.openCue} aria-hidden="true"><ArrowUpRight size={19} strokeWidth={1.3} /></span>
        <span className={styles.dragCue} aria-hidden="true"><MoveHorizontal size={18} strokeWidth={1.2} /></span>
      </div>
      <div className={styles.caption}>
        <Link href="/helsinki-photo-session" className={styles.entryLink} data-session-booking-link aria-label={entryLabel} onClick={event => capturePortfolioPosition(event.currentTarget.closest<HTMLElement>("[data-return-section]"))}>
          <h2 className={styles.entryTitle}>{zh ? "预约拍" : "Book a session"}</h2>
          <ArrowUpRight size={24} strokeWidth={1.4} aria-hidden="true" />
        </Link>
        <div className={styles.pagination}>
          <button type="button" onClick={() => advance.current(-1)} disabled={busy || paused} aria-label={zh ? "上一组人像" : "Previous portraits"}><ArrowLeft size={18} strokeWidth={1.3} /></button>
          <span role="status" aria-live="polite" aria-label={zh ? `第 ${spread + 1} 组，共 ${spreadCount} 组` : `Spread ${spread + 1} of ${spreadCount}`}>{String(spread + 1).padStart(2,"0")}<span aria-hidden="true"> / {String(spreadCount).padStart(2,"0")}</span></span>
          <button type="button" onClick={() => advance.current(1)} disabled={busy || paused} aria-label={zh ? "下一组人像" : "Next portraits"}><ArrowRight size={18} strokeWidth={1.3} /></button>
        </div>
      </div>
    </div>
  </section>
}
