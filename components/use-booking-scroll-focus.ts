"use client"

import { useEffect } from "react"
import type { MutableRefObject, RefObject } from "react"

type FocusOptions = {
  itemAnchor?: number
  anchorSelector?: string
  follow?: "nearest" | "passed"
  visualSelector?: string
  visualAnchor?: number
  scroller?: RefObject<HTMLElement>
  manualFocus?: MutableRefObject<boolean>
}

// Read geometry only when the layout changes. Scroll frames compare cached,
// DOM-ordered anchors rather than the delivery order of intersection events.
export function useBookingScrollFocus<T extends HTMLElement>(
  sectionId: string,
  refs: RefObject<Array<T | null>>,
  setActive: (index: number) => void,
  locale: string,
  {itemAnchor=.5,anchorSelector,follow="nearest",visualSelector,visualAnchor=.4,scroller,manualFocus}: FocusOptions = {},
) {
  useEffect(()=>{
    const section=document.getElementById(sectionId)
    if(!section)return
    const list=scroller?.current
    const visual=visualSelector?section.querySelector<HTMLElement>(visualSelector):null
    let visible=false,disposed=false,frame=0,nested=false,focusOffset=0
    let anchors:Array<{index:number;top:number}>=[]
    const update=()=>{
      frame=0
      if(!visible || document.hidden || manualFocus?.current || !anchors.length)return
      const point=(nested?list!.scrollTop:window.scrollY)+focusOffset
      let nearest=anchors[0].index
      if(follow==="passed"){
        for(const anchor of anchors){if(anchor.top>point)break;nearest=anchor.index}
      }else{
        let distance=Infinity
        for(const anchor of anchors){
          const next=Math.abs(anchor.top-point)
          if(next<distance){nearest=anchor.index;distance=next}
        }
      }
      setActive(nearest)
    }
    const schedule=()=>{if(visible && !frame)frame=requestAnimationFrame(update)}
    const measure=()=>{
      const overflow=list?getComputedStyle(list).overflowY:""
      nested=!!list && (overflow==="auto" || overflow==="scroll")
      const origin=nested?list!.getBoundingClientRect().top-list!.scrollTop:-window.scrollY
      anchors=(refs.current || []).flatMap((node,index)=>{
        if(!node)return []
        const target=anchorSelector?node.querySelector<HTMLElement>(anchorSelector) || node:node
        const rect=target.getBoundingClientRect()
        return [{index,top:rect.top-origin+rect.height*itemAnchor}]
      })
      focusOffset=window.innerHeight*.46
      if(nested){
        // A long desktop list starts at its first visible card, not its middle.
        focusOffset=Math.min(anchors[0]?.top || 0,list!.clientHeight*.46)
      }else if(visual){
        const style=getComputedStyle(visual)
        if(style.position==="sticky" && visual.offsetWidth>section.clientWidth*.7){
          const bottom=(parseFloat(style.top)||0)+visual.offsetHeight
          focusOffset=bottom+Math.max(0,window.innerHeight-bottom)*visualAnchor
        }
      }
      schedule()
    }
    const observer=new IntersectionObserver(([entry])=>{
      visible=entry.isIntersecting
      if(visible)measure()
      else {cancelAnimationFrame(frame);frame=0}
    },{rootMargin:"100px"})
    const resize=new ResizeObserver(measure)
    observer.observe(section);resize.observe(section)
    if(list)resize.observe(list)
    if(visual)resize.observe(visual)
    measure()
    void document.fonts.ready.then(()=>{if(!disposed)measure()})
    window.addEventListener("scroll",schedule,{passive:true})
    window.addEventListener("resize",measure)
    list?.addEventListener("scroll",schedule,{passive:true})
    document.addEventListener("visibilitychange",schedule)
    return ()=>{
      disposed=true
      cancelAnimationFrame(frame);observer.disconnect();resize.disconnect()
      window.removeEventListener("scroll",schedule)
      window.removeEventListener("resize",measure)
      list?.removeEventListener("scroll",schedule)
      document.removeEventListener("visibilitychange",schedule)
    }
  },[sectionId,refs,setActive,locale,itemAnchor,anchorSelector,follow,visualSelector,visualAnchor,scroller,manualFocus])
}
