"use client"

import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import styles from "./session-series-gallery.module.css"

type SeriesPhoto = {
  id: string
  src: string
  alt: string
  sourceName?: string
  width?: number
  height?: number
  previewSrc?: string
  previewSrcSet?: string
}

type PhotoSeries = {
  id: string
  title: string
  place: string
  kind?: "highlights"
  photos: SeriesPhoto[]
}

// Keep a shoot together, with a quieter second row for longer stories.
function spreadRows(photos: SeriesPhoto[], highlights = false) {
  if (photos.length <= 3) return [photos]
  if (highlights && photos.length > 6) return Array.from({length:Math.ceil(photos.length/3)},(_,i)=>photos.slice(i*3,i*3+3))
  const split = Math.ceil(photos.length / 2)
  return [photos.slice(0, split), photos.slice(split)]
}

export function SessionSeriesGallery({ series, onOpen, label, locale }: {
  label: string
  locale: "zh" | "en"
  series: PhotoSeries[]
  onOpen: (photo: SeriesPhoto, trigger: HTMLButtonElement) => void
}) {
  const root = useRef<HTMLElement>(null)
  const [ratios,setRatios] = useState<Record<string,number>>({})

  useEffect(() => {
    const node = root.current
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const articles = Array.from(node.querySelectorAll<HTMLElement>("[data-photo-series]"))
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        ;(entry.target as HTMLElement).dataset.reveal = "visible"
        observer.unobserve(entry.target)
      }
    }, { rootMargin: "0px 0px -24px 0px", threshold: .04 })
    for (const article of articles) {
      // A restored position should never flash or hide an already visible photo.
      if (article.getBoundingClientRect().top < window.innerHeight) continue
      article.dataset.reveal = "pending"
      observer.observe(article)
    }
    return () => {
      observer.disconnect()
      articles.forEach(article => { delete article.dataset.reveal })
    }
  }, [series])

  return <section ref={root} id="moments" className={styles.gallery} aria-label={label}>
    <div className={styles.inner}>
      {series.map(group => <article key={group.id} data-photo-series={group.id} className={styles.series}
        aria-labelledby={`series-${group.id}`}
        data-mobile-layout={group.id === "booking:appenzell" ? "landscapes" : ["booking:jianji-xinyi", "booking:lijiang"].includes(group.id) ? "story" : undefined}>
        <header className={styles.heading}>
          <h2 id={`series-${group.id}`}>{group.kind==="highlights" && locale==="zh" ? "人像精选" : group.title}</h2>
          <p>{group.place}</p>
        </header>
        <div className={styles.spread}>
          {spreadRows(group.photos,group.kind==="highlights").map((row, rowIndex) => <div key={rowIndex} data-photo-row data-count={row.length} className={styles.row}>
            {row.map((photo, index) => {
              const ratio = ratios[photo.id] || (photo.width || 3) / (photo.height || 2)
              return <figure key={photo.id} data-series-source={photo.sourceName} data-photo-index={group.photos.indexOf(photo)} data-portrait={ratio < 1} className={styles.figure}
                style={{"--photo-ratio": ratio, "--photo-weight": index === 0 ? 1.08 : index === 1 ? .94 : 1,
                  "--reveal-delay": `${index * 55 + rowIndex * 70}ms`} as CSSProperties}>
                <button type="button" onClick={event => onOpen(photo, event.currentTarget)} aria-label={photo.alt} className={styles.photo}>
                  <img src={photo.previewSrc || photo.src} srcSet={photo.previewSrcSet}
                    width={photo.width} height={photo.height} alt={photo.alt}
                    sizes={`${group.id.startsWith("booking:") && group.id !== "booking:hongjia-helsinki" ? "(max-width: 640px) 90vw" : row.length === 2 ? "(max-width: 640px) 86vw" : "(max-width: 640px) 44vw"}, ${row.length === 2 ? "(max-width: 1023px) 44vw, 700px" : "(max-width: 1023px) 30vw, 460px"}`}
                    loading="lazy" decoding="async" draggable={false} onLoad={({currentTarget}) => {
                      const ratio=currentTarget.naturalWidth/currentTarget.naturalHeight
                      if(Number.isFinite(ratio)&&ratio>0)setRatios(previous=>previous[photo.id]===ratio?previous:{...previous,[photo.id]:ratio})
                    }} onContextMenu={event => event.preventDefault()} />
                </button>
              </figure>
            })}
          </div>)}
        </div>
      </article>)}
    </div>
  </section>
}
