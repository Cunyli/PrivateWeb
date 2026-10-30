"use client"

import { useEffect } from "react"
import type { MutableRefObject, RefObject } from "react"

// Keep the compact map design. A pinned desktop stage follows document scroll;
// on phones the original map-above-cards layout follows each card instead.
export function useBookingMapTour(
  refs:RefObject<Array<HTMLElement|null>>,
  setActive:(index:number)=>void,
  locale:string,
  manual:MutableRefObject<boolean>,
){
  useEffect(()=>{
    const section=document.getElementById("locations")
    const stage=section?.querySelector<HTMLElement>("[data-map-tour-stage]")
    const origin=section?.querySelector<HTMLElement>("[data-map-tour-start]")
    const track=section?.querySelector<HTMLElement>("[data-map-tour-track]")
    const visual=section?.querySelector<HTMLElement>("[data-location-map]")
    if(!section || !stage || !origin || !track || !visual)return
    let visible=false,disposed=false,frame=0,pinned=false,start=0,distance=1,focus=0
    let anchors:Array<{index:number;top:number}>=[]
    const update=()=>{
      frame=0
      if(!visible || document.hidden || manual.current || !anchors.length)return
      let index=0
      if(pinned){
        const progress=Math.max(0,Math.min(1,(window.scrollY-start)/distance))
        index=Math.round(progress*(anchors.length-1))
      }else{
        const point=window.scrollY+focus
        let closest=Infinity
        for(const anchor of anchors){const delta=Math.abs(anchor.top-point);if(delta<closest){closest=delta;index=anchor.index}}
      }
      setActive(index)
    }
    const schedule=()=>{if(visible && !frame)frame=requestAnimationFrame(update)}
    const measure=()=>{
      pinned=getComputedStyle(stage).position==="sticky"
      section.dataset.mapTourMode=pinned?"progress":"cards"
      const top=parseFloat(getComputedStyle(stage).top)||0
      start=origin.getBoundingClientRect().top+window.scrollY-top
      const bottom=track.getBoundingClientRect().bottom+window.scrollY
      distance=Math.max(1,bottom-stage.offsetHeight-top-start)
      anchors=(refs.current || []).flatMap((node,index)=>{if(!node)return [];const r=node.getBoundingClientRect();return [{index,top:r.top+window.scrollY+r.height*.5}]})
      focus=window.innerHeight*.46
      const style=getComputedStyle(visual)
      if(style.position==="sticky" && visual.offsetWidth>section.clientWidth*.7){
        const lower=(parseFloat(style.top)||0)+visual.offsetHeight
        focus=lower+Math.max(0,window.innerHeight-lower)*.2
      }
      schedule()
    }
    const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)measure();else{cancelAnimationFrame(frame);frame=0}},{rootMargin:"100px"})
    const resize=new ResizeObserver(measure)
    intersection.observe(section)
    for(const element of [section,track,stage,visual])resize.observe(element)
    measure()
    void document.fonts.ready.then(()=>{if(!disposed)measure()})
    window.addEventListener("scroll",schedule,{passive:true})
    window.addEventListener("resize",measure)
    document.addEventListener("visibilitychange",schedule)
    return ()=>{disposed=true;cancelAnimationFrame(frame);intersection.disconnect();resize.disconnect();window.removeEventListener("scroll",schedule);window.removeEventListener("resize",measure);document.removeEventListener("visibilitychange",schedule);delete section.dataset.mapTourMode}
  },[refs,setActive,locale,manual])
}
