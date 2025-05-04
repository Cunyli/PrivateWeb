import { notFound } from "next/navigation"
import { PortfolioDetail } from "@/components/portfolio-detail"
import { supabase } from "@/utils/supabase"

export const revalidate = 0 // Disable caching for this route

export default async function WorkPage({ params }: { params: { id: string } }) {
  console.log(`Fetching pictures for set ID: ${params.id}`)

  // Fetch pictures based on picture_set_id
  const { data: pictures, error: pictureError } = await supabase
    .from("pictures")
    .select("*")
    .eq("picture_set_id", params.id)
    .order("order_index", { ascending: true })

  if (pictureError) {
    console.error("Error fetching pictures:", pictureError)
    notFound()
  }

  console.log(`Found ${pictures?.length || 0} pictures for set ID: ${params.id}`)

  if (!pictures || pictures.length === 0) {
    console.log("No pictures found, returning 404")
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

  // Fetch the picture set details
  const { data: pictureSet } = await supabase
    .from("picture_sets")
    .select("title, subtitle, description")
    .eq("id", params.id)
    .single()

  return (
    <PortfolioDetail
      images={images}
      title={pictureSet?.title}
      subtitle={pictureSet?.subtitle}
      description={pictureSet?.description}
    />
  )
}
