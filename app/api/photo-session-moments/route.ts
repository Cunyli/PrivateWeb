import { NextResponse } from "next/server"
import { getPhotoCurationVisibility } from "@/lib/photo-curation.server"
import { bookingPortraitGroups, showcasePortraits } from "@/lib/photo-session-series"
import { curationFeatured } from "@/lib/photo-curation"
import { photoSource } from "@/lib/portfolio-photo-source"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const curation=await getPhotoCurationVisibility()
    const bucket=process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top"
    const groups=bookingPortraitGroups(curation,bucket)
    const photos=groups.flatMap(group=>group.photos)
    // The biography uses the photographer's own tag, never a different person as a substitute.
    const own=curation.keptPortraits.filter(photo=>(photo.tags || []).some(tag=>/^model:lijie$/i.test(tag)))
    const ownIds=new Set(own.map(photo=>`portrait-${photo.id}`))
    const aboutPhoto=photos.find(photo=>ownIds.has(photo.id)) || null
    const whyMePhotos=showcasePortraits(curation.keptPortraits,8).map(photo=>photos.find(candidate=>candidate.id===`portrait-${photo.id}`)).filter(Boolean)
    const cover=showcasePortraits(curation.keptPortraits,1)[0]
    return NextResponse.json({groups,aboutPhoto,whyMePhotos,moments:photos,
      cover:cover&&curationFeatured(curation,cover)?{id:`portrait-${cover.id}`,src:photoSource(cover.src,bucket,1280),alt:cover.title || "Portrait photograph"}:null})
  } catch (error) {
    console.error("Approved portrait catalog unavailable",error)
    return NextResponse.json({error:"Portraits are temporarily unavailable."},{status:503})
  }
}
