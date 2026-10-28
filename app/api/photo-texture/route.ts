import { NextResponse } from "next/server"
import { getPhotoCurationCatalog } from "@/lib/photo-curation.server"
import { photoSource } from "@/lib/portfolio-photo-source"

export const runtime="nodejs"
const MAX_BYTES=10*1024*1024
// Canvas textures need same-origin pixels. Accept an approved ID, never a client-supplied URL.
export async function GET(request:Request) {
  const params=new URL(request.url).searchParams
  const id=Number(params.get("pictureId")),width=Number(params.get("width") || 640)
  if(!Number.isSafeInteger(id)||id<1||![640,1280].includes(width))return new NextResponse(null,{status:400})
  const catalog=await getPhotoCurationCatalog()
  const photo=catalog.photos.find(photo=>photo.id===id&&!catalog.ids.includes(id))
  if(!photo)return new NextResponse(null,{status:404})
  const bucket=process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top"
  const source=new URL(photoSource(photo.src,bucket,width))
  if(source.protocol!=="https:"||source.origin!==new URL(bucket).origin)return new NextResponse(null,{status:404})
  const upstream=await fetch(source,{redirect:"error",signal:AbortSignal.timeout(15000),next:{revalidate:86400}})
  const type=upstream.headers.get("content-type")?.split(";")[0] || ""
  if(!upstream.ok||!["image/webp","image/jpeg","image/png","image/avif"].includes(type))return new NextResponse(null,{status:502})
  if(Number(upstream.headers.get("content-length"))>MAX_BYTES)return new NextResponse(null,{status:413})
  const bytes=await upstream.arrayBuffer()
  if(bytes.byteLength>MAX_BYTES)return new NextResponse(null,{status:413})
  const headers={"Content-Type":type,"Cache-Control":"public, max-age=0, must-revalidate","X-Content-Type-Options":"nosniff","Cross-Origin-Resource-Policy":"same-origin",...(upstream.headers.get("etag")?{ETag:upstream.headers.get("etag")!}:{})}
  if(headers.ETag&&request.headers.get("if-none-match")===headers.ETag)return new NextResponse(null,{status:304,headers})
  return new NextResponse(bytes,{headers})
}
