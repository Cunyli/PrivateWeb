import { notFound } from "next/navigation"
import { PortfolioDetail } from "@/components/portfolio-detail"
import { portfolioItems } from "@/data/portfolio"

export default function WorkPage({ params }: { params: { id: string } }) {
  const item = portfolioItems.find((item) => item.id === params.id)

  if (!item) {
    notFound()
  }

  return <PortfolioDetail item={item} />
}

