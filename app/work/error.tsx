"use client"

import { PortfolioStatus } from "@/components/portfolio-status"

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PortfolioStatus mode="error" retry={reset} />
}
