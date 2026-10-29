import { NextResponse } from "next/server"
import { getPhotoCurationVisibility } from "@/lib/photo-curation.server"
import { bookingPortraitGroups } from "@/lib/photo-session-series"
import { bookingPlacement } from "@/lib/booking-photo-presentation"
import { photoSource } from "@/lib/portfolio-photo-source"

export const runtime="nodejs"
export async function GET(){
  try{
    const curation=await getPhotoCurationVisibility()
    const bucket=process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top"
    const placement=bookingPlacement(curation)
    const groups=bookingPortraitGroups(curation,bucket,placement.gallery)
    return NextResponse.json({groups,moments:groups.flatMap(group=>group.photos),aboutPhoto:null,whyMePhotos:[],
      cover:placement.hero?{id:`portrait-${placement.hero.id}`,src:photoSource(placement.hero.src,bucket,1920,true),alt:placement.hero.title || "Portrait photograph"}:null})
  }catch(error){console.error("Approved portrait catalog unavailable",error);return NextResponse.json({error:"Portraits are temporarily unavailable."},{status:503})}
}
