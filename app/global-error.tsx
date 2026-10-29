"use client"

import { useDocumentTitle } from "@/lib/use-document-title"
import { I18nProvider, useI18n } from "@/lib/i18n"

function ErrorContent({reset}:{reset:()=>void}){
  const {locale,setLocale}=useI18n()
  const zh=locale==="zh"
  useDocumentTitle(`${zh?"暂时无法载入":"Unable to load"} · Lijie Li`)
  return <html lang={zh?"zh-CN":"en"}><body style={{margin:0,fontFamily:"system-ui, sans-serif",background:"white",color:"#232724"}}>
    <button type="button" onClick={()=>setLocale(zh?"en":"zh")} aria-label={zh?"切换到英文":"Switch to Chinese"}
      style={{position:"absolute",top:20,right:20,minWidth:44,minHeight:44}}>{zh?"EN":"中"}</button>
    <main style={{display:"grid",minHeight:"100svh",placeItems:"center",padding:24}}><div style={{maxWidth:400,textAlign:"center"}}>
      <p>LIJIE LI</p><h1 style={{fontSize:26,fontWeight:500}}>{zh?"页面暂时无法打开。":"This page could not load."}</h1>
      <p>{zh?"请重新载入后再试。":"Please reload and try again."}</p>
      <button type="button" onClick={reset} style={{minHeight:44,padding:"8px 18px"}}>{zh?"重新载入":"Try again"}</button>
    </div></main>
  </body></html>
}

export default function GlobalError({reset}:{error:Error & {digest?:string};reset:()=>void}){
  return <I18nProvider><ErrorContent reset={reset}/></I18nProvider>
}
