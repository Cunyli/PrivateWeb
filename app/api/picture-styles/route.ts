import { NextResponse } from "next/server"
import { getPhotographyStyles } from "@/lib/photography-styles.server"

export const runtime="nodejs"
export async function GET(request: Request){
  const params=new URL(request.url).searchParams
  try{
    const body=await getPhotographyStyles(params.get("style"),params.get("featured")==="1",Number(params.get("pictureId")||0))
    if(params.get("preview")==="1"){
      const styles=Object.fromEntries(Object.entries(body.styles).map(([key,value])=>{
        const style=value as {id:string;tagName:string;pictures:Array<{tags:string[];categories:string[];width?:number;height?:number}>}
        const masters=style.pictures.filter(p=>[...p.tags,...p.categories].some(t=>/master|大师/i.test(t)))
        const preferred=masters.filter(p=>p.width&&p.height&&p.width>=p.height)
        return [key,{...style,pictures:(preferred.length?preferred:masters).slice(0,8)}]
      }))
      return NextResponse.json({styles})
    }
    return NextResponse.json(body)
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Style collection unavailable"},{status:500})}
}
