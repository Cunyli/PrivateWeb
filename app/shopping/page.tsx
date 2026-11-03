import type { Metadata } from "next"
import { ShoppingWatch } from "@/components/shopping-watch"

export const metadata: Metadata = {
  title: "黑五采购 · Lijie",
  description: "芬兰家具、家电与户外装备采购清单和价格观察。",
  robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"
export default function ShoppingPage() { return <ShoppingWatch /> }
