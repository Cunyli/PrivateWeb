import { Suspense } from "react"
import { PortfolioGrid } from "@/components/portfolio-grid"
import { fetchPortfolioInitialData } from "@/lib/portfolioInitialData.server"

export const revalidate = 60

export default async function PortfolioPage() {
  const initialData = await fetchPortfolioInitialData()
  return (
    <main className="min-h-screen bg-[#f3f0e9]">
      <Suspense fallback={<div className="min-h-screen bg-[#f3f0e9]" />}>
        <PortfolioGrid initialData={initialData || undefined} />
      </Suspense>
    </main>
  )
}
