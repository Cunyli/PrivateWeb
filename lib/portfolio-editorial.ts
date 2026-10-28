import collectionData from "@/data/portfolio-editorial-collections.json"

export interface EditorialText {
  title: string
  subtitle: string
  description: string
}
export interface EditorialTranslations { en: EditorialText; zh: EditorialText }
export type EditorialIndex = Record<string, EditorialTranslations>
export type EditorialField = keyof EditorialText

const collections = collectionData.collections as EditorialIndex

export function collectionEditorial(id: number | string): EditorialTranslations | undefined {
  return collections[String(id)]
}

export function editorialMatches(index: EditorialIndex, terms: string[]): number[] {
  const needles = terms.map(term => term.normalize("NFKC").trim().toLowerCase()).filter(Boolean)
  if (!needles.length) return []
  return Object.entries(index).filter(([, entry]) => {
    const text = [...Object.values(entry.en), ...Object.values(entry.zh)].join(" ").normalize("NFKC").toLowerCase()
    return needles.some(term => text.includes(term))
  }).map(([id]) => Number(id)).filter(Number.isFinite)
}

export function matchingEditorialCollections(terms: string[]): number[] {
  return editorialMatches(collections, terms)
}

let photoCopy: Promise<EditorialIndex> | undefined
// The 420-photo text bank is loaded only for a search, never in the initial
// landing or gallery animation bundle. Viewers receive selected copy from SSR.
export function loadPhotoEditorial(): Promise<EditorialIndex> {
  return photoCopy ??= import("@/data/portfolio-editorial-photos.json")
    .then(module => module.default.photographs as EditorialIndex)
    .catch(error => { photoCopy = undefined; throw error })
}
