import { EntryGate } from "@/components/entry-gate"

export const revalidate = 3600

export default function Home() {
  return <EntryGate />
}
