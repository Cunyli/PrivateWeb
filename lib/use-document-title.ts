"use client"

import { useEffect } from "react"

type TitleOwner={token:symbol;title:string}
const owners:TitleOwner[]=[]
let observer:MutationObserver|null=null

function synchronizeTitle(){
  const title=owners[owners.length-1]?.title
  if(title && document.title!==title)document.title=title
}

// App Router can stream its default metadata after hydration. Keep one shared
// observer and one active owner so nested loading views cannot fight each other.
export function useDocumentTitle(title:string){
  useEffect(()=>{
    const token=Symbol("page-title")
    owners.push({token,title})
    if(!observer){
      observer=new MutationObserver(synchronizeTitle)
      observer.observe(document.head,{childList:true,subtree:true,characterData:true})
    }
    synchronizeTitle()
    return ()=>{
      const index=owners.findIndex(owner=>owner.token===token)
      if(index>=0)owners.splice(index,1)
      if(!owners.length){observer?.disconnect();observer=null}
      else synchronizeTitle()
    }
  },[title])
}
