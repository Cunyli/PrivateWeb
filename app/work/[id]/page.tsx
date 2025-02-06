import { notFound } from "next/navigation"
import { PortfolioDetail } from "@/components/portfolio-detail"
import { supabase } from "@/utils/supabase"

export default async function WorkPage({ params }: { params: { id: string } }) {
  // Fetch pictures based on picture_set_id
  const { data: pictures, error: pictureError } = await supabase
    .from("pictures")
    .select("*")
    .eq("picture_set_id", params.id)
    .order("order_index", { ascending: true })

  if (pictureError || !pictures || pictures.length === 0) {
    notFound()
  }

  // Use the first picture for the main item details.
  const firstPicture = pictures[0]

  // Map pictures to portfolio images
  const images = pictures.map((pic) => ({
    url: pic.image_url || "/placeholder.svg",
    alt: pic.title,
  }))

  const item = {
    title: firstPicture.title,
    titleCn: firstPicture.subtitle,
    description: firstPicture.description,
    images,
  }

  return <PortfolioDetail item={item} />
}

