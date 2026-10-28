import type { Metadata } from "next"
import { PhotoCurationAdmin } from "@/components/photo-curation-admin"

export const metadata: Metadata = { title: "选片 · Lijie Li", robots: { index: false, follow: false } }
export default function PhotoCurationPage() { return <PhotoCurationAdmin /> }
