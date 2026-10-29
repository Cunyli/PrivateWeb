import { PortfolioStatus } from "@/components/portfolio-status"
import { ViewerPhotoPreload } from "@/components/viewer-photo-preload"
import { getPhotoCurationVisibility } from "@/lib/photo-curation.server"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { getPhotographyStyles } from "@/lib/photography-styles.server"
import PortfolioDetail from "@/components/portfolio-detail"
import { PHOTOGRAPHY_STYLE_BY_ID } from "@/lib/photography-styles"

export const revalidate = 0

type PictureTranslation = {
  title?: string | null
  subtitle?: string | null
  description?: string | null
}

type StylePicture = {
  id: number
  pictureSetId: number
  imageUrl: string
  displayUrl?: string | null
  rawImageUrl: string | null
  orderIndex: number | null
  createdAt: string
  tags: string[]
  categories: string[]
  set: {
    id: number
    title: string
    subtitle: string
    coverImageUrl: string | null
    translations: {
      en: PictureTranslation
      zh: PictureTranslation
    }
  }
  translations: {
    en: PictureTranslation
    zh: PictureTranslation
  }
}

const hashSeed = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return hash >>> 0
}

const shuffleWithSeed = <T,>(items: T[], seed: number) => {
  const next = [...items]
  let state = seed || 1
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const temp = next[i]
    next[i] = next[j]
    next[j] = temp
  }
  return next
}

export default async function StyleCollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ style: string }>
  searchParams?: Promise<{
    origin?: string
    pictureId?: string
    restore?: string
    returnSection?: string
  }>
}) {
  const { style: styleKey } = await params
  const resolvedSearchParams = await searchParams
  const styleConfig = PHOTOGRAPHY_STYLE_BY_ID[styleKey as keyof typeof PHOTOGRAPHY_STYLE_BY_ID]
  if (!styleConfig) {
    notFound()
  }

  const requestedPictureId=Number(resolvedSearchParams?.pictureId || 0)
  const curation=await getPhotoCurationVisibility()
  const data = await getPhotographyStyles(styleKey,false,Number.isSafeInteger(requestedPictureId)?requestedPictureId:0)
  const stylePayload = data?.styles?.[styleKey]
  const pictures = (stylePayload?.pictures || []) as StylePicture[]

  if (!pictures.length) {
    return <PortfolioStatus mode="empty" />
  }

  const dayKey = new Date().toISOString().slice(0, 10)
  const shuffledPictures = shuffleWithSeed(pictures, hashSeed(`${styleKey}-${dayKey}`))

  const images = shuffledPictures.filter(pic=>!curation.ids.includes(pic.id)).map((pic) => ({
    id:pic.id,
    url: pic.imageUrl || "/placeholder.svg",
    rawUrl: pic.rawImageUrl || pic.imageUrl,
    displayUrl:pic.displayUrl,
    setId: pic.pictureSetId,
    translations: {
      en: {
        title: pic.translations?.en?.title || "",
        subtitle: pic.translations?.en?.subtitle || "",
        description: pic.translations?.en?.description || "",
      },
      zh: {
        title: pic.translations?.zh?.title || "",
        subtitle: pic.translations?.zh?.subtitle || "",
        description: pic.translations?.zh?.description || "",
      },
    },
  }))

  const titleEn = styleConfig.labels?.en || styleConfig.tagName
  const titleZh = styleConfig.labels?.zh || styleConfig.tagName
  const translations = {
    en: { title: titleEn, subtitle: "", description: "" },
    zh: { title: titleZh, subtitle: "", description: "" },
  }

  const initialPictureId=images.some(image=>image.id===requestedPictureId)?requestedPictureId:images.find(image=>curation.featuredIds.includes(image.id))?.id
  const initialImage=images.find(image=>image.id===initialPictureId) || images[0]
  return (<>
    <ViewerPhotoPreload image={initialImage}/>
    <Suspense
      fallback={(
        <div className="min-h-screen bg-gradient-to-br from-white via-[#f8f6f1] to-[#eaf0ff]">
          <div className="h-screen animate-pulse">
            <div className="h-full w-full bg-gradient-to-br from-slate-200/70 via-slate-100 to-white" />
          </div>
        </div>
      )}
    >
      <PortfolioDetail
        id={`style-${styleKey}`}
        initialPictureId={initialPictureId}
        images={images}
        translations={translations}
        locations={[]}
        returnContext={{
          type: "portfolio",
          homePath: resolvedSearchParams?.origin === "home" ? "/" : "/portfolio",
          focusSection: resolvedSearchParams?.returnSection === "styles" ? "styles" : undefined,
          restore: resolvedSearchParams?.restore === "1" || resolvedSearchParams?.origin === "portfolio",
        }}
        viewSetContext={{ type: "style", styleKey }}
      />
    </Suspense></>
  )
}
