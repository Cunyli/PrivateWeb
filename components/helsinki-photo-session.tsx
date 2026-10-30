"use client"

import { useDocumentTitle } from "@/lib/use-document-title"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, FormEvent, ImgHTMLAttributes, MouseEvent } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import type { CarouselImage } from "./carousel"
import viewerStyles from "./editorial-pages.module.css"
import sessionStyles from "./photo-session.module.css"
import introStyles from "./photo-story.module.css"
import { sessionImageVariants, sessionViewerSource } from "@/lib/session-image-variants"
import { usePhotoCuration } from "./photo-curation-provider"
import { portfolioEntryPhotos } from "@/lib/portfolio-entry-preview"
import { bookingPlacement, sessionPhotoSources, portraitTitle } from "@/lib/booking-photo-presentation"
import { curationAssetFamily, curationFeatured } from "@/lib/photo-curation"
import { photoSource } from "@/lib/portfolio-photo-source"
import { bookingPortraitGroups } from "@/lib/photo-session-series"
import type { SessionPhoto as Photo } from "@/lib/photo-session-series"
import { SessionSeriesGallery } from "./session-series-gallery"
import "leaflet/dist/leaflet.css"
import {
  ArrowDown,
  ArrowRight,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { bindMapWheelGestures } from "@/lib/map-wheel-gestures"
import { useBookingScrollFocus } from "./use-booking-scroll-focus"

type Locale = "zh" | "en"


type Location = {
  id: string
  name: string
  place: string
  mood: string
  bestTime: string
  lat: number
  lng: number
  href: string
}





const LazyCarousel = dynamic(() => import("./carousel").then(module => module.Carousel), { ssr: false })

const xhsHref = "https://xhslink.com/m/7aNml9q2AjQ"

const photoSessionCopy = {
  zh: {
    languageButton: "EN",
    languageLabel: "切换到英文",
    momentTypeCouple: "情侣拍摄",
    hero: { title: "我的约拍", portfolio: "摄影集" },
    about: {
      eyebrow: "",
      title: "我是 Lijie。",
      body: "",
      highlightLines: ["住在赫尔辛基。\n欧洲、亚洲也可以约。", "我会引导动作，\n你按自己的节奏来。", "中文、英语、粤语，\n都可以。"],
    },
    process: {
      eyebrow: "为什么是我",
      title: "和我拍照。",
      steps: [
        { title: "路线一起定", body: "你选地方，或交给我安排。" },
        { title: "动作我来带", body: "走路、坐下、看向别处，都可以。" },
        { title: "设备都好商量", body: "数码、胶片、CCD、拍立得，可以提前聊。" },
        { title: "我住在这里", body: "在赫尔辛基生活两年，也是在校学生。" },
        { title: "按你的节奏来", body: "我会耐心引导，也能帮你照看包和器材。" },
        { title: "边拍边逛", body: "顺路喝杯咖啡、吃点东西也好。" },
        { title: "提前说清楚", body: "价格、交付和取消条件，拍之前确认。" },
        { title: "不止赫尔辛基", body: "欧洲、亚洲可约；路费和住宿另计。" },
      ],
    },
    options: {
      typesTitle: "拍摄类型",
      serviceTypes: ["旅拍 / 游客照", "情侣拍照", "家庭拍照", "宠物照片", "毕业写真", "校园写真"],
    },
    locations: {
      eyebrow: "拍摄路线",
      title: "赫尔辛基",
      body: "路线按天气和你的计划调整。",
      points: [
        { name: "赫尔辛基主教座堂", place: "白教堂 / 参议院广场", bestTime: "下午侧光" },
        { name: "赫尔辛基集市广场", place: "码头 / 集市广场", bestTime: "16:00 后" },
        { name: "Robert’s Coffee Jugend", place: "咖啡店 / 尤根厅", bestTime: "阴天也稳" },
        { name: "阿曼达喷泉", place: "喷泉 / 滨海大道公园", bestTime: "下午或傍晚" },
        { name: "阿尔托大学", place: "奥塔涅米 / 阿尔托大学", bestTime: "下午或课后" },
        { name: "芬兰堡", place: "芬兰堡 / 海上要塞", bestTime: "日落前" },
      ],
    },
    pricing: {
      eyebrow: "价格",
      title: "约拍",
      note: "具体价格按人数、路线和交付要求确认。",
      packages: [
        { name: "单人", price: "EUR 99", note: "2 小时" },
        { name: "双人 / 情侣", price: "EUR 139", note: "2 小时" },
        { name: "三人", price: "EUR 169", note: "2 小时" },
        { name: "四人及以上", price: "另议", note: "按人数和路线确认" },
      ],
    },
    delivery: {
      eyebrow: "交付与规则",
      title: "交付与费用",
      includedTitle: "交付包含",
      boundaryTitle: "费用与边界",
      includedItems: ["拍摄前路线和风格沟通", "2 小时拍摄与动作引导", "筛选后 JPG 底片", "9 张精修", "9 张精修图对应 RAW 文件"],
      boundaryItems: ["续时 EUR 40 / 小时；额外精修 EUR 2 / 张", "下雪或小雨如确认继续拍摄，加 EUR 5 / 小时", "旅拍、远距离地点、门票和交通费需实报实销", "精心二次后期后仍不满意，可以要求退款", "妆发需自理；未经同意不会公开发布照片"],
    },
    contact: {
      eyebrow: "预约",
      title: "告诉我日期和人数。",
      processItems: ["私信沟通并选定套餐", "约定时间和地点，拍摄当天提前会合", "拍完后五天以内返回照片；加钱可加急"],
      xhsTitle: "小红书",
      xhsBody: "",
      xhsAction: "打开私信",
      emailTitle: "邮件预约",
      emailBody: "",
      emailAction: "填写信息",
    },
    form: {
      eyebrow: "邮件预约",
      title: "填写预约信息",
      packagePrefix: "当前套餐",
      close: "关闭",
      name: "怎么称呼",
      namePlaceholder: "你的名字",
      date: "预计日期 / 时间",
      datePlaceholder: "例如：7 月某个周末 / 8 月初下午",
      contact: "联系方式",
      contactPlaceholder: "微信 / 小红书 / 邮箱 / 电话",
      people: "人数",
      peoplePlaceholder: "例如：1 人 / 情侣 / 家庭",
      style: "想拍什么",
      stylePlaceholder: "游客照 / 自然街拍 / 写真感",
      note: "其他信息",
      notePlaceholder: "想去的地点、设备、服装、是否旅拍等",
      summaryTitle: "将发送",
      dateFallback: "预计日期待填写",
      timeFallback: "具体时间再沟通",
      timeWindow: "待沟通",
      timeWindowNote: "页面未预设时间段",
      sending: "发送中",
      submit: "发送预约信息",
      sentMessage: "预约信息已发送。",
      loggedMessage: "预约信息已记录。也可以通过小红书联系我。",
      errorMessage: "发送失败，请稍后再试。",
    },
    faq: {
      eyebrow: "常见问题",
      title: "预约须知",
      items: [
        { question: "提前多久约？", answer: "建议提前一周；旺季或固定旅行日期提前四周，求婚和惊喜拍摄提前两周。临时约也可以问。" },
        { question: "拍视频吗？", answer: "目前只接照片拍摄。" },
        { question: "多久收到照片？", answer: "通常五天以内；加急另计。拍摄当天请提前 10 分钟到集合点。" },
        { question: "天气不好怎么办？", answer: "阴天照常拍。下雪或小雨如确认继续拍摄，加 EUR 5 / 小时；恶劣天气免费改期或取消。" },
        { question: "付款和取消", answer: "50% 订金确认档期。拍摄前 24 小时外取消可退，24 小时内不退。支持微信、支付宝、Revolut、MobilePay。" },
        { question: "迟到了怎么办？", answer: "拍摄从约定时间开始计时，不从实际到达时间重新计算。" },
        { question: "穿什么？", answer: "建议提前看颜色和层次，风大的时候带件外套或围巾。不确定可以把衣服发给我。" },
        { question: "照片会公开吗？", answer: "未经你同意，不会发布在网站、小红书或其他公开平台。" },
      ],
    },
    footer: { notice: "图片未经许可，不得使用、复制、下载、转载，或用于训练及商业用途。", top: "回到顶部" },
  },
  en: {
    languageButton: "中",
    languageLabel: "Switch to Chinese",
    momentTypeCouple: "Couple session",
    hero: { title: "Your portrait.", portfolio: "Portfolio" },
    about: {
      eyebrow: "",
      title: "I'm Lijie.",
      body: "",
      highlightLines: ["Based in Helsinki.\nAvailable in Europe and Asia.", "I’ll guide you\nas we go.", "Mandarin, English\nand Cantonese."],
    },
    process: {
      eyebrow: "Why me",
      title: "With me.",
      steps: [
        { title: "A route together", body: "Bring a place in mind, or let me plan the walk." },
        { title: "I’ll guide you", body: "Walk, sit, look away. We’ll try things as we go." },
        { title: "Your camera, too", body: "Digital, film, CCD or instant — ask me beforehand." },
        { title: "At home here", body: "Two years living in Helsinki, and a student here." },
        { title: "At your pace", body: "Patient guidance, and a hand with bags and gear." },
        { title: "A stop along the way", body: "Coffee or a bite to eat can be part of the walk." },
        { title: "Agreed beforehand", body: "Price, delivery and cancellation, before we shoot." },
        { title: "Further afield", body: "Europe and Asia, with travel and accommodation covered." },
      ],
    },
    options: {
      typesTitle: "The shoot",
      serviceTypes: ["Travel photos", "Couple photos", "Family photos", "Pet photos", "Graduation portraits", "Campus portraits"],
    },
    locations: {
      eyebrow: "Routes",
      title: "Helsinki",
      body: "A starting route. We can change it.",
      points: [
        { name: "Helsinki Cathedral", place: "Helsinki Cathedral / Senate Square", bestTime: "Afternoon side light" },
        { name: "Market Square", place: "Market Square / Harbor", bestTime: "After 16:00" },
        { name: "Robert’s Coffee Jugend", place: "Robert's Coffee Jugend / Indoor backup", bestTime: "Reliable on cloudy days" },
        { name: "Havis Amanda", place: "Havis Amanda / Esplanadi edge", bestTime: "Afternoon or evening" },
        { name: "Aalto University", place: "Otaniemi / Aalto University", bestTime: "Afternoon or after class" },
        { name: "Suomenlinna", place: "Suomenlinna / Sea fortress", bestTime: "Before sunset" },
      ],
    },
    pricing: {
      eyebrow: "Pricing",
      title: "Book a session.",
      note: "The final quote depends on the group, route and delivery.",
      packages: [
        { name: "Solo", price: "EUR 99", note: "2 hours" },
        { name: "Two people / couple", price: "EUR 139", note: "2 hours" },
        { name: "Three people", price: "EUR 169", note: "2 hours" },
        { name: "Four or more", price: "Custom", note: "Confirmed by group and route" },
      ],
    },
    delivery: {
      eyebrow: "Delivery / rules",
      title: "Delivery & fees",
      includedTitle: "Included",
      boundaryTitle: "Fees and boundaries",
      includedItems: ["Pre-shoot route and style discussion", "2-hour shoot with posing guidance", "Selected JPG originals", "9 retouched photos", "RAW files for the 9 retouched photos"],
      boundaryItems: ["Extra time EUR 40 / hour; extra retouching EUR 2 / photo", "If we confirm shooting in snow or light rain, add EUR 5 / hour", "Travel sessions, distant locations, tickets, and transport are reimbursed at actual cost", "If you are still unhappy after careful second-round editing, you can request a refund", "Makeup and hair are self-arranged; photos will not be published without consent"],
    },
    contact: {
      eyebrow: "Booking",
      title: "A date. A few details.",
      processItems: ["Message me and choose a package", "Agree on time and meeting point, then meet before the shoot", "Photos are delivered within about five days; rush delivery is available for an extra fee"],
      xhsTitle: "Xiaohongshu",
      xhsBody: "",
      xhsAction: "Open message",
      emailTitle: "Email me",
      emailBody: "",
      emailAction: "Fill form",
    },
    form: {
      eyebrow: "Email booking",
      title: "Fill booking details",
      packagePrefix: "Selected package",
      close: "Close",
      name: "Name",
      namePlaceholder: "Your name",
      date: "Expected date / time",
      datePlaceholder: "For example: a weekend in July / early August afternoon",
      contact: "Contact",
      contactPlaceholder: "WeChat / Xiaohongshu / email / phone",
      people: "People",
      peoplePlaceholder: "For example: solo / couple / family",
      style: "What do you want to shoot",
      stylePlaceholder: "Travel photos / natural street portraits / editorial portraits",
      note: "Other details",
      notePlaceholder: "Places, gear, clothes, travel-session plans, and anything else",
      summaryTitle: "Will send",
      dateFallback: "Date to be filled",
      timeFallback: "Exact time to discuss",
      timeWindow: "To discuss",
      timeWindowNote: "No preset time window on page",
      sending: "Sending",
      submit: "Send booking request",
      sentMessage: "Your booking request has been sent.",
      loggedMessage: "Your request is saved. You can also reach me on Xiaohongshu.",
      errorMessage: "Sending failed. Please try again later.",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Before booking",
      items: [
        {
          question: "How far ahead?",
          answer: "Ideally one week; four weeks for busy seasons or fixed travel dates, and two for proposals or surprises. You can also ask about last-minute availability.",
        },
        { question: "Do you shoot video?", answer: "Photography only for now." },
        { question: "When do I get the photos?", answer: "Usually within five days. Rush delivery costs extra. Please arrive 10 minutes before the shoot." },
        {
          question: "What about the weather?",
          answer: "Cloudy days are fine. If we agree to shoot in snow or light rain, add EUR 5 / hour. Severe weather means a free reschedule or cancellation.",
        },
        {
          question: "Payment & cancellation",
          answer: "A 50% deposit holds the date. It is refundable more than 24 hours before the shoot, and non-refundable within 24 hours. WeChat, Alipay, Revolut and MobilePay are accepted.",
        },
        { question: "What if I’m late?", answer: "The session starts at the agreed time, rather than your arrival time." },
        { question: "What should I wear?", answer: "Think about colours and layers. Bring a coat or scarf for windy days. Send me options if you’d like a second opinion." },
        { question: "Will you publish my photos?", answer: "Only with your permission — on this site, Xiaohongshu or anywhere else." },
      ],
    },
    footer: { notice: "Images may not be used, copied, downloaded, reposted, used for training or used commercially without permission.", top: "Back to top" },
  },
} as const


function SessionImage({ className = "", preview = false, fullResolution=false, sizes, src, srcSet, ...props }: ImgHTMLAttributes<HTMLImageElement> & {preview?: boolean;fullResolution?: boolean}) {
  const curation=usePhotoCuration()
  if(!curationFeatured(curation,{src:typeof src==="string"?src:""}))return null
  const source=typeof src==="string"?src:""
  const local=sessionImageVariants[source]
  const photo=curation.keptPortraits.find(p=>curationAssetFamily(p.src)===curationAssetFamily(source))
  const responsive=photo?sessionPhotoSources({id:photo.id,src:source},process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top"):null
  return <img loading="lazy" decoding="async" {...props} src={fullResolution?source:local?.src || responsive?.src || source}
    srcSet={fullResolution?undefined:srcSet || local?.srcSet || responsive?.srcSet}
    sizes={fullResolution?undefined:sizes || "(max-width: 767px) 92vw, 720px"}
    draggable={false} onContextMenu={event=>event.preventDefault()} className={`${className} select-none`} />
}


const highlightLines = [
  "Base赫尔辛基，但拍摄不只限芬兰，全欧可飞",
  "我是一个有趣的人，我的责任是给你带来快乐和美丽的照片",
  "情绪稳定，懂得引导，会给情绪价值",
]

const locations: Location[] = [
  {
    id: "cathedral",
    name: "Helsingin tuomiokirkko",
    place: "白教堂 / Senate Square",
    mood: "干净、明亮、赫尔辛基标志感",
    bestTime: "下午侧光",
    lat: 60.17045,
    lng: 24.95223,
    href: "https://www.openstreetmap.org/search?query=Helsingin%20tuomiokirkko",
  },
  {
    id: "kauppatori",
    name: "Kauppatori",
    place: "码头 / Market Square",
    mood: "海风、码头、旅行感",
    bestTime: "16:00 后",
    lat: 60.16748,
    lng: 24.95532,
    href: "https://www.openstreetmap.org/search?query=Kauppatori%20Helsinki",
  },
  {
    id: "roberts",
    name: "Robert's Coffee Jugend",
    place: "咖啡店 / Jugend hall",
    mood: "室内、复古、雨天备用",
    bestTime: "阴天也稳",
    lat: 60.16708,
    lng: 24.9481,
    href: "https://www.openstreetmap.org/search?query=Robert%27s%20Coffee%20Jugend%20Helsinki",
  },
  {
    id: "havis",
    name: "Havis Amanda",
    place: "喷泉 / Esplanadi edge",
    mood: "广场、喷泉、路口感",
    bestTime: "下午或傍晚",
    lat: 60.16712,
    lng: 24.95139,
    href: "https://www.openstreetmap.org/search?query=Havis%20Amanda%20Helsinki",
  },
  {
    id: "aalto",
    name: "Aalto",
    place: "Otaniemi / Aalto University",
    mood: "校园写真、毕业记录、学生日常",
    bestTime: "下午或课后",
    lat: 60.18416,
    lng: 24.83013,
    href: "https://www.openstreetmap.org/search?query=Aalto%20University%20Otaniemi",
  },
  {
    id: "suomenlinna",
    name: "Suomenlinna",
    place: "芬兰堡 / sea fortress",
    mood: "岛、海边、风很大的旅行感",
    bestTime: "日落前",
    lat: 60.14499,
    lng: 24.98757,
    href: "https://www.openstreetmap.org/search?query=Suomenlinna",
  },
]


function ScrollPhoto({ photos, activePhoto, about = false, onOpen }: {
  photos: Photo[]
  activePhoto: Photo
  about?: boolean
  onOpen: (photo: Photo) => void
}) {
  const frameRef=useRef<HTMLButtonElement>(null)
  const requested=useRef(activePhoto.src)
  requested.current=activePhoto.src
  const [presentation,setPresentation]=useState<{current:string;previous:string|null}>({current:activePhoto.src,previous:null})
  const [ratios,setRatios]=useState<Record<string,number>>({})
  const showPhoto=(src:string)=>setPresentation(previous=>previous.current===src?previous:{current:src,previous:previous.current})
  useEffect(()=>{
    const image=Array.from(frameRef.current?.querySelectorAll<HTMLImageElement>("img") || []).find(image=>image.dataset.processSource===activePhoto.src)
    if(image?.complete && image.naturalWidth>0)showPhoto(activePhoto.src)
  },[activePhoto.src,photos])
  const presented=photos.find(photo=>photo.src===presentation.current) || activePhoto
  const index=photos.findIndex(photo=>photo.src===activePhoto.src)
  // Keep the departing frame, requested frame and next frame. A fast jump
  // retains the visible photo until the requested resource has loaded.
  const sources=new Set([presented.src,presentation.previous,activePhoto.src,photos[index+1]?.src])
  const ratio=ratios[presented.src] || (presented.width && presented.height ? presented.width/presented.height : 1.5)
  return <div className={about ? sessionStyles.aboutVisual : sessionStyles.processVisual}>
    <button ref={frameRef} type="button" className={sessionStyles.naturalFrame} style={{"--frame-ratio":ratio} as CSSProperties}
      onClick={()=>onOpen(presented)} aria-label={presented.alt}>
      {photos.filter(photo=>sources.has(photo.src)).map(photo=><SessionImage key={photo.src} src={photo.src} alt={photo.src===presented.src?photo.alt:""}
        width={photo.width} height={photo.height} loading="eager" fetchPriority={photo.src===activePhoto.src?"auto":"low"} data-process-source={photo.src} aria-hidden={photo.src!==presented.src}
        className={sessionStyles.naturalPhoto} data-active={photo.src===presented.src}
        onLoad={({currentTarget})=>{
          const next=currentTarget.naturalWidth/currentTarget.naturalHeight
          if(Number.isFinite(next)&&next>0)setRatios(previous=>previous[photo.src]===next?previous:{...previous,[photo.src]:next})
          if(requested.current===photo.src)showPhoto(photo.src)
        }} />)}
    </button>
  </div>
}

function PhotographerIntro({ photos, title, body, lines, eyebrow, locale, onOpen }: {
  photos: Photo[]
  title: string
  body: string
  lines: readonly string[]
  eyebrow: string
  locale: Locale
  onOpen: (photo: Photo) => void
}) {
  const root = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [photoRatios, setPhotoRatios] = useState<Record<string, number>>({})

  useEffect(() => {
    const section=root.current,sticky=stage.current,windowElement=viewport.current,strip=track.current
    if(!section || !sticky || !windowElement || !strip)return
    const motion=window.matchMedia("(prefers-reduced-motion: reduce)")
    const portrait=window.matchMedia("(max-width:767px) and (orientation:portrait)")
    const native=CSS.supports("animation-timeline","view()") && CSS.supports("animation-range","contain 0% contain 100%")
    let visible=false,frame=0,start=0,distance=1,travel=0,lastWidth=0
    // Older browsers use one transform write at the display's own rAF cadence.
    // Native scroll timelines avoid a JavaScript animation loop entirely.
    const update=()=>{
      frame=0
      if(!visible || motion.matches || portrait.matches || document.hidden)return
      const progress=Math.max(0,Math.min(1,(window.scrollY-start)/distance))
      strip.style.transform=`translate3d(${-travel*progress}px,0,0)`
    }
    const schedule=()=>{if(!native && visible && !motion.matches && !portrait.matches && !document.hidden && !frame)frame=requestAnimationFrame(update)}
    const measure=()=>{
      start=section.getBoundingClientRect().top+window.scrollY
      distance=Math.max(1,section.offsetHeight-sticky.offsetHeight)
      const width=windowElement.clientWidth
      if(width!==lastWidth){strip.style.setProperty("--spread-width",`${width}px`);lastWidth=width}
      travel=Math.max(0,strip.scrollWidth-width)
      strip.style.setProperty("--intro-travel",`${-travel}px`)
      schedule()
    }
    const configure=()=>{
      if(motion.matches || portrait.matches){
        delete section.dataset.storyEnhanced
        delete section.dataset.storyMotion
        strip.style.removeProperty("transform")
        cancelAnimationFrame(frame);frame=0
      }else{
        section.dataset.storyEnhanced="true"
        section.dataset.storyMotion=native?"native":"script"
        if(native)strip.style.removeProperty("transform")
      }
      measure()
    }
    const visibility=new IntersectionObserver(entries=>{
      visible=entries[0].isIntersecting
      section.dataset.storyActive=String(visible)
      if(visible)measure()
      else {cancelAnimationFrame(frame);frame=0}
    },{rootMargin:"100px"})
    const resize=new ResizeObserver(measure)
    configure();visibility.observe(section)
    resize.observe(sticky);resize.observe(windowElement);resize.observe(strip)
    if(!native)window.addEventListener("scroll",schedule,{passive:true})
    window.addEventListener("resize",measure)
    document.addEventListener("visibilitychange",schedule)
    motion.addEventListener("change",configure)
    portrait.addEventListener("change",configure)
    return ()=>{
      cancelAnimationFrame(frame);visibility.disconnect();resize.disconnect()
      window.removeEventListener("scroll",schedule);window.removeEventListener("resize",measure)
      document.removeEventListener("visibilitychange",schedule);motion.removeEventListener("change",configure);portrait.removeEventListener("change",configure)
    }
  },[photos,lines,locale])

  const focusSpread = (index: number, button: HTMLButtonElement) => {
    if (!button.matches(":focus-visible") || !root.current?.dataset.storyEnhanced || !viewport.current || !track.current || !stage.current) return
    const panel = track.current.children[index] as HTMLElement
    const travel = track.current.scrollWidth - viewport.current.clientWidth
    const progress = travel > 0 ? Math.min(1, panel.offsetLeft / travel) : 0
    const start = root.current.getBoundingClientRect().top + window.scrollY
    const distance = root.current.offsetHeight - stage.current.offsetHeight
    window.scrollTo({ top: start + progress * distance, behavior: "instant" })
  }

  return <section id="story" ref={root} data-text-only={photos.length===0 || undefined} className={introStyles.story} aria-labelledby="photographer-intro-heading">
    <div ref={stage} className={introStyles.stage}>
      <header className={introStyles.heading}>
        <div>{eyebrow && <p className={introStyles.eyebrow}>{eyebrow}</p>}<h2 id="photographer-intro-heading">{title}</h2></div>
        {body && <p className={introStyles.body}>{body}</p>}
      </header>
      <div ref={viewport} className={introStyles.viewport}>
        <div ref={track} className={introStyles.track}>
          {lines.map((line, index) => {
            const photo = photos[index] || null
            return <figure key={index} className={introStyles.spread} data-personal-spread>
              {photo&&<button type="button" className={introStyles.photograph} style={{ "--intro-ratio": photoRatios[photo.src] || (photo.width && photo.height ? photo.width/photo.height : 1.5) } as CSSProperties} data-intro-photo onClick={() => onOpen(photo)} onFocus={event => focusSpread(index, event.currentTarget)} aria-label={photo.alt}>
                <SessionImage src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="eager" fetchPriority="low" onLoad={({ currentTarget }) => {
                  const ratio = currentTarget.naturalWidth / currentTarget.naturalHeight
                  if (Number.isFinite(ratio) && ratio > 0) setPhotoRatios(previous => previous[photo.src] === ratio ? previous : { ...previous, [photo.src]: ratio })
                }} />
              </button>}
              <figcaption><p>{line}</p></figcaption>
            </figure>
          })}
        </div>
      </div>
    </div>
  </section>
}


function WhyMeSection({ copy, photos, locale, onOpen }: {
  copy: (typeof photoSessionCopy)[Locale]
  photos: Photo[]
  locale: Locale
  onOpen: (photo: Photo) => void
}) {
  const [activeStepIndex,setActiveStepIndex] = useState(0)
  const stepRefs = useRef<Array<HTMLElement | null>>([])
  useBookingScrollFocus("process",stepRefs,setActiveStepIndex,locale,{itemAnchor:0,anchorSelector:"h3",follow:"passed",visualSelector:"[data-process-visual]",visualAnchor:.4})
  const displayShootSteps = copy.process.steps
  const activeShootPhoto = photos.length ? photos[Math.min(photos.length-1,Math.floor(activeStepIndex*photos.length/displayShootSteps.length))] : null
  return (
      <section id="process" className={sessionStyles.processSection}>
        <div className="mx-auto max-w-7xl">
          <div className={`grid gap-10 ${sessionStyles.processLayout} ${activeShootPhoto ? "lg:grid-cols-[0.46fr_0.54fr]" : "mx-auto max-w-4xl"}`}>
            <div className={sessionStyles.processCopy}>
              <div className={sessionStyles.processHeading}>
                <h2 className={sessionStyles.processTitle}>
                  {copy.process.title}
                </h2>
              </div>

              <div className={`relative pb-[10svh] pt-4 ${sessionStyles.processSteps}`}>
                {displayShootSteps.map((step, index) => (
                  <article
                    key={step.title}
                    ref={(node) => {
                      stepRefs.current[index] = node
                    }}
                    data-step-index={index}
                    aria-current={activeStepIndex===index?"step":undefined}
                    className={sessionStyles.processStep}
                  >
                    <div>
                      <h3>
                        {step.title}
                      </h3>
                      <p>
                        {step.body}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

          {activeShootPhoto&&<div data-process-visual className={`lg:sticky lg:top-16 lg:h-[calc(100svh-8rem)] flex items-center justify-center ${sessionStyles.processPhotos}`}>
            <ScrollPhoto photos={photos} activePhoto={activeShootPhoto} onOpen={onOpen} />
          </div>}
          </div>
        </div>
      </section>

  )
}

function BookingQuestions({ copy }: {copy: (typeof photoSessionCopy)[Locale]["faq"]}) {
  return <details id="faq" className={sessionStyles.disclosure}>
    <summary><span>{copy.title}</span><span className={sessionStyles.questionToggle} aria-hidden="true" /></summary>
    <div className={sessionStyles.questionColumns}>
      {copy.items.map((item,index) => <details key={index} className={sessionStyles.question} data-booking-question={index}>
        <summary><span>{item.question}</span><span className={sessionStyles.questionToggle} aria-hidden="true" /></summary>
        <p>{item.answer}</p>
      </details>)}
    </div>
  </details>
}


export function HelsinkiPhotoSession() {
  const router = useRouter()
  const curation = usePhotoCuration()
  const { locale, setLocale } = useI18n()
  const pageLocale: Locale = locale === "en" ? "en" : "zh"
  const copy = photoSessionCopy[pageLocale]
  useDocumentTitle(`${pageLocale==="zh"?"人像约拍":"Photo sessions"} · Lijie Li`)
  const [isEntering, setIsEntering] = useState(true)
  const [isLeaving, setIsLeaving] = useState(false)
  const [activeLocationId, setActiveLocationId] = useState(locations[0].id)
  const [selectedPackageIndex, setSelectedPackageIndex] = useState(0)
  const [isEmailFormOpen, setIsEmailFormOpen] = useState(false)
  const [bookingForm, setBookingForm] = useState({
    name: "",
    contact: "",
    date: "",
    people: "",
    style: "",
    note: "",
  })
  const [bookingStatus, setBookingStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [bookingMessageKey,setBookingMessageKey]=useState<"sentMessage"|"loggedMessage"|"errorMessage"|null>(null)
  const bookingMessage=bookingMessageKey?copy.form[bookingMessageKey]:""
  const [mapReady, setMapReady] = useState(false)
  const [mapNear, setMapNear] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [presentedIndex, setPresentedIndex] = useState(0)
  const locationRefs = useRef<Array<HTMLElement | null>>([])
  const mapRootRef = useRef<HTMLDivElement | null>(null)
  const bookingTriggerRef = useRef<HTMLButtonElement | null>(null)
  const photoTriggerRef = useRef<HTMLButtonElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const locationMarkersRef=useRef<Record<string,any>>({})
  const lastMapFocusRef=useRef<string|null>(null)
  const manualMapFocusRef=useRef(false)
  const focusScrolledLocation=useCallback((index:number)=>{
    const location=locations[index]
    if(location)setActiveLocationId(location.id)
  },[])
  useBookingScrollFocus("locations",locationRefs,focusScrolledLocation,locale,{visualSelector:"[data-location-map]",visualAnchor:.2,manualFocus:manualMapFocusRef})
  const focusMapLocation=useCallback((id:string)=>{
    manualMapFocusRef.current=true
    setActiveLocationId(id)
    const map=mapRef.current,location=locations.find(item=>item.id===id)
    if(map && location && lastMapFocusRef.current===id){
      map.stop()
      map.flyTo([location.lat,location.lng],Math.max(map.getZoom(),13),{animate:!window.matchMedia("(prefers-reduced-motion: reduce)").matches,duration:.32})
    }
  },[])
  const displayLocations = useMemo(
    () =>
      locations.map((location, index) => ({
        ...location,
        name: copy.locations.points[index]?.name || location.name,
        place: copy.locations.points[index]?.place || location.place,
        bestTime: copy.locations.points[index]?.bestTime || location.bestTime,
      })),
    [copy],
  )
  const activeLocation = locations.find((location) => location.id === activeLocationId) ?? locations[0]
  const selectedPackage = copy.pricing.packages[selectedPackageIndex] ?? copy.pricing.packages[0]
  const placement=useMemo(()=>bookingPlacement(curation),[curation])
  const portfolioPreviews=useMemo(()=>portfolioEntryPhotos(curation),[curation])
  const sessionSeries=useMemo(()=>bookingPortraitGroups(curation,process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top",placement.gallery,pageLocale),[curation,placement,pageLocale])
  const displayCover:Photo|null=placement.hero?{id:`portrait-${placement.hero.id}`,src:photoSource(placement.hero.src,process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top",1920,true),alt:portraitTitle(placement.hero,pageLocale,pageLocale==="zh"?"人像作品":"Portrait photograph")}:null
  const aboutVisualPhotos=useMemo<Photo[]>(()=>placement.intro.map(photo=>{
    const display=sessionPhotoSources(photo,process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top")
    return {id:`portrait-${photo.id}`,src:photo.src.startsWith("http")?photo.src:new URL(photo.src,process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top").href,
      alt:portraitTitle(photo,pageLocale,pageLocale==="zh"?"摄影师的照片":"Photographer portrait"),width:display.width || photo.width || undefined,height:display.height || photo.height || undefined}
  }),[placement,pageLocale])
  const shootVisualPhotos=useMemo<Photo[]>(()=>placement.processPhotos.map(photo=>{
    const display=sessionPhotoSources(photo,process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top")
    return {id:`portrait-${photo.id}`,src:photo.id<0?photo.src:photoSource(photo.src,process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top",1920,true),alt:portraitTitle(photo,pageLocale,pageLocale==="zh"?"摄影作品":"Photograph"),
      width:display.width || photo.width || undefined,height:display.height || photo.height || undefined}
  }),[placement,pageLocale])
  const allPhotos = useMemo(() => {
    const seen = new Set<string>()
    return [...(displayCover?[displayCover]:[]), ...sessionSeries.flatMap(group => group.photos), ...aboutVisualPhotos, ...shootVisualPhotos]
      .filter(photo => {
        if (!curationFeatured(curation,photo) || seen.has(photo.src)) return false
        seen.add(photo.src)
        return true
      })
  }, [sessionSeries, aboutVisualPhotos, shootVisualPhotos, curation, displayCover?.src])
  const openPhoto = (photo: Photo, trigger?: HTMLButtonElement) => {
    const index = allPhotos.findIndex(item => item.src === photo.src)
    if (index < 0) return
    photoTriggerRef.current = trigger || (document.activeElement instanceof HTMLButtonElement ? document.activeElement : null)
    setCurrentIndex(index)
    setPresentedIndex(index)
    setLightbox(true)
  }

  const updateBookingField = (field: keyof typeof bookingForm, value: string) => {
    setBookingForm((current) => ({ ...current, [field]: value }))
  }

  const handleBookingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (bookingStatus === "sending") return
    setBookingStatus("sending")
    setBookingMessageKey(null)

    try {
      const response = await fetch("/api/photo-session-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageName: selectedPackage.name,
          packagePrice: selectedPackage.price,
          packageNote: selectedPackage.note,
          dateLabel: bookingForm.date,
          timeWindow: copy.form.timeWindow,
          timeWindowNote: copy.form.timeWindowNote,
          ...bookingForm,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(String(payload.error || "Booking request failed"))
      }
      setBookingStatus("sent")
      setBookingMessageKey(payload.emailSent?"sentMessage":"loggedMessage")
      setIsEmailFormOpen(false)
    } catch (error) {
      setBookingStatus("error")
      setBookingMessageKey("errorMessage")
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setIsEntering(false), 80)
    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const root = mapRootRef.current
    if (!root) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { setMapNear(true); observer.disconnect() }
    }, {rootMargin: "600px"})
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    let releaseWheelGestures: (() => void) | undefined

    if (!mapNear) return
    const mountMap = async () => {
      const root = mapRootRef.current
      if (!root) return

      setMapReady(false)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersLayerRef.current = null
      }

      root.innerHTML = ""
      const leafletRoot = root as HTMLDivElement & { _leaflet_id?: number }
      delete leafletRoot._leaflet_id

      const leaflet = await import("leaflet")
      if (cancelled || !mapRootRef.current) return

      const map = leaflet.map(root, {
        center: [60.17045, 24.95223],
        zoom: 12,
        minZoom: 10,
        maxZoom: 17,
        scrollWheelZoom: false,
        dragging: true,
        touchZoom: true,
        keyboard: true,
        zoomSnap: .25,
        zoomControl: true,
        attributionControl: false,
      })

      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          tileSize: 256,
          maxZoom: 18,
          attribution: "&copy; OpenStreetMap",
        })
        .addTo(map)

      const bounds = leaflet.latLngBounds(locations.map((location) => [location.lat, location.lng]))
      map.fitBounds(bounds.pad(0.18), { animate: false })
      mapRef.current = map
      releaseWheelGestures = bindMapWheelGestures(map, root.parentElement || root)
      markersLayerRef.current = leaflet.layerGroup().addTo(map)
      locationMarkersRef.current={}
      lastMapFocusRef.current=null
      leaflet.polyline(locations.map(location=>[location.lat,location.lng]),{color:"#355d63",weight:2,opacity:.56,dashArray:"6 10"}).addTo(markersLayerRef.current)
      locations.forEach((location,index)=>{
        const marker=leaflet.marker([location.lat,location.lng],{icon:leaflet.divIcon({className:"",iconSize:[34,34],iconAnchor:[17,17],
          html:`<span data-route-marker="${location.id}" style="display:flex;height:34px;width:34px;align-items:center;justify-content:center;border-radius:9999px;border:2px solid #20231f;background:#355d63;color:#fff;font-size:14px;font-weight:700;box-shadow:0 14px 34px -18px rgba(32,35,31,.9);">${index+1}</span>`})})
          .on("click",()=>focusMapLocation(location.id)).addTo(markersLayerRef.current)
        marker.bindTooltip(`${index+1}. ${location.name}`,{direction:"top",offset:[0,-10],opacity:.96,className:"photo-session-map-tooltip"})
        locationMarkersRef.current[location.id]=marker
      })
      window.requestAnimationFrame(() => {
        map.invalidateSize()
      })
      setMapReady(true)
    }

    void mountMap()
    const handleResize = () => {
      if (!mapRef.current) return
      mapRef.current.invalidateSize()
    }
    window.addEventListener("resize", handleResize)

    return () => {
      cancelled = true
      releaseWheelGestures?.()
      window.removeEventListener("resize", handleResize)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersLayerRef.current = null
        locationMarkersRef.current={}
        lastMapFocusRef.current=null
      }
      setMapReady(false)
    }
  }, [mapNear,focusMapLocation])

  useEffect(()=>{
    if(!mapReady)return
    for(const [id,marker]of Object.entries(locationMarkersRef.current)){
      const active=id===activeLocationId
      const dot=marker.getElement()?.firstElementChild as HTMLElement|undefined
      if(dot){dot.style.background=active?"#cad8da":"#355d63";dot.style.color=active?"#20231f":"#fff";dot.dataset.active=String(active)}
      const display=displayLocations.find(location=>location.id===id)
      if(display)marker.setTooltipContent(`${locations.findIndex(location=>location.id===id)+1}. ${display.name}`)
      const tooltip=marker.getTooltip()
      if(tooltip && tooltip.options.permanent!==active)marker.unbindTooltip().bindTooltip(tooltip,{permanent:active})
      if(active)marker.openTooltip();else marker.closeTooltip()
    }
  },[activeLocationId,mapReady,displayLocations])

  useEffect(()=>{
    const map=mapRef.current
    if(!mapReady || !map)return
    if(lastMapFocusRef.current===null){lastMapFocusRef.current=activeLocationId;return}
    if(lastMapFocusRef.current===activeLocationId)return
    lastMapFocusRef.current=activeLocationId
    map.stop()
    map.flyTo([activeLocation.lat,activeLocation.lng],Math.max(map.getZoom(),13),{animate:!window.matchMedia("(prefers-reduced-motion: reduce)").matches,duration:.32})
  },[activeLocationId,activeLocation.lat,activeLocation.lng,mapReady])


  const handlePortfolioLink = (event: MouseEvent<HTMLElement>) => {
    if(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button!==0)return
    event.preventDefault()
    setIsLeaving(true)
    window.setTimeout(() => {
      router.push("/portfolio?from=photo-session")
    }, 420)
  }

  const handleLanguageToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const nextLocale:Locale=pageLocale === "zh" ? "en" : "zh"
    const styleIndex=copy.options.serviceTypes.findIndex(type=>type===bookingForm.style)
    if(styleIndex>=0)setBookingForm(current=>({...current,style:photoSessionCopy[nextLocale].options.serviceTypes[styleIndex]}))
    setLocale(nextLocale)
  }

  const handleScrollTop = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
    window.history.replaceState(null, "", window.location.pathname)
  }

  return (
    <main lang={pageLocale}
      className={`${sessionStyles.page} min-h-screen bg-white font-['Portfolio_Hanken'] text-[#151612]`}
      onDragStart={(event) => event.preventDefault()}
    >
      <div
        className={`pointer-events-none fixed inset-0 z-[10000] bg-white transition-opacity duration-500 ease-out ${
          isEntering || isLeaving ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      <section id="session-hero" className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-[#050505] text-white">
        <a href="/" className={sessionStyles.homeLink} aria-label={pageLocale === "zh" ? "返回首页" : "Back to home"}>LIJIE LI</a>
        <button
          type="button"
          className={sessionStyles.languageSwitch}
          onClick={handleLanguageToggle}
          aria-label={copy.languageLabel}
          title={copy.languageLabel}
        >
          {copy.languageButton}
        </button>

        {displayCover&&<SessionImage
          src={displayCover.src}
          fullResolution
          alt={displayCover.alt}
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          className="absolute inset-0 h-full w-full object-cover"
        />}
        <div className={sessionStyles.heroShade} aria-hidden="true" />

        <div className={sessionStyles.heroContent}>
          <div className="max-w-6xl">
            <h1 className={sessionStyles.heroTitle}>{copy.hero.title}</h1>
          </div>
        </div>
      </section>

      <PhotographerIntro photos={aboutVisualPhotos} title={copy.about.title} body={copy.about.body}
        lines={copy.about.highlightLines} eyebrow={copy.about.eyebrow} locale={pageLocale} onOpen={openPhoto} />

      <SessionSeriesGallery series={sessionSeries} onOpen={openPhoto} locale={pageLocale} label={pageLocale === "zh" ? "人像系列" : "Portrait series"} />

      <WhyMeSection copy={copy} photos={shootVisualPhotos} locale={pageLocale} onOpen={openPhoto} />

      <section id="locations" className="bg-[#ffffff] px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <header className={sessionStyles.locationHeading}>
            <h2>{copy.locations.title}</h2><p>{copy.locations.body}</p>
          </header>

          <div className={`grid gap-8 lg:grid-cols-[0.58fr_0.42fr] ${sessionStyles.locationLayout}`}>
            <div className={sessionStyles.locationList}>
              {displayLocations.map((location, index) => (
                <article
                  key={location.id}
                  ref={(node) => {
                    locationRefs.current[index] = node
                  }}
                  data-location-id={location.id}
                  aria-current={activeLocationId===location.id?"location":undefined}
                  className={sessionStyles.locationItem}

                >
                  <button type="button" className={sessionStyles.locationFocus} onClick={() => focusMapLocation(location.id)} aria-label={pageLocale==="zh"?`定位到${location.name}`:`Focus on ${location.name}`}>
                    <span>{location.name}</span><span className={sessionStyles.locationDot} aria-hidden="true" />
                  </button>
                  <a href={location.href} target="_blank" rel="noreferrer" className={sessionStyles.locationLink} aria-label={pageLocale==="zh"?`在地图中打开${location.name}`:`Open ${location.name} in maps`}><ArrowRight size={17} strokeWidth={1.3} aria-hidden="true" /></a>
                </article>
              ))}
            </div>

            <div data-location-map className={`lg:sticky lg:top-16 lg:order-1 lg:h-[calc(100svh-8rem)] ${sessionStyles.locationMap}`}>
              <div className={`relative h-[70svh] min-h-[540px] overflow-hidden rounded-md border border-[#d9dfe0] bg-[#dfe9ea] shadow-[0_24px_70px_-58px_rgba(32,35,31,0.55)] lg:h-full ${sessionStyles.locationMapSurface}`}>
                <div ref={mapRootRef} className="absolute inset-0 z-0 h-full w-full [&_.leaflet-tooltip.photo-session-map-tooltip]:rounded-md [&_.leaflet-tooltip.photo-session-map-tooltip]:border-[#d9dfe0] [&_.leaflet-tooltip.photo-session-map-tooltip]:bg-white/95 [&_.leaflet-tooltip.photo-session-map-tooltip]:px-2.5 [&_.leaflet-tooltip.photo-session-map-tooltip]:py-1.5 [&_.leaflet-tooltip.photo-session-map-tooltip]:text-xs [&_.leaflet-tooltip.photo-session-map-tooltip]:font-semibold [&_.leaflet-tooltip.photo-session-map-tooltip]:text-[#20231f] [&_.leaflet-tooltip.photo-session-map-tooltip]:shadow-sm" />
                <div
                  className={`pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-[#dfe9ea] transition duration-500 ${
                    mapReady ? "opacity-0" : "opacity-100"
                  }`}
                >

                </div>
                <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(255,250,242,0.05),rgba(32,35,31,0.08))]" />

              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className={sessionStyles.booking} aria-labelledby="session-booking-title">
        <div className={sessionStyles.sectionInner}>
          <h2 id="session-booking-title" className={sessionStyles.bookingTitle}>{copy.pricing.title}</h2>
          <div className={sessionStyles.bookingLayout}>
            <div id="pricing">
              <div className={sessionStyles.packageList} role="group" aria-label={copy.form.packagePrefix}>
                {copy.pricing.packages.map((item,index) => <button key={item.name} type="button" className={sessionStyles.package} aria-pressed={selectedPackageIndex===index} onClick={() => {
                  setSelectedPackageIndex(index)
                  setBookingForm(current => ({...current,people:index<3?String(index+1):""}))
                }}>
                  <span className={sessionStyles.packageDot} aria-hidden="true" /><span>{item.name}</span><span className={sessionStyles.packagePrice}>{item.price}</span>
                </button>)}
              </div>
              {selectedPackageIndex<3?<dl className={sessionStyles.sessionFacts}>
                <div><dt>{pageLocale==="zh"?"拍摄时长":"Session"}</dt><dd>2<span>{pageLocale==="zh"?"小时":"hours"}</span></dd></div>
                <div><dt>{pageLocale==="zh"?"精修照片":"Retouched"}</dt><dd>9<span>{pageLocale==="zh"?"张":"photos"}</span></dd></div>
                <div><dt>{pageLocale==="zh"?"交付时间":"Delivery"}</dt><dd>5<span>{pageLocale==="zh"?"日内":"days max."}</span></dd></div>
              </dl>:<p className={sessionStyles.customQuote}>{pageLocale==="zh"?"人数、路线与交付另议":"Group, route and delivery by arrangement"}</p>}

              <fieldset id="options" className={sessionStyles.shootTypes}>
                <legend>{copy.options.typesTitle}</legend>
                {copy.options.serviceTypes.map((type,index) => <button key={type} type="button" aria-pressed={bookingForm.style===type} onClick={() => {
                  setBookingForm(current => ({...current,style:current.style===type?"":type,...(index===1?{people:"2"}:{})}))
                  if(index===1)setSelectedPackageIndex(1)
                }}>{type}</button>)}
              </fieldset>
            </div>
            <div className={sessionStyles.contactActions}>
              <h3>{copy.contact.title}</h3>
              <button type="button" ref={bookingTriggerRef} onClick={event=>{bookingTriggerRef.current=event.currentTarget;setIsEmailFormOpen(true)}} className={sessionStyles.contactAction}>
                <span>{copy.contact.emailTitle}</span><span className={sessionStyles.contactArrow}><ArrowRight size={19} strokeWidth={1.3} aria-hidden="true" /></span>
              </button>
              <a href={xhsHref} target="_blank" rel="noreferrer" className={sessionStyles.contactAction}>
                <span>{copy.contact.xhsTitle}</span><span className={sessionStyles.contactArrow}><ArrowRight size={19} strokeWidth={1.3} aria-hidden="true" /></span>
              </a>
              {bookingMessage && <p className={sessionStyles.bookingFeedback} role="status" data-error={bookingStatus==="error"}>{bookingMessage}</p>}
            </div>
          </div>
          <div className={sessionStyles.bookingDetails}>
            <details id="delivery" className={sessionStyles.disclosure}>
              <summary><span>{copy.delivery.title}</span><span className={sessionStyles.questionToggle} aria-hidden="true" /></summary>
              <div className={sessionStyles.conditionGrid}>
                <div><h3>{copy.delivery.includedTitle}</h3><ul>{copy.delivery.includedItems.map(item=><li key={item}>{item}</li>)}</ul></div>
                <div><h3>{copy.delivery.boundaryTitle}</h3><ul>{copy.delivery.boundaryItems.map(item=><li key={item}>{item}</li>)}</ul></div>
              </div>
              <p className={sessionStyles.pricingNote}>{copy.pricing.note}</p>
            </details>
            <BookingQuestions copy={copy.faq} />
          </div>
        </div>
      </section>

      <Dialog.Root open={isEmailFormOpen} onOpenChange={setIsEmailFormOpen}><Dialog.Portal>
        <Dialog.Overlay className={sessionStyles.bookingOverlay} />
        <Dialog.Content asChild aria-describedby={undefined} className={sessionStyles.bookingDialog}
          onCloseAutoFocus={event => { event.preventDefault(); bookingTriggerRef.current?.focus({preventScroll: true}) }}>
          <form onSubmit={handleBookingSubmit} className="fixed left-1/2 top-1/2 z-[10002] max-h-[calc(100dvh-40px)] w-[calc(100%-40px)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-[#d9dfe0] bg-white p-5 shadow-[0_32px_110px_rgba(0,0,0,0.38)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase text-[#7a6f62]">{copy.form.eyebrow}</p>
                <Dialog.Title asChild><h3 className="mt-2 text-3xl font-semibold leading-tight text-[#20231f]">{copy.form.title}</h3></Dialog.Title>
              </div>
              <button
                type="button"
                className="min-h-11 shrink-0 whitespace-nowrap rounded-md border border-[#d9dfe0] px-3 py-2 text-sm font-semibold text-[#20231f] transition hover:border-[#20231f]"
                onClick={() => setIsEmailFormOpen(false)}
              >
                {copy.form.close}
              </button>
            </div>
            <label className={sessionStyles.packageChoice}>
              <span>{copy.form.packagePrefix}</span>
              <select value={selectedPackageIndex} aria-label={copy.form.packagePrefix} onChange={event => {
                const index = Number(event.target.value)
                setSelectedPackageIndex(index)
                setBookingForm(current => ({...current,people:index < 3 ? String(index + 1) : ""}))
              }}>
                {copy.pricing.packages.map((item,index) => <option key={item.name} value={index}>{item.name} / {item.price} / {item.note}</option>)}
              </select>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-[#20231f]">
                {copy.form.name}
                <input
                  required
                  value={bookingForm.name}
                  onChange={(event) => updateBookingField("name", event.target.value)}
                  className="h-11 rounded-md border border-[#d9dfe0] bg-[#ffffff] px-3 text-sm font-medium outline-none transition focus:border-[#355d63]"
                  placeholder={copy.form.namePlaceholder}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#20231f]">
                {copy.form.date}
                <input
                  required
                  value={bookingForm.date}
                  onChange={(event) => updateBookingField("date", event.target.value)}
                  className="h-11 rounded-md border border-[#d9dfe0] bg-[#ffffff] px-3 text-sm font-medium outline-none transition focus:border-[#355d63]"
                  placeholder={copy.form.datePlaceholder}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#20231f]">
                {copy.form.contact}
                <input
                  required
                  value={bookingForm.contact}
                  onChange={(event) => updateBookingField("contact", event.target.value)}
                  className="h-11 rounded-md border border-[#d9dfe0] bg-[#ffffff] px-3 text-sm font-medium outline-none transition focus:border-[#355d63]"
                  placeholder={copy.form.contactPlaceholder}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#20231f]">
                {copy.form.people}
                <input
                  value={bookingForm.people}
                  onChange={(event) => updateBookingField("people", event.target.value)}
                  className="h-11 rounded-md border border-[#d9dfe0] bg-[#ffffff] px-3 text-sm font-medium outline-none transition focus:border-[#355d63]"
                  placeholder={copy.form.peoplePlaceholder}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#20231f]">
                {copy.form.style}
                <input
                  value={bookingForm.style}
                  onChange={(event) => updateBookingField("style", event.target.value)}
                  className="h-11 rounded-md border border-[#d9dfe0] bg-[#ffffff] px-3 text-sm font-medium outline-none transition focus:border-[#355d63]"
                  placeholder={copy.form.stylePlaceholder}
                />
              </label>
            </div>

            <label className="mt-4 grid gap-2 text-sm font-semibold text-[#20231f]">
              {copy.form.note}
              <textarea
                value={bookingForm.note}
                onChange={(event) => updateBookingField("note", event.target.value)}
                className="min-h-28 rounded-md border border-[#d9dfe0] bg-[#ffffff] px-3 py-3 text-sm font-medium outline-none transition focus:border-[#355d63]"
                placeholder={copy.form.notePlaceholder}
              />
            </label>

            <div className="mt-5 rounded-md border border-[#d9dfe0] bg-[#f3f5f6] p-4 text-sm leading-6 text-[#676256]">
              <p className="font-semibold text-[#20231f]">{copy.form.summaryTitle}</p>
              <p className="mt-2">{selectedPackage.name} / {selectedPackage.price} / {selectedPackage.note}</p>
              <p>{bookingForm.date || copy.form.dateFallback} / {copy.form.timeFallback}</p>
            </div>

            <Button
              type="submit"
              disabled={bookingStatus === "sending"}
              className="mt-5 h-11 w-full rounded-md bg-[#20231f] text-white hover:bg-[#2b302a]"
            >
              <Mail className="h-4 w-4" />
              {bookingStatus === "sending" ? copy.form.sending : copy.form.submit}
            </Button>

            {bookingMessage && (
              <p className={`mt-3 text-sm font-semibold ${bookingStatus === "error" ? "text-red-700" : "text-[#355d63]"}`}>
                {bookingMessage}
              </p>
            )}
          </form>
        </Dialog.Content>
      </Dialog.Portal></Dialog.Root>

      <section className={sessionStyles.portfolioDoor} aria-label={pageLocale==="zh"?"摄影作品集":"Photography portfolio"}>
        <a href="/portfolio?from=photo-session" onClick={handlePortfolioLink} className={sessionStyles.portfolioDoorLink} data-portfolio-entry>
          {portfolioPreviews.length>0&&<div className={sessionStyles.portfolioPreviewImages}>
            {portfolioPreviews.map((photo,index)=><div key={photo.id} data-preview-picture={photo.id}>
              <img src={photoSource(photo.src,process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top",1280)}
                srcSet={[640,1280,2560].map(width=>`${photoSource(photo.src,process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top",width)} ${width}w`).join(", ")}
                alt="" width={photo.width || undefined} height={photo.height || undefined} loading="lazy" decoding="async" draggable={false}
                sizes={index===0?"(max-width:767px) calc(100vw - 40px), (min-width:1280px) 396px, 30vw":"(max-width:767px) calc(50vw - 25px), (min-width:1280px) 396px, 30vw"} />
            </div>)}
          </div>}
          <div className={sessionStyles.portfolioDoorCaption}><h2>Portfolio</h2><span>{pageLocale==="zh"?"浏览摄影作品":"Explore the photographs"}<span className={sessionStyles.contactArrow}><ArrowRight size={19} strokeWidth={1.3} aria-hidden="true" /></span></span></div>
        </a>
      </section>

      <footer className={sessionStyles.footer}>
        <details className={sessionStyles.imageRights}><summary>© Lijie Li</summary><p>{copy.footer.notice}</p></details>
        <div><button type="button" onClick={handleScrollTop} className={sessionStyles.backToTop} aria-label={copy.footer.top}><ArrowDown size={18} strokeWidth={1.3} aria-hidden="true" /></button></div>
      </footer>

      <Dialog.Root open={lightbox} onOpenChange={setLightbox}><Dialog.Portal>
        <Dialog.Overlay className={viewerStyles.lightboxOverlay} />
        <Dialog.Content className={viewerStyles.lightbox} aria-describedby={undefined}
          onCloseAutoFocus={event => { event.preventDefault(); photoTriggerRef.current?.focus({preventScroll: true}) }}>
          <header className={viewerStyles.lightboxHeader}>
            <Dialog.Title>{pageLocale === "zh" ? "拍摄片刻" : "Photographs"}<span>{String(presentedIndex + 1).padStart(2, "0")} / {String(allPhotos.length).padStart(2, "0")}</span></Dialog.Title>
            <Dialog.Close asChild><button className={viewerStyles.closeButton} aria-label={pageLocale === "zh" ? "关闭样片" : "Close photographs"}><X size={21} strokeWidth={1.4} /></button></Dialog.Close>
          </header>
          <div className={viewerStyles.lightboxStage}>{lightbox && <LazyCarousel keyboardInDialog images={allPhotos.map((photo): CarouselImage => {
            const src = sessionViewerSource(photo.src)
            return {id: photo.id, url: /^https?:/.test(src) ? src : `${window.location.origin}${src}`, translations: {en: {title: photo.alt}, zh: {title: photo.alt}}}
          })} currentIndex={currentIndex} onChangeImage={setCurrentIndex} onDisplayImage={setPresentedIndex} />}</div>
          <footer className={viewerStyles.lightboxFooter}><span>{allPhotos[presentedIndex]?.alt}</span><div>
            <button className={viewerStyles.closeButton} onClick={() => setCurrentIndex(index => (index - 1 + allPhotos.length) % allPhotos.length)} aria-label={pageLocale === "zh" ? "上一张样片" : "Previous photograph"}><ArrowRight size={18} className="rotate-180" /></button>
            <button className={viewerStyles.closeButton} onClick={() => setCurrentIndex(index => (index + 1) % allPhotos.length)} aria-label={pageLocale === "zh" ? "下一张样片" : "Next photograph"}><ArrowRight size={18} /></button>
          </div></footer>
        </Dialog.Content>
      </Dialog.Portal></Dialog.Root>
    </main>
  )
}
