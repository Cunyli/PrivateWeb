import { Suspense } from "react"
import { EntryGate } from "@/components/entry-gate"
import { PortfolioGrid } from "@/components/portfolio-grid"
import { fetchPortfolioInitialData } from "@/lib/portfolioInitialData.server"
import styles from "@/components/portfolio-entry.module.css"

export const revalidate = 60

export default async function Home() {
  const initialData = await fetchPortfolioInitialData()
  return <main className={styles.page}>
    <EntryGate />
    <section id="works" className={styles.works} aria-label="Portfolio">
      <Suspense fallback={<div className={styles.worksLoading} />}><PortfolioGrid initialData={initialData || undefined} embedded /></Suspense>
    </section>
  </main>
}
