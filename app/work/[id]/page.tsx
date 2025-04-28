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

  // Map pictures to portfolio images with individual details
  const images = pictures.map((pic) => ({
    url: pic.image_url || "/placeholder.svg",
    rawUrl: pic.raw_image_url || pic.image_url, // Add the raw image URL
    alt: pic.title,
    title: pic.title,
    titleCn: pic.subtitle,
    description: pic.description,
  }))

  // Pass only the images array, details to be handled per image in the carousel
  // const item = { images

  return <PortfolioDetail images={images} />
}
