import { PortfolioGrid } from "@/components/portfolio-grid"
import { fetchPortfolioInitialData } from "@/lib/portfolioInitialData.server"

export const revalidate = 60

export default async function Home() {
  const initialData = await fetchPortfolioInitialData()
  return (
    <main className="min-h-screen bg-white">
      <PortfolioGrid initialData={initialData || undefined} />
    </main>
  )
}
