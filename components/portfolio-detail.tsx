"use client"

import { ArrowLeft, ArrowRight, ArrowUpRight, Grid2X2, Info, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Carousel, photoSource } from "@/components/carousel"
import type { CarouselImage } from "@/components/carousel"
import { useI18n } from "@/lib/i18n"
import { useRouter, useSearchParams } from "next/navigation"
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import styles from "./portfolio-viewer.module.css"

interface LocalizedContent { title?: string; subtitle?: string; description?: string }
interface PortfolioDetailProps {
  id: string
  images: CarouselImage[]
  translations: { en: LocalizedContent; zh: LocalizedContent }
  locations?: unknown[]
  returnContext?: {
    type: "portfolio" | "style"; homePath?: "/" | "/portfolio"; returnSetId?: number | string | null
    styleKey?: string | null; styleIndex?: number | null; focusSection?: string | null; restore?: boolean
  }
  viewSetContext?: { type: "style"; styleKey: string } | null
}

function PhotoOverview({ images, currentIndex, title, open, onOpenChange, onSelect }: {
  images: CarouselImage[]; currentIndex: number; title: string; open: boolean
  onOpenChange: (value: boolean) => void; onSelect: (index: number) => void
}) {
  const { locale } = useI18n()
  const bucket = process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top"
  return <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
    <DrawerTrigger asChild><button type="button" className={styles.iconButton} aria-label={locale === "zh" ? "打开照片总览" : "Open contact sheet"}><Grid2X2 size={17} strokeWidth={1.4} /></button></DrawerTrigger>
    <DrawerContent className={styles.panel} overlayClassName={styles.sheetOverlay} data-viewer-sheet>
      <div className={styles.panelHeader}><div><DrawerTitle className={styles.panelTitle}>{title}</DrawerTitle><DrawerDescription className="sr-only">{locale === "zh" ? `${images.length} 张照片` : `${images.length} photographs`}</DrawerDescription></div>
        <DrawerClose asChild><button className={styles.iconButton} aria-label={locale === "zh" ? "关闭照片总览" : "Close contact sheet"}><X size={19} strokeWidth={1.4} /></button></DrawerClose>
      </div>
      <div className={styles.contactSheet}>
        {images.map((image, index) => <button key={image.id ?? index} type="button" className={styles.thumbnail} aria-current={index === currentIndex ? "true" : undefined}
          aria-label={locale === "zh" ? `查看第 ${index + 1} 张照片` : `View photograph ${index + 1}`}
          onClick={() => { onSelect(index); onOpenChange(false) }}>
          <span className={styles.thumbnailFrame}><img src={photoSource(image.url, bucket)} alt="" loading="lazy" decoding="async" draggable={false} /></span>
          <span className={styles.thumbnailNumber}>{String(index + 1).padStart(2, "0")}</span>
        </button>)}
      </div>
    </DrawerContent>
  </Drawer>
}

export default function PortfolioDetail({ images, translations, locations = [], returnContext, viewSetContext = null }: PortfolioDetailProps) {
  const reduced = useReducedMotion()
  const searchParams = useSearchParams()
  const requestedId = searchParams.get("pictureId")
  const pictureIndex = requestedId ? images.findIndex(image => String(image.id) === requestedId) : -1
  const requestedIndex = pictureIndex >= 0 ? pictureIndex : Number.parseInt(searchParams.get("index") || "0", 10)
  const initialIndex = Math.max(0, Math.min(Number.isFinite(requestedIndex) ? requestedIndex : 0, images.length - 1))
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [presentedIndex, setPresentedIndex] = useState(initialIndex)
  const [showOverview, setShowOverview] = useState(false)
  const [busy, setBusy] = useState(true)
  const [isLeaving, setIsLeaving] = useState(false)
  const leaving = useRef(false)
  const exitTimer = useRef<number | null>(null)
  const { locale } = useI18n()
  const router = useRouter()
  const currentImage = images[presentedIndex]
  const set = locale === "zh" ? translations.zh : translations.en
  const otherSet = locale === "zh" ? translations.en : translations.zh
  const displayTitle = set.title || otherSet.title || ""
  const displaySubtitle = set.subtitle || otherSet.subtitle || ""
  const displayDescription = set.description || otherSet.description || ""
  const image = currentImage?.translations[locale === "zh" ? "zh" : "en"]
  const otherImage = currentImage?.translations[locale === "zh" ? "en" : "zh"]
  const displayImageTitle = image?.title || otherImage?.title || ""
  const displayImageDescription = image?.description || otherImage?.description || ""
  const locationNames = locations.map((location: any) => locale === "zh" ? location?.name_zh || location?.name || location?.name_en : location?.name_en || location?.name || location?.name_zh).filter(Boolean)

  const resolveHomeHref = useCallback(() => {
    if (returnContext?.type === "style" && returnContext.styleKey) {
      const params = new URLSearchParams()
      params.set("index", String(typeof returnContext.styleIndex === "number" ? returnContext.styleIndex : 0))
      params.set("origin", returnContext.homePath === "/" ? "home" : "portfolio")
      params.set("restore", "1"); params.set("returnSection", "styles")
      return `/work/style/${returnContext.styleKey}?${params.toString()}`
    }
    if (returnContext?.type === "portfolio") {
      const params = new URLSearchParams()
      if (returnContext.restore !== false) params.set("restore", "1")
      if (returnContext.returnSetId != null) params.set("focusSet", String(returnContext.returnSetId))
      if (returnContext.focusSection) params.set("focusSection", returnContext.focusSection)
      const query = params.toString(), path = returnContext.homePath || "/portfolio"
      return query ? `${path}?${query}` : path
    }
    return "/portfolio"
  }, [returnContext])

  const leaveTo = useCallback((href: string) => {
    if (leaving.current) return
    leaving.current = true; setIsLeaving(true)
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160
    exitTimer.current = window.setTimeout(() => router.push(href), delay)
  }, [router])
  useEffect(() => () => { if (exitTimer.current !== null) window.clearTimeout(exitTimer.current) }, [])

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector('[role="dialog"]')) return
      event.preventDefault()
      leaveTo(resolveHomeHref())
    }
    window.addEventListener("keydown", escape)
    return () => window.removeEventListener("keydown", escape)
  }, [leaveTo, resolveHomeHref])

  const handleViewSet = () => {
    const setId = currentImage?.setId
    if (setId == null) return
    if (viewSetContext?.type === "style") {
      const params = new URLSearchParams({ style: viewSetContext.styleKey, origin: "style", originStyle: viewSetContext.styleKey, originIndex: String(presentedIndex) })
      if (returnContext?.homePath === "/") params.set("returnTo", "home")
      leaveTo(`/work/${setId}?${params.toString()}`)
    } else leaveTo(`/work/${setId}`)
  }
  const changeImage = (index: number) => setCurrentIndex(Math.max(0, Math.min(images.length - 1, index)))
  const previous = () => setCurrentIndex(index => (index - 1 + images.length) % images.length)
  const next = () => setCurrentIndex(index => (index + 1) % images.length)

  return <div className={styles.viewer} data-photo-viewer data-leaving={isLeaving} data-overview={showOverview}>
    <header className={styles.header}>
      <div className={styles.collection}>
        <button type="button" className={styles.iconButton} onClick={() => leaveTo(resolveHomeHref())} aria-label={locale === "zh" ? (returnContext?.type === "style" ? "返回专栏" : "返回作品集") : (returnContext?.type === "style" ? "Back to the series" : "Back to photographs")}><ArrowLeft size={19} strokeWidth={1.4} /></button>
        <h1>{displayTitle}</h1>
      </div>
      <div className={styles.count} aria-live="polite" aria-atomic="true" data-photo-count><span>{String(images.length ? presentedIndex + 1 : 0).padStart(2, "0")}</span><span>/</span><span>{String(images.length).padStart(2, "0")}</span></div>
      <div className={styles.headerActions}>
        <PhotoOverview images={images} currentIndex={presentedIndex} title={displayTitle} open={showOverview} onOpenChange={setShowOverview} onSelect={changeImage} />
        <Drawer shouldScaleBackground={false}>
          <DrawerTrigger asChild><button className={styles.iconButton} aria-label={locale === "zh" ? "查看照片详情" : "Photograph details"}><Info size={18} strokeWidth={1.4} /></button></DrawerTrigger>
          <DrawerContent className={styles.panel} overlayClassName={styles.sheetOverlay} data-viewer-sheet>
            <div className={styles.panelHeader}><div><DrawerTitle className={styles.panelTitle}>{locale === "zh" ? "照片信息" : "Photograph details"}</DrawerTitle><DrawerDescription className="sr-only">{displayImageTitle || displayTitle}</DrawerDescription></div>
              <DrawerClose asChild><button className={styles.iconButton} aria-label={locale === "zh" ? "关闭照片详情" : "Close details"}><X size={19} strokeWidth={1.4} /></button></DrawerClose>
            </div>
            <div className={styles.details}>
              {(displayImageTitle || displayImageDescription) && <section className={styles.detailSection}><p className={styles.detailLabel}>{locale === "zh" ? "当前照片" : "Photograph"}</p>
                {displayImageTitle && <h2 className={styles.detailHeading}>{displayImageTitle}</h2>}
                {displayImageDescription && <p className={styles.detailCopy}>{displayImageDescription}</p>}
              </section>}
              <section className={styles.detailSection}><p className={styles.detailLabel}>{locale === "zh" ? "作品集" : "Collection"}</p>
                {displayTitle && <h2 className={styles.detailHeading}>{displayTitle}</h2>}
                {displaySubtitle && <p className={styles.detailCopy}>{displaySubtitle}</p>}
                {displayDescription && <p className={styles.detailCopy}>{displayDescription}</p>}
              </section>
              {locationNames.length > 0 && <section className={styles.detailSection}><p className={styles.detailLabel}>{locale === "zh" ? "地点" : "Locations"}</p><div className={styles.locations}>{locationNames.map((name, index) => <span key={index}>{name}</span>)}</div></section>}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </header>
    <main className={styles.imageArea} aria-busy={busy}>
      <Carousel images={images} currentIndex={currentIndex} onChangeImage={changeImage} onDisplayImage={setPresentedIndex} onBusyChange={setBusy} />
    </main>
    <footer className={styles.footer}>
      <div className={styles.captionGroup}>
        <motion.p key={presentedIndex} className={styles.caption} initial={reduced ? false : { opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .3 }}>
          {displayImageTitle || displaySubtitle || displayTitle}
        </motion.p>
        {currentImage?.setId != null && <button className={styles.setLink} onClick={handleViewSet}>{locale === "zh" ? "查看所在相册" : "View collection"}<ArrowUpRight size={12} /></button>}
      </div>
      <nav className={styles.nav} aria-label={locale === "zh" ? "切换照片" : "Photograph navigation"}>
        <button className={styles.navButton} type="button" onClick={previous} disabled={images.length < 2} aria-label={locale === "zh" ? "上一张照片" : "Previous photograph"}><ArrowLeft size={18} strokeWidth={1.4} /></button>
        <button className={styles.navButton} type="button" onClick={next} disabled={images.length < 2} aria-label={locale === "zh" ? "下一张照片" : "Next photograph"}><ArrowRight size={18} strokeWidth={1.4} /></button>
      </nav>
      <div className={styles.progress} aria-hidden="true"><span style={{ transform: `scaleX(${images.length ? (presentedIndex + 1) / images.length : 0})` }} /></div>
    </footer>
  </div>
}
