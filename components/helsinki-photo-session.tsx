"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { FormEvent, ImgHTMLAttributes, MouseEvent } from "react"
import { useRouter } from "next/navigation"
import "leaflet/dist/leaflet.css"
import {
  ArrowDown,
  ArrowRight,
  Camera,
  CalendarDays,
  Check,
  Clock,
  GraduationCap,
  Heart,
  Images,
  Languages,
  Mail,
  MapPin,
  MessageCircle,
  PawPrint,
  Star,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"

type Locale = "zh" | "en"

type Photo = {
  id: string
  src: string
  alt: string
}

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

type ShootStep = {
  eyebrow: string
  title: string
  body: string
  image: Photo
}

type MomentCard = Photo & {
  title: string
  place: string
  note: string
  featured?: boolean
  tags: string[]
  sourceName?: string
}

type MomentGroup = {
  id: string
  title: string
  place: string
  note: string
  featured?: boolean
  hideCaption?: boolean
  photoCount?: number
  tags: string[]
  photos: MomentCard[]
}

type Testimonial = {
  quote: string
  name: string
  context: string
}

const xhsHref = "https://xhslink.com/m/7aNml9q2AjQ"

const photoSessionCopy = {
  zh: {
    languageButton: "EN",
    languageLabel: "切换到英文",
    momentTypeCouple: "情侣拍摄",
    hero: {
      title: "旅拍摄影师 - Lijie",
      samples: "样片",
      portfolio: "摄影集",
      booking: "预约",
    },
    about: {
      eyebrow: "About me",
      title: "我是你的“旅游摄影搭子”",
      body: "我不是那种只在旁边按快门的人。拍摄时我会聊天、看你的节奏，也会在你紧张的时候把场面松下来。照片要好看，但那天本身也要好玩。",
      highlightLines: [
        "Base赫尔辛基，但拍摄不只限芬兰，全欧可飞",
        "我是一个有趣的人，我的责任是给你带来快乐和美丽的照片",
        "情绪稳定，懂得引导，会给情绪价值",
      ],
    },
    process: {
      eyebrow: "Why ME",
      title: "我的责任，是把拍摄当天也照顾好",
      steps: [
        {
          title: "路线可以我定，也可以你定",
          body: "路线优先选，不让转场吃掉拍摄时间。我会按时间、光线和转场安排路线，你也可以提供自己的路线。",
        },
        {
          title: "不要求你本来就是模特",
          body: "现场会给动作指导。走路、坐下、不看镜头、大头照、游客照，都可以自然完成。",
        },
        {
          title: "设备可以很自由",
          body: "我会用自己的设备，也可以用你的设备拍。数码、胶片、CCD、拍立得都可以提前沟通。",
        },
        {
          title: "熟悉赫尔辛基现场",
          body: "我在这里生活两年，也是在校学生，更清楚该去哪拍、怎么走、哪段路更适合你。",
        },
        {
          title: "稳定、耐心，也好相处",
          body: "拍摄过程会轻松一点。我可以帮你扛东西和器材，也可以像摄影搭子一样一起行动。",
        },
        {
          title: "可以像地陪一样带你玩",
          body: "如果你愿意，我也可以顺路带你吃吃喝喝，把拍摄变成半天城市散步。",
        },
        {
          title: "规则提前写清楚",
          body: "价格、交付、取消和额外费用都会提前确认，网站和小红书也会持续写清楚。",
        },
        {
          title: "全欧可飞，也接受亚洲旅拍",
          body: "你承担对应路费、住宿、门票等成本，我就可以配合远距离路线和旅拍计划。",
        },
      ],
    },
    options: {
      eyebrow: "Details / shooting brief",
      titleTop: "你定大概",
      titleBottom: "我定方案",
      typesTitle: "可以拍什么",
      languagesTitle: "可以说什么",
      briefTitle: "可以定什么",
      serviceTypes: ["旅拍 / 游客照", "情侣拍照", "家庭拍照", "证件照", "宠物照片", "毕业写真", "校园写真"],
      languageItems: ["中文", "English", "粤语"],
      briefItems: ["人数", "日期", "大概地点", "想拍的样式"],
    },
    locations: {
      eyebrow: "Routes",
      title: "默认赫尔辛基路线",
      body: "只是默认参考，具体路线可以按天气、时间和你想拍的感觉修改。",
      points: [
        { place: "白教堂 / Senate Square", bestTime: "下午侧光" },
        { place: "码头 / Market Square", bestTime: "16:00 后" },
        { place: "咖啡店 / Jugend hall", bestTime: "阴天也稳" },
        { place: "喷泉 / Esplanadi edge", bestTime: "下午或傍晚" },
        { place: "Otaniemi / Aalto University", bestTime: "下午或课后" },
        { place: "芬兰堡 / sea fortress", bestTime: "日落前" },
      ],
    },
    testimonials: {
      eyebrow: "Shooting experience",
      title: "拍摄体验反馈",
      items: [
        {
          quote: "一开始其实很担心自己不会拍照，但现场不是那种被命令摆姿势的感觉。会边走边调整动作，也会告诉我手放哪里、看哪里，最后照片比我平时自拍自然很多。",
          name: "Z. Li",
          context: "第一次单人约拍",
        },
        {
          quote: "路线不是把景点一个个打卡，而是会看光线和我们当时的状态。拍完有一些远景，也有很多聊天走路时抓到的瞬间，比较像真的旅行记忆。",
          name: "Rico",
          context: "瑞士旅拍",
        },
        {
          quote: "我不太喜欢太正式的毕业照，所以重点放在校园、衣服和当天的情绪上。成片没有很僵，也保留了学校环境，发给家里人和朋友都很合适。",
          name: "H. Jia",
          context: "校园 / 毕业记录",
        },
        {
          quote: "沟通的时候会把价格、加钱项和交付讲清楚，所以拍之前没有那种不确定感。现场也会帮忙看包、看衣服，整体更像有人一起把这件事照顾好。",
          name: "D. Wang",
          context: "旅行人像",
        },
        {
          quote: "我只给了大概想去的地点，最后路线被重新排过，基本没有把时间浪费在乱走上。照片里既有地点，也有人在里面的状态。",
          name: "Junjie",
          context: "旅途中记录",
        },
        {
          quote: "收到图以后最喜欢的是那些没有刻意看镜头的照片。它们不是模板照，更像那天真的发生过的片段，这一点对我来说很重要。",
          name: "M. Chen",
          context: "自然街拍",
        },
      ],
    },
    pricing: {
      eyebrow: "Pricing",
      title: "约拍价格",
      note: "具体情况会按实际拍摄安排、人数和交付需求略微调整，确认前会先说清楚。",
      packages: [
        { name: "单人", price: "EUR 99", note: "2 小时" },
        { name: "双人 / 情侣", price: "EUR 139", note: "2 小时" },
        { name: "三人", price: "EUR 169", note: "2 小时" },
        { name: "四人及以上", price: "另议", note: "按人数和路线确认" },
      ],
    },
    delivery: {
      eyebrow: "Delivery / rules",
      title: "交付和边界",
      includedTitle: "交付包含",
      boundaryTitle: "费用与边界",
      includedItems: ["拍摄前路线和风格沟通", "2 小时拍摄与动作引导", "筛选后 JPG 底片", "9 张精修", "9 张精修图对应 RAW 文件"],
      boundaryItems: [
        "续时 EUR 40 / 小时；额外精修 EUR 2 / 张",
        "下雪或小雨如确认继续拍摄，加 EUR 5 / 小时",
        "旅拍、远距离地点、门票和交通费需实报实销",
        "精心二次后期后仍不满意，可以要求退款",
        "妆发需自理；未经同意不会公开发布照片",
      ],
    },
    contact: {
      eyebrow: "Booking",
      title: "预约流程",
      processItems: ["私信沟通并选定套餐", "约定时间和地点，拍摄当天提前会合", "拍完后五天以内返回照片；加钱可加急"],
      xhsTitle: "小红书私信",
      xhsBody: "适合先发样片参考、截图和大概日期。点击后跳转到小红书。",
      xhsAction: "打开私信",
      emailTitle: "邮件预约",
      emailBody: "适合一次性把人数、日期、路线和想法写清楚。点击后填写表单。",
      emailAction: "填写信息",
    },
    form: {
      eyebrow: "Email booking",
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
      loggedMessage: "预约信息已记录；邮件暂时没有发送成功，我会从后台日志处理。",
      errorMessage: "发送失败，请稍后再试。",
    },
    faq: {
      eyebrow: "FAQ",
      title: "拍之前最常问到的问题。",
      items: [
        { question: "可以拍视频吗？", answer: "目前只接照片拍摄，不接正式视频拍摄。我的重点会放在静态照片里的人物状态、地点感和旅行氛围。" },
        { question: "预约之后会发生什么？", answer: "确认预约后，我会和你对齐套餐、集合点、拍摄时间、穿搭和想要的感觉。拍摄前可以继续私信沟通，把不确定的地方先处理掉。" },
        { question: "需要提前多久预约？", answer: "建议至少提前一周来问，旺季或旅行日期比较固定时最好提前四周。临时约也可以问，但不保证一定能接；如果是求婚、惊喜或需要隐藏安排的拍摄，建议至少提前两周。" },
        { question: "赫尔辛基约拍多少钱？", answer: "基础价格按上面的套餐走：单人 EUR 99 / 2 小时起，双人 / 情侣 EUR 139 / 2 小时起。具体情况会按实际拍摄安排、人数和交付需求略微调整，确认前会先说清楚。" },
        { question: "在赫尔辛基找摄影师值得吗？", answer: "如果你希望把旅行、毕业、纪念日或普通的一天留下来，是值得的。当地摄影师会更熟悉光线、天气、适合走路的区域和不太挤的角度，照片会比单纯打卡更像你那天真实的状态。" },
        { question: "拍摄当天和交付时间是怎样的？", answer: "拍摄当天建议提前 10 分钟到集合点，先确认当天目标和节奏。拍完后一般五天以内返回照片；如果你需要更快拿到图，可以提前说，加急会单独加钱。" },
        { question: "阴天还能拍吗？", answer: "阴天可以正常拍，柔光反而适合人像。下雪或小雨也可以拍，但会加 EUR 5 / 小时；恶劣天气可以免费改期或取消。" },
        { question: "怎么付款和取消？", answer: "确认档期需要支付总价 50% 订金。拍摄前 24 小时外取消可退订金，24 小时内取消订金不退。支持微信、支付宝、Revolut、MobilePay。" },
        { question: "如果我迟到了怎么办？", answer: "我会在约定地点等你，但拍摄时间会从我们约定的开始时间计时，不会从你实际到达后重新开始。请尽量准时到达，这样 2 小时才会完整用在拍摄上。" },
        { question: "如果精修风格不满意呢？", answer: "可以先沟通二次后期。如果精心二次后期之后你仍然不满意，可以要求退款。" },
        { question: "可以去赫尔辛基以外吗？", answer: "可以。Base赫尔辛基，但拍摄不只限芬兰，全欧可飞。远距离路线、欧洲其他城市或亚洲旅拍，需要你承担对应路费、住宿、门票和必要转场费用。" },
        { question: "交付包含什么？", answer: "基础包含筛选后 JPG 底片、9 张精修，以及 9 张精修图对应 RAW 文件。额外精修 EUR 2 / 张，续时 EUR 40 / 小时。" },
        { question: "衣服需要提前准备吗？", answer: "建议提前看颜色和层次。赫尔辛基风大，外套、围巾或能随手搭的单品会更好拍；如果你不确定，也可以把衣服发给我一起看。" },
        { question: "照片会被公开发布吗？", answer: "不会默认公开。未经你同意，我不会把你的照片发布到网站、小红书或其他公开平台。" },
      ],
    },
    footer: {
      title: "旅拍摄影师 / Base赫尔辛基",
      notice: "本站图片未经许可禁止使用、复制、下载、转载或用于训练/商业用途。预约沟通请通过上方入口进入。",
      booking: "预约方式",
      top: "回到顶部",
    },
  },
  en: {
    languageButton: "中",
    languageLabel: "Switch to Chinese",
    momentTypeCouple: "Couple session",
    hero: {
      title: "Travel Photographer - Lijie",
      samples: "Samples",
      portfolio: "Portfolio",
      booking: "Book",
    },
    about: {
      eyebrow: "About me",
      title: "I am your travel photo buddy",
      body: "I am not only the person pressing the shutter. During the shoot, I talk with you, read your pace, and help the day feel lighter when you get nervous. The photos should look good, but the day itself should also feel good.",
      highlightLines: [
        "Based in Helsinki, available across Finland, Europe, and Asia travel sessions",
        "I am a fun person, and my job is to bring you joy and beautiful photos",
        "Calm, patient, good at guiding, and generous with emotional support",
      ],
    },
    process: {
      eyebrow: "Why me",
      title: "I take care of the shoot day, not only the camera",
      steps: [
        {
          title: "I can plan the route, or we can use yours",
          body: "The route is planned so that transfers do not eat the session. I arrange it around time, light, and walking distance, and you can also bring your own route ideas.",
        },
        {
          title: "You do not need to be a model",
          body: "I will guide you on the spot. Walking, sitting, looking away, close portraits, and tourist-style photos can all feel natural.",
        },
        {
          title: "The camera setup can be flexible",
          body: "I can shoot with my own gear, and we can also include yours. Digital, film, CCD, and instant cameras can all be discussed in advance.",
        },
        {
          title: "I know Helsinki on the ground",
          body: "I have lived here for two years and study here, so I know where to go, how to walk, and which parts of the route fit different people.",
        },
        {
          title: "Stable, patient, easy to be around",
          body: "The shoot should feel relaxed. I can help with bags and gear, and move through the city like a photo companion rather than a distant vendor.",
        },
        {
          title: "It can feel like a city walk",
          body: "If you want, I can also take you for food, coffee, and small local stops, turning the shoot into a half-day city walk.",
        },
        {
          title: "Rules are clear before we shoot",
          body: "Price, delivery, cancellation, and extra fees are confirmed in advance. The website and Xiaohongshu will keep these details visible.",
        },
        {
          title: "Europe-wide, and Asia travel sessions are possible",
          body: "If travel, accommodation, tickets, and transfer costs are covered, I can work with longer routes and travel-session plans.",
        },
      ],
    },
    options: {
      eyebrow: "Details / shooting brief",
      titleTop: "You set the idea",
      titleBottom: "I shape the plan",
      typesTitle: "What we can shoot",
      languagesTitle: "Languages",
      briefTitle: "What you can decide",
      serviceTypes: ["Travel photos", "Couple photos", "Family photos", "ID photos", "Pet photos", "Graduation portraits", "Campus portraits"],
      languageItems: ["Chinese", "English", "Cantonese"],
      briefItems: ["People", "Date", "Rough location", "Visual style"],
    },
    locations: {
      eyebrow: "Routes",
      title: "Default Helsinki Route",
      body: "This is only a default reference. The route can change with weather, time, and the mood you want in the photos.",
      points: [
        { place: "Helsinki Cathedral / Senate Square", bestTime: "Afternoon side light" },
        { place: "Market Square / Harbor", bestTime: "After 16:00" },
        { place: "Robert's Coffee Jugend / Indoor backup", bestTime: "Reliable on cloudy days" },
        { place: "Havis Amanda / Esplanadi edge", bestTime: "Afternoon or evening" },
        { place: "Otaniemi / Aalto University", bestTime: "Afternoon or after class" },
        { place: "Suomenlinna / Sea fortress", bestTime: "Before sunset" },
      ],
    },
    testimonials: {
      eyebrow: "Shooting experience",
      title: "Client feedback",
      items: [
        {
          quote: "I was worried that I would not know how to pose, but it did not feel like being ordered around. We adjusted while walking, and I was told where to put my hands and where to look. The final photos felt much more natural than my selfies.",
          name: "Z. Li",
          context: "First solo portrait session",
        },
        {
          quote: "The route was not just a checklist of landmarks. It followed the light and our state that day. The photos included wide scenes and small walking moments, more like real travel memories.",
          name: "Rico",
          context: "Switzerland travel session",
        },
        {
          quote: "I did not want formal graduation photos, so we focused on the campus, clothes, and the feeling of the day. The images were not stiff and still kept the school environment.",
          name: "H. Jia",
          context: "Campus / graduation record",
        },
        {
          quote: "The price, add-ons, and delivery were explained clearly, so there was much less uncertainty before the shoot. On the day, there was also help with bags and clothes.",
          name: "D. Wang",
          context: "Travel portraits",
        },
        {
          quote: "I only gave a rough location idea, and the route was rearranged so we did not waste time walking randomly. The photos kept both the place and the person inside it.",
          name: "Junjie",
          context: "Travel record",
        },
        {
          quote: "My favorites were the photos where I was not deliberately looking at the camera. They were not template shots. They felt like something that really happened that day.",
          name: "M. Chen",
          context: "Natural street portraits",
        },
      ],
    },
    pricing: {
      eyebrow: "Pricing",
      title: "Session pricing",
      note: "Final details may be adjusted slightly based on the actual plan, group size, and delivery needs. Everything will be confirmed before booking.",
      packages: [
        { name: "Solo", price: "EUR 99", note: "2 hours" },
        { name: "Two people / couple", price: "EUR 139", note: "2 hours" },
        { name: "Three people", price: "EUR 169", note: "2 hours" },
        { name: "Four or more", price: "Custom", note: "Confirmed by group and route" },
      ],
    },
    delivery: {
      eyebrow: "Delivery / rules",
      title: "Delivery and boundaries",
      includedTitle: "Included",
      boundaryTitle: "Fees and boundaries",
      includedItems: ["Pre-shoot route and style discussion", "2-hour shoot with posing guidance", "Selected JPG originals", "9 retouched photos", "RAW files for the 9 retouched photos"],
      boundaryItems: [
        "Extra time EUR 40 / hour; extra retouching EUR 2 / photo",
        "If we confirm shooting in snow or light rain, add EUR 5 / hour",
        "Travel sessions, distant locations, tickets, and transport are reimbursed at actual cost",
        "If you are still unhappy after careful second-round editing, you can request a refund",
        "Makeup and hair are self-arranged; photos will not be published without consent",
      ],
    },
    contact: {
      eyebrow: "Booking",
      title: "Booking process",
      processItems: ["Message me and choose a package", "Agree on time and meeting point, then meet before the shoot", "Photos are delivered within about five days; rush delivery is available for an extra fee"],
      xhsTitle: "Xiaohongshu message",
      xhsBody: "Best for sending sample references, screenshots, and rough dates first. Click to open Xiaohongshu.",
      xhsAction: "Open message",
      emailTitle: "Email booking",
      emailBody: "Best when you want to write the group size, date, route, and ideas in one place. Click to fill the form.",
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
      loggedMessage: "Your request was logged; the email could not be sent yet, so I will handle it from the admin log.",
      errorMessage: "Sending failed. Please try again later.",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Common questions before booking.",
      items: [
        { question: "Do you offer Helsinki videographers?", answer: "At the moment, I focus on photography only. The goal is to capture people, place, and travel atmosphere through still images." },
        { question: "What happens after I book a Helsinki photo session?", answer: "After confirmation, we align on the package, meeting point, time, outfits, and the mood you want. You can keep messaging me before the shoot to clear up details." },
        { question: "How far in advance should I book?", answer: "At least one week is recommended. For fixed travel dates or busy seasons, four weeks is better. Last-minute requests are welcome but not guaranteed. For proposals or surprise plans, at least two weeks is recommended." },
        { question: "How much does a photographer cost in Helsinki?", answer: "The base packages start from EUR 99 / 2 hours for solo sessions and EUR 139 / 2 hours for two people or couples. Final details may shift slightly with the actual plan, group size, and delivery needs." },
        { question: "Is it worth hiring a photographer in Helsinki?", answer: "If you want to keep a trip, graduation, anniversary, or even an ordinary day, yes. A local photographer knows the light, weather, walkable areas, and quieter angles, so the photos can feel more like your real day than simple check-in shots." },
        { question: "What happens on the shoot day and when do I receive photos?", answer: "Please arrive about 10 minutes early so we can confirm the goal and rhythm. Photos are usually delivered within five days. Rush delivery can be discussed for an extra fee." },
        { question: "Can we shoot on cloudy days?", answer: "Yes. Cloudy light is often good for portraits. Snow or light rain can also work with an extra EUR 5 / hour. For bad weather, we can reschedule or cancel for free." },
        { question: "How do payment and cancellation work?", answer: "A 50% deposit confirms the slot. If you cancel more than 24 hours before the shoot, the deposit is refundable. Within 24 hours, it is not refundable. WeChat, Alipay, Revolut, and MobilePay are supported." },
        { question: "What if I am late?", answer: "I will wait at the agreed place, but the session time starts from the agreed start time rather than your actual arrival time. Please arrive on time so the full two hours can be used for shooting." },
        { question: "What if I do not like the retouching style?", answer: "We can first discuss a second editing round. If you are still unhappy after careful second-round editing, you can request a refund." },
        { question: "Can we shoot outside Helsinki?", answer: "Yes. I am based in Helsinki, but sessions are not limited to Finland. For other European cities or Asia travel sessions, travel, accommodation, tickets, and necessary transfer costs need to be covered." },
        { question: "What is included in delivery?", answer: "The base package includes selected JPG originals, 9 retouched photos, and RAW files for those 9 retouched photos. Extra retouching is EUR 2 / photo, and extra time is EUR 40 / hour." },
        { question: "Should I prepare outfits in advance?", answer: "It helps to think about color and layers ahead of time. Helsinki can be windy, so coats, scarves, or easy layering pieces often work well. If you are unsure, you can send me options to discuss." },
        { question: "Will my photos be published?", answer: "Not by default. Without your consent, I will not post your photos on the website, Xiaohongshu, or other public platforms." },
      ],
    },
    footer: {
      title: "Travel photographer / Based in Helsinki",
      notice: "Images on this site may not be used, copied, downloaded, reposted, used for training, or used commercially without permission. Please use the booking entry above for inquiries.",
      booking: "Booking",
      top: "Back to top",
    },
  },
} as const

function SessionImage({ className = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      {...props}
      draggable={false}
      onContextMenu={(event) => event.preventDefault()}
      className={`${className} select-none`}
    />
  )
}

const getMomentTileClass = (photoCount: number, index: number) => {
  if (photoCount >= 5) {
    return [
      "col-span-3 row-span-2",
      "col-span-3 row-span-2",
      "col-span-3 row-span-2",
      "col-span-3 row-span-2",
      "col-span-6 row-span-2",
    ][index] ?? "col-span-6 row-span-2"
  }

  if (photoCount === 4) {
    return [
      "col-span-3 row-span-3",
      "col-span-3 row-span-3",
      "col-span-3 row-span-3",
      "col-span-3 row-span-3",
    ][index] ?? "col-span-3 row-span-3"
  }

  if (photoCount === 3) {
    return [
      "col-span-3 row-span-3",
      "col-span-3 row-span-3",
      "col-span-6 row-span-3",
    ][index] ?? "col-span-6 row-span-3"
  }

  if (photoCount === 2) {
    return "col-span-6 row-span-3"
  }

  return "col-span-6 row-span-6"
}

function MomentPhotoMosaic({
  photos,
  eager = false,
  imageFit = "cover",
}: {
  photos: MomentCard[]
  eager?: boolean
  imageFit?: "cover" | "contain"
}) {
  const visiblePhotos = photos.slice(0, 5)

  return (
    <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 gap-1.5 p-1.5">
      {visiblePhotos.map((photo, index) => (
        <figure
          key={`${photo.id}-${index}`}
          className={`${getMomentTileClass(visiblePhotos.length, index)} overflow-hidden rounded-[3px] bg-[#050505]`}
        >
          <SessionImage
            src={photo.src}
            alt={photo.alt}
            className={`h-full w-full object-center transition duration-700 group-hover:scale-[1.025] ${
              imageFit === "contain" ? "object-contain" : "object-cover"
            }`}
            loading={eager || index < 2 ? "eager" : "lazy"}
          />
        </figure>
      ))}
    </div>
  )
}

function getMomentPlaceLabel(group: MomentGroup) {
  if (group.id === "jianji-xinyi") return "Barcelona / Croatia"
  return group.place
}

function getMomentTypeLabel(group: MomentGroup, locale: Locale) {
  if (group.id === "jianji-xinyi") return photoSessionCopy[locale].momentTypeCouple
  return ""
}

function MomentGroupFrame({
  group,
  eager = false,
  className = "",
  imageFit = "cover",
  locale = "zh",
}: {
  group: MomentGroup
  eager?: boolean
  className?: string
  imageFit?: "cover" | "contain"
  locale?: Locale
}) {
  const typeLabel = getMomentTypeLabel(group, locale)

  return (
    <article
      className={`group relative min-h-[56svh] min-w-[82vw] snap-center overflow-hidden rounded-md bg-white/[0.045] shadow-[0_26px_90px_-70px_rgba(255,255,255,0.35)] sm:min-w-[58vw] lg:min-h-0 lg:min-w-0 ${className}`}
    >
      <MomentPhotoMosaic photos={group.photos} eager={eager} imageFit={imageFit} />
      {!group.hideCaption && (
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.82))] px-4 pb-4 pt-20">
          <p className="text-sm font-semibold uppercase tracking-normal text-white/82">{getMomentPlaceLabel(group)}</p>
          {typeLabel && <p className="mt-1 text-xs font-semibold text-white/58">{typeLabel}</p>}
        </div>
      )}
    </article>
  )
}

const coverPhoto: Photo = {
  id: "cover-florence",
  src: "/photo-session/cover-florence.jpg",
  alt: "Travel portrait session cover photo",
}

const galleryPhotos: Photo[] = [
  coverPhoto,
  {
    id: "master-1",
    src: "/private/master1.jpg",
    alt: "Soft portrait sample",
  },
  {
    id: "master-2",
    src: "/private/master2.jpg",
    alt: "City walk portrait sample",
  },
  {
    id: "master-3",
    src: "/private/master3.jpg",
    alt: "Travel portrait sample",
  },
  {
    id: "master-4",
    src: "/private/master4.jpg",
    alt: "Editorial portrait sample",
  },
  {
    id: "independent",
    src: "/private/independent.jpg",
    alt: "Quiet portrait sample",
  },
]

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

const shootSteps: ShootStep[] = [
  {
    eyebrow: "01 / Route",
    title: "路线可以我定，也可以你定",
    body: "路线优先选，不让转场吃掉拍摄时间。我会按时间、光线和转场安排路线，你也可以提供自己的路线。",
    image: coverPhoto,
  },
  {
    eyebrow: "02 / Direction",
    title: "不要求你本来就是模特",
    body: "现场会给动作指导。走路、坐下、不看镜头、大头照、游客照，都可以自然完成。",
    image: galleryPhotos[1],
  },
  {
    eyebrow: "03 / Device",
    title: "设备可以很自由",
    body: "我会用自己的设备，也可以用你的设备拍。数码、胶片、CCD、拍立得都可以提前沟通。",
    image: galleryPhotos[3],
  },
  {
    eyebrow: "04 / Local",
    title: "熟悉赫尔辛基现场",
    body: "我在这里生活两年，也是在校学生，更清楚该去哪拍、怎么走、哪段路更适合你。",
    image: galleryPhotos[2],
  },
  {
    eyebrow: "05 / Mood",
    title: "稳定、耐心，也好相处",
    body: "拍摄过程会轻松一点。我可以帮你扛东西和器材，也可以像摄影搭子一样一起行动。",
    image: galleryPhotos[4],
  },
  {
    eyebrow: "06 / Companion",
    title: "可以像地陪一样带你玩",
    body: "如果你愿意，我也可以顺路带你吃吃喝喝，把拍摄变成半天城市散步。",
    image: galleryPhotos[5],
  },
  {
    eyebrow: "07 / Clear rules",
    title: "规则提前写清楚",
    body: "价格、交付、取消和额外费用都会提前确认，网站和小红书也会持续写清楚。",
    image: coverPhoto,
  },
  {
    eyebrow: "08 / Travel",
    title: "全欧可飞，也接受亚洲旅拍",
    body: "你承担对应路费、住宿、门票等成本，我就可以配合远距离路线和旅拍计划。",
    image: galleryPhotos[3],
  },
]

const serviceTypes = [
  { label: "旅拍 / 游客照", icon: MapPin },
  { label: "情侣拍照", icon: Heart },
  { label: "家庭拍照", icon: Users },
  { label: "证件照", icon: Camera },
  { label: "宠物照片", icon: PawPrint },
  { label: "毕业写真", icon: GraduationCap },
  { label: "校园写真", icon: GraduationCap },
]

const languageItems = ["中文", "English", "粤语"]

const briefItems = ["人数", "日期", "大概地点", "想拍的样式"]

const fallbackMomentCards: MomentCard[] = [
  {
    ...coverPhoto,
    title: "Florence overlook",
    place: "Italy / Florence",
    note: "旅途中停下来的一段城市视角。",
    featured: true,
    tags: ["意大利", "旅行感", "城市漫步"],
  },
  {
    ...galleryPhotos[2],
    title: "City walk portrait",
    place: "Helsinki / street",
    note: "不强摆，边走边拍的日常感。",
    featured: false,
    tags: ["赫尔辛基", "城市漫步", "自然街拍"],
  },
  {
    ...galleryPhotos[1],
    title: "Soft portrait",
    place: "Nordic light",
    note: "更安静、靠近人的 portrait。",
    featured: false,
    tags: ["自然街拍", "旅行感"],
  },
  {
    ...galleryPhotos[3],
    title: "Travel portrait",
    place: "Europe",
    note: "适合旅拍、游客照和社交平台画幅。",
    featured: true,
    tags: ["旅行感", "城市漫步"],
  },
  {
    ...galleryPhotos[4],
    title: "Editorial mood",
    place: "Style group",
    note: "我最满意的视觉方向之一。",
    featured: true,
    tags: ["自然街拍", "旅行感"],
  },
  {
    ...galleryPhotos[5],
    title: "Campus / daily",
    place: "Helsinki / Aalto",
    note: "适合校园写真、毕业记录和学生日常。",
    featured: false,
    tags: ["赫尔辛基", "校园", "自然街拍"],
  },
]

const fallbackMomentGroups: MomentGroup[] = [
  {
    id: "fallback-florence",
    title: "Lijie",
    place: "Florence",
    note: "旅行路线上停下来的一组城市人像。",
    featured: true,
    tags: ["意大利", "旅行感", "城市漫步"],
    photos: [fallbackMomentCards[0], fallbackMomentCards[3], fallbackMomentCards[4]],
  },
  {
    id: "fallback-helsinki",
    title: "City walk",
    place: "Helsinki",
    note: "边走边拍，把人和地点放在同一组里。",
    tags: ["赫尔辛基", "自然街拍"],
    photos: [fallbackMomentCards[1], fallbackMomentCards[2], fallbackMomentCards[5]],
  },
]

const localOuterMomentGroup: MomentGroup = {
  id: "quiet-travel-notes",
  title: "Europe",
  place: "Europe",
  note: "",
  tags: ["旅行感", "自然片段"],
  photos: [
    {
      id: "dsc07258-local",
      src: "/photo-session/dsc07258-1280.jpg",
      alt: "A travel portrait beside turquoise mountain water",
      title: "Europe",
      place: "Europe",
      note: "",
      tags: ["旅行感", "自然片段"],
    },
    {
      id: "dsc09183-local",
      src: "/photo-session/dsc09183-2-1280.jpg",
      alt: "A warm low-light portrait of a person reading during travel",
      title: "Europe",
      place: "Europe",
      note: "",
      tags: ["旅行感", "低光"],
    },
  ],
}

const extraWhyMePhotos: MomentCard[] = [
  {
    id: "why-me-dsc06766",
    src: "/photo-session/dsc06766-1280.jpg",
    alt: "A mountain portrait with a camera in a flower field",
    title: "Why me",
    place: "Travel route",
    note: "旅行环境里的人和风景。",
    tags: ["旅拍", "环境人像"],
  },
  {
    id: "why-me-dsc06071",
    src: "/photo-session/dsc06071-1280.jpg",
    alt: "A wide mountain travel portrait overlooking a lake",
    title: "Why me",
    place: "Travel route",
    note: "开阔风景里保留人的比例。",
    tags: ["旅拍", "环境人像"],
  },
]

const testimonials: Testimonial[] = [
  {
    quote: "一开始其实很担心自己不会拍照，但现场不是那种被命令摆姿势的感觉。会边走边调整动作，也会告诉我手放哪里、看哪里，最后照片比我平时自拍自然很多。",
    name: "Z. Li",
    context: "第一次单人约拍",
  },
  {
    quote: "路线不是把景点一个个打卡，而是会看光线和我们当时的状态。拍完有一些远景，也有很多聊天走路时抓到的瞬间，比较像真的旅行记忆。",
    name: "Rico",
    context: "瑞士旅拍",
  },
  {
    quote: "我不太喜欢太正式的毕业照，所以重点放在校园、衣服和当天的情绪上。成片没有很僵，也保留了学校环境，发给家里人和朋友都很合适。",
    name: "H. Jia",
    context: "校园 / 毕业记录",
  },
  {
    quote: "沟通的时候会把价格、加钱项和交付讲清楚，所以拍之前没有那种不确定感。现场也会帮忙看包、看衣服，整体更像有人一起把这件事照顾好。",
    name: "D. Wang",
    context: "旅行人像",
  },
  {
    quote: "我只给了大概想去的地点，最后路线被重新排过，基本没有把时间浪费在乱走上。照片里既有地点，也有人在里面的状态。",
    name: "Junjie",
    context: "旅途中记录",
  },
  {
    quote: "收到图以后最喜欢的是那些没有刻意看镜头的照片。它们不是模板照，更像那天真的发生过的片段，这一点对我来说很重要。",
    name: "M. Chen",
    context: "自然街拍",
  },
]

const packages = [
  {
    name: "单人",
    price: "EUR 99",
    note: "2 小时",
  },
  {
    name: "双人 / 情侣",
    price: "EUR 139",
    note: "2 小时",
  },
  {
    name: "三人",
    price: "EUR 169",
    note: "2 小时",
  },
  {
    name: "四人及以上",
    price: "另议",
    note: "按人数和路线确认",
  },
]

const includedItems = [
  "拍摄前路线和风格沟通",
  "2 小时拍摄与动作引导",
  "筛选后 JPG 底片",
  "9 张精修",
  "9 张精修图对应 RAW 文件",
]

const boundaryItems = [
  "续时 EUR 40 / 小时；额外精修 EUR 2 / 张",
  "下雪或小雨如确认继续拍摄，加 EUR 5 / 小时",
  "旅拍、远距离地点、门票和交通费需实报实销",
  "精心二次后期后仍不满意，可以要求退款",
  "妆发需自理；未经同意不会公开发布照片",
]

const bookingProcessItems = [
  "私信沟通并选定套餐",
  "约定时间和地点，拍摄当天提前会合",
  "拍完后五天以内返回照片；加钱可加急",
]

const faqs = [
  {
    question: "可以拍视频吗？",
    answer: "目前只接照片拍摄，不接正式视频拍摄。我的重点会放在静态照片里的人物状态、地点感和旅行氛围。",
  },
  {
    question: "预约之后会发生什么？",
    answer: "确认预约后，我会和你对齐套餐、集合点、拍摄时间、穿搭和想要的感觉。拍摄前可以继续私信沟通，把不确定的地方先处理掉。",
  },
  {
    question: "需要提前多久预约？",
    answer: "建议至少提前一周来问，旺季或旅行日期比较固定时最好提前四周。临时约也可以问，但不保证一定能接；如果是求婚、惊喜或需要隐藏安排的拍摄，建议至少提前两周。",
  },
  {
    question: "赫尔辛基约拍多少钱？",
    answer: "基础价格按上面的套餐走：单人 EUR 99 / 2 小时起，双人 / 情侣 EUR 139 / 2 小时起。具体情况会按实际拍摄安排、人数和交付需求略微调整，确认前会先说清楚。",
  },
  {
    question: "在赫尔辛基找摄影师值得吗？",
    answer: "如果你希望把旅行、毕业、纪念日或普通的一天留下来，是值得的。当地摄影师会更熟悉光线、天气、适合走路的区域和不太挤的角度，照片会比单纯打卡更像你那天真实的状态。",
  },
  {
    question: "拍摄当天和交付时间是怎样的？",
    answer: "拍摄当天建议提前 10 分钟到集合点，先确认当天目标和节奏。拍完后一般五天以内返回照片；如果你需要更快拿到图，可以提前说，加急会单独加钱。",
  },
  {
    question: "阴天还能拍吗？",
    answer: "阴天可以正常拍，柔光反而适合人像。下雪或小雨也可以拍，但会加 EUR 5 / 小时；恶劣天气可以免费改期或取消。",
  },
  {
    question: "怎么付款和取消？",
    answer: "确认档期需要支付总价 50% 订金。拍摄前 24 小时外取消可退订金，24 小时内取消订金不退。支持微信、支付宝、Revolut、MobilePay。",
  },
  {
    question: "如果我迟到了怎么办？",
    answer: "我会在约定地点等你，但拍摄时间会从我们约定的开始时间计时，不会从你实际到达后重新开始。请尽量准时到达，这样 2 小时才会完整用在拍摄上。",
  },
  {
    question: "如果精修风格不满意呢？",
    answer: "可以先沟通二次后期。如果精心二次后期之后你仍然不满意，可以要求退款。",
  },
  {
    question: "可以去赫尔辛基以外吗？",
    answer: "可以。Base赫尔辛基，但拍摄不只限芬兰，全欧可飞。远距离路线、欧洲其他城市或亚洲旅拍，需要你承担对应路费、住宿、门票和必要转场费用。",
  },
  {
    question: "交付包含什么？",
    answer: "基础包含筛选后 JPG 底片、9 张精修，以及 9 张精修图对应 RAW 文件。额外精修 EUR 2 / 张，续时 EUR 40 / 小时。",
  },
  {
    question: "衣服需要提前准备吗？",
    answer: "建议提前看颜色和层次。赫尔辛基风大，外套、围巾或能随手搭的单品会更好拍；如果你不确定，也可以把衣服发给我一起看。",
  },
  {
    question: "照片会被公开发布吗？",
    answer: "不会默认公开。未经你同意，我不会把你的照片发布到网站、小红书或其他公开平台。",
  },
]

export function HelsinkiPhotoSession() {
  const router = useRouter()
  const { locale, setLocale } = useI18n()
  const pageLocale: Locale = locale === "en" ? "en" : "zh"
  const copy = photoSessionCopy[pageLocale]
  const [isEntering, setIsEntering] = useState(true)
  const [isLeaving, setIsLeaving] = useState(false)
  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [activeLocationId, setActiveLocationId] = useState(locations[0].id)
  const [momentGroups, setMomentGroups] = useState<MomentGroup[]>(fallbackMomentGroups)
  const [whyMePhotos, setWhyMePhotos] = useState<MomentCard[]>([])
  const [momentScrollStage, setMomentScrollStage] = useState(0)
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
  const [bookingMessage, setBookingMessage] = useState("")
  const [mapReady, setMapReady] = useState(false)
  const scrollAnimationRef = useRef<number | null>(null)
  const highlightRefs = useRef<Array<HTMLParagraphElement | null>>([])
  const stepRefs = useRef<Array<HTMLElement | null>>([])
  const locationRefs = useRef<Array<HTMLElement | null>>([])
  const testimonialScrollerRef = useRef<HTMLDivElement | null>(null)
  const momentsSectionRef = useRef<HTMLElement | null>(null)
  const mapRootRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const displayShootSteps = useMemo(
    () =>
      shootSteps.map((step, index) => ({
        ...step,
        title: copy.process.steps[index]?.title || step.title,
        body: copy.process.steps[index]?.body || step.body,
      })),
    [copy],
  )
  const displayLocations = useMemo(
    () =>
      locations.map((location, index) => ({
        ...location,
        place: copy.locations.points[index]?.place || location.place,
        bestTime: copy.locations.points[index]?.bestTime || location.bestTime,
      })),
    [copy],
  )
  const activeStep = displayShootSteps[activeStepIndex] ?? displayShootSteps[0]
  const activeLocation = locations.find((location) => location.id === activeLocationId) ?? locations[0]
  const activeDisplayLocation = displayLocations.find((location) => location.id === activeLocationId) ?? displayLocations[0]
  const selectedPackage = copy.pricing.packages[selectedPackageIndex] ?? copy.pricing.packages[0]
  const primaryMomentGroups = useMemo(() => {
    const groups = momentGroups.filter(
      (group) => !["lijie", "jianji-xinyi", "hongjia-oeschinen"].includes(group.id) && group.photos.length >= 2,
    )
    return [localOuterMomentGroup, ...(groups.length > 0 ? groups : fallbackMomentGroups)]
  }, [momentGroups])
  const featureMomentGroups = useMemo(() => {
    const orderedGroups = ["jianji-xinyi"]
      .map((id) => momentGroups.find((group) => group.id === id))
      .filter((group): group is MomentGroup => Boolean(group))
    return orderedGroups.length > 0 ? orderedGroups : primaryMomentGroups.slice(0, 4)
  }, [momentGroups, primaryMomentGroups])
  const lijiePhotos = useMemo(() => momentGroups.find((group) => group.id === "lijie")?.photos ?? [], [momentGroups])
  const aboutPhoto = useMemo(() => {
    return lijiePhotos[0] || coverPhoto
  }, [lijiePhotos])
  const aboutVisualPhotos = useMemo(() => {
    const seen = new Set<string>()
    const photos = (lijiePhotos.length > 0 ? lijiePhotos : [aboutPhoto]).filter((photo) => {
      if (!photo?.src || seen.has(photo.src)) return false
      seen.add(photo.src)
      return true
    })
    return photos.length > 0 ? photos : [coverPhoto]
  }, [aboutPhoto, lijiePhotos])
  const activeAboutPhoto = aboutVisualPhotos[activeHighlightIndex % aboutVisualPhotos.length] ?? aboutPhoto
  const shootVisualPhotos = useMemo(() => {
    const fallbackPhotos = shootSteps.map((step, index) => {
      const extraIndex = index - (shootSteps.length - extraWhyMePhotos.length)
      return extraWhyMePhotos[extraIndex] ?? step.image
    })
    const basePhotos = whyMePhotos.length > 0 ? [...whyMePhotos, ...extraWhyMePhotos, ...fallbackPhotos] : fallbackPhotos
    const seen = new Set<string>()
    return basePhotos.filter((photo) => {
      if (!photo.src || seen.has(photo.src)) return false
      seen.add(photo.src)
      return true
    }).slice(0, shootSteps.length)
  }, [whyMePhotos])
  const activeShootPhoto = shootVisualPhotos[activeStepIndex % shootVisualPhotos.length] ?? activeStep.image

  const updateBookingField = (field: keyof typeof bookingForm, value: string) => {
    setBookingForm((current) => ({ ...current, [field]: value }))
  }

  const handleBookingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBookingStatus("sending")
    setBookingMessage("")

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
      setBookingMessage(
        pageLocale === "en"
          ? payload.emailSent
            ? copy.form.sentMessage
            : copy.form.loggedMessage
          : String(payload.message || copy.form.sentMessage),
      )
      setIsEmailFormOpen(false)
    } catch (error) {
      setBookingStatus("error")
      setBookingMessage(pageLocale === "en" ? copy.form.errorMessage : String((error as Error).message || copy.form.errorMessage))
    }
  }

  useEffect(() => {
    let cancelled = false

    const loadTaggedMoments = async () => {
      try {
        const response = await fetch("/api/photo-session-moments?limit=8", { cache: "no-store" })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(String(payload.error || "Failed to load photo session moments"))
        }

        const isMomentCard = (moment: unknown): moment is MomentCard => {
          const card = moment as Partial<MomentCard> | null
          return Boolean(
            card &&
              typeof card.id === "string" &&
              typeof card.src === "string" &&
              typeof card.alt === "string" &&
              typeof card.title === "string" &&
              typeof card.place === "string" &&
              typeof card.note === "string" &&
              Array.isArray(card.tags),
          )
        }
        const groups: MomentGroup[] = (Array.isArray(payload.groups) ? payload.groups : [])
          .map((group: unknown): MomentGroup | null => {
            const candidate = group as Partial<MomentGroup> | null
            const photos = (candidate && Array.isArray(candidate.photos) ? candidate.photos : []).filter(isMomentCard)
            if (
              !candidate ||
              typeof candidate.id !== "string" ||
              typeof candidate.title !== "string" ||
              typeof candidate.place !== "string" ||
              typeof candidate.note !== "string" ||
              !Array.isArray(candidate.tags) ||
              photos.length === 0
            ) {
              return null
            }

            return {
              id: candidate.id,
              title: candidate.title,
              place: candidate.place,
              note: candidate.note,
              featured: Boolean(candidate.featured),
              photoCount: Number(candidate.photoCount || photos.length),
              tags: candidate.tags.filter((tag: unknown): tag is string => typeof tag === "string"),
              photos,
            }
          })
          .filter((group: MomentGroup | null): group is MomentGroup => Boolean(group))

        const aboutCard = isMomentCard(payload.aboutPhoto) ? payload.aboutPhoto : null
        const cards: MomentCard[] = (Array.isArray(payload.moments) ? payload.moments : []).filter(isMomentCard)
        const nextWhyMePhotos: MomentCard[] = (Array.isArray(payload.whyMePhotos) ? payload.whyMePhotos : []).filter(isMomentCard)

        if (!cancelled && nextWhyMePhotos.length > 0) {
          setWhyMePhotos(nextWhyMePhotos)
        }

        if (!cancelled && groups.length > 0) {
          if (aboutCard && !groups.some((group) => group.id === "lijie")) {
            setMomentGroups([
              ...groups,
              {
                id: "lijie",
                title: "Lijie",
                place: aboutCard.place,
                note: "About 区域使用的本人照片。",
                featured: aboutCard.featured,
                photoCount: 1,
                tags: aboutCard.tags,
                photos: [aboutCard],
              },
            ])
            return
          }

          setMomentGroups(groups)
          return
        }

        if (!cancelled && cards.length > 0) {
          setMomentGroups([
            {
              id: "loaded-moments",
              title: "People",
              place: "Travel routes",
              note: "按图片标签加载的人像组合。",
              featured: cards.some((card) => card.featured),
              photoCount: cards.length,
              tags: Array.from(new Set(cards.flatMap((card) => card.tags))).slice(0, 4),
              photos: cards,
            },
          ])
        }
      } catch (error) {
        console.warn("Failed to load tagged photo session moments:", error)
      }
    }

    loadTaggedMoments()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const scroller = testimonialScrollerRef.current
    if (!scroller) return

    const timer = window.setInterval(() => {
      const step = Math.max(280, Math.round(scroller.clientWidth * 0.72))
      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth
      const nextLeft = scroller.scrollLeft + step >= maxScrollLeft - 8 ? 0 : scroller.scrollLeft + step
      scroller.scrollTo({ left: nextLeft, behavior: "smooth" })
    }, 4200)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setIsEntering(false), 80)
    return () => {
      window.clearTimeout(timer)
      if (scrollAnimationRef.current !== null) {
        window.cancelAnimationFrame(scrollAnimationRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const updateMomentStage = () => {
      const node = momentsSectionRef.current
      if (!node) return

      const rect = node.getBoundingClientRect()
      const scrollable = Math.max(rect.height - window.innerHeight, 1)
      const progress = Math.min(1, Math.max(0, -rect.top / scrollable))
      setMomentScrollStage(progress)
    }

    updateMomentStage()
    window.addEventListener("scroll", updateMomentStage, { passive: true })
    window.addEventListener("resize", updateMomentStage)
    return () => {
      window.removeEventListener("scroll", updateMomentStage)
      window.removeEventListener("resize", updateMomentStage)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

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
      markersLayerRef.current = leaflet.layerGroup().addTo(map)
      window.requestAnimationFrame(() => {
        map.invalidateSize()
        map.fitBounds(bounds.pad(0.18), { animate: false })
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
      window.removeEventListener("resize", handleResize)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersLayerRef.current = null
      }
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const syncMarkers = async () => {
      if (!mapReady || !mapRef.current || !markersLayerRef.current) return
      const leaflet = await import("leaflet")
      if (cancelled || !mapRef.current || !markersLayerRef.current) return

      markersLayerRef.current.clearLayers()
      leaflet
        .polyline(
          locations.map((location) => [location.lat, location.lng]),
          {
            color: "#355d63",
            weight: 2,
            opacity: 0.56,
            dashArray: "6 10",
          },
        )
        .addTo(markersLayerRef.current)

      locations.forEach((location, index) => {
        const isActive = location.id === activeLocationId
        const marker = leaflet.marker([location.lat, location.lng], {
            icon: leaflet.divIcon({
              className: "",
              iconSize: [34, 34],
              iconAnchor: [17, 17],
              html: `<span style="display:flex;height:34px;width:34px;align-items:center;justify-content:center;border-radius:9999px;border:2px solid #20231f;background:${isActive ? "#d7c4a5" : "#355d63"};color:${isActive ? "#20231f" : "#fff"};font-size:14px;font-weight:700;box-shadow:0 14px 34px -18px rgba(32,35,31,.9);">${index + 1}</span>`,
            }),
          })
          .on("click", () => {
            setActiveLocationId(location.id)
            mapRef.current?.setView([location.lat, location.lng], Math.max(mapRef.current.getZoom(), 13), { animate: true })
          })
          .on("mouseover", () => setActiveLocationId(location.id))
          .addTo(markersLayerRef.current)

        marker.bindTooltip(`${index + 1}. ${location.name}`, {
          permanent: isActive,
          direction: "top",
          offset: [0, -10],
          opacity: 0.96,
          className: "photo-session-map-tooltip",
        })
      })
    }

    void syncMarkers()
    return () => {
      cancelled = true
    }
  }, [activeLocationId, mapReady])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    mapRef.current.setView([activeLocation.lat, activeLocation.lng], Math.max(mapRef.current.getZoom(), 13), { animate: true })
  }, [activeLocation.lat, activeLocation.lng, mapReady])

  useEffect(() => {
    const updateActiveHighlightFromScroll = () => {
      const candidates = highlightRefs.current
        .map((node, index) => (node ? { node, index } : null))
        .filter((item): item is { node: HTMLParagraphElement; index: number } => Boolean(item))
      if (candidates.length === 0) return

      const anchor = window.innerHeight * 0.46
      const nearest = candidates.reduce<{ index: number; distance: number } | null>((best, item) => {
        const rect = item.node.getBoundingClientRect()
        const target = rect.top + rect.height * 0.5
        const distance = Math.abs(target - anchor)
        return !best || distance < best.distance ? { index: item.index, distance } : best
      }, null)

      if (!nearest) return
      setActiveHighlightIndex((current) => (current === nearest.index ? current : nearest.index))
    }

    updateActiveHighlightFromScroll()
    window.addEventListener("scroll", updateActiveHighlightFromScroll, { passive: true })
    window.addEventListener("resize", updateActiveHighlightFromScroll)
    return () => {
      window.removeEventListener("scroll", updateActiveHighlightFromScroll)
      window.removeEventListener("resize", updateActiveHighlightFromScroll)
    }
  }, [pageLocale])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]
        const id = visibleEntry?.target.getAttribute("data-location-id")
        if (id) setActiveLocationId(id)
      },
      { rootMargin: "-36% 0px -42% 0px", threshold: [0.2, 0.45, 0.7] },
    )

    locationRefs.current.forEach((node) => {
      if (node) observer.observe(node)
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const updateActiveStepFromScroll = () => {
      const candidates = stepRefs.current
        .map((node, index) => (node ? { node, index } : null))
        .filter((item): item is { node: HTMLElement; index: number } => Boolean(item))
      if (candidates.length === 0) return

      const anchor = window.innerHeight * 0.46
      const nearest = candidates.reduce<{ index: number; distance: number } | null>((best, item) => {
        const rect = item.node.getBoundingClientRect()
        const target = rect.top + rect.height * 0.42
        const distance = Math.abs(target - anchor)
        return !best || distance < best.distance ? { index: item.index, distance } : best
      }, null)

      if (!nearest) return
      setActiveStepIndex((current) => (current === nearest.index ? current : nearest.index))
    }

    updateActiveStepFromScroll()
    window.addEventListener("scroll", updateActiveStepFromScroll, { passive: true })
    window.addEventListener("resize", updateActiveStepFromScroll)
    return () => {
      window.removeEventListener("scroll", updateActiveStepFromScroll)
      window.removeEventListener("resize", updateActiveStepFromScroll)
    }
  }, [])

  const handleSectionLink = (sectionId: string) => (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const target = document.getElementById(sectionId)
    if (!target) return

    if (scrollAnimationRef.current !== null) {
      window.cancelAnimationFrame(scrollAnimationRef.current)
    }

    const startY = window.scrollY
    const documentHeight = document.documentElement.scrollHeight
    const viewportHeight = window.innerHeight
    const targetY = Math.min(target.getBoundingClientRect().top + startY, documentHeight - viewportHeight)
    const distance = targetY - startY
    const duration = Math.min(1100, Math.max(620, Math.abs(distance) * 0.08))
    const startTime = window.performance.now()
    const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3)

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration)
      window.scrollTo(0, startY + distance * easeOutCubic(progress))

      if (progress < 1) {
        scrollAnimationRef.current = window.requestAnimationFrame(step)
        return
      }

      scrollAnimationRef.current = null
      window.history.replaceState(null, "", `#${sectionId}`)
    }

    scrollAnimationRef.current = window.requestAnimationFrame(step)
  }

  const handlePortfolioLink = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsLeaving(true)
    window.setTimeout(() => {
      router.push("/portfolio?from=photo-session")
    }, 420)
  }

  const handleLanguageToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setLocale(pageLocale === "zh" ? "en" : "zh")
  }

  const handleScrollTop = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (scrollAnimationRef.current !== null) {
      window.cancelAnimationFrame(scrollAnimationRef.current)
    }
    window.scrollTo({ top: 0, behavior: "smooth" })
    window.history.replaceState(null, "", window.location.pathname)
  }

  return (
    <main
      className="min-h-screen select-none bg-[#f5f2ec] font-['Manrope'] text-[#151612]"
      onDragStart={(event) => event.preventDefault()}
    >
      <div
        className={`pointer-events-none fixed inset-0 z-[10000] bg-white transition-opacity duration-500 ease-out ${
          isEntering || isLeaving ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      <button
        type="button"
        className="fixed right-4 top-4 z-50 inline-flex h-10 items-center gap-2 rounded-md border border-white/28 bg-black/42 px-3 text-sm font-semibold text-white shadow-[0_18px_42px_-28px_rgba(0,0,0,0.82)] backdrop-blur transition hover:bg-black/58 sm:right-6 sm:top-6"
        onClick={handleLanguageToggle}
        aria-label={copy.languageLabel}
        title={copy.languageLabel}
      >
        <Languages className="h-4 w-4" />
        {copy.languageButton}
      </button>

      <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-[#050505] text-white">
        <SessionImage
          src={coverPhoto.src}
          alt={coverPhoto.alt}
          className="absolute inset-0 h-full w-full object-cover opacity-75"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.86)_0%,rgba(0,0,0,0.48)_48%,rgba(0,0,0,0.14)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.92))]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-[18svh] pt-28 sm:px-8 lg:pb-[20svh]">
          <div className="max-w-6xl">
            <h1 className="mt-4 max-w-6xl text-5xl font-semibold leading-[0.94] tracking-normal text-white sm:text-7xl lg:text-[6.8rem]">
              {copy.hero.title}
            </h1>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button type="button" className="h-11 rounded-md bg-white px-5 text-[#151612] hover:bg-white/90" onClick={handleSectionLink("moments")}>
                <ArrowDown className="h-4 w-4" />
                {copy.hero.samples}
              </Button>
              <Button type="button" variant="secondary" className="h-11 rounded-md bg-white/12 px-5 text-white hover:bg-white/20" onClick={handlePortfolioLink}>
                <Images className="h-4 w-4" />
                {copy.hero.portfolio}
              </Button>
              <Button type="button" variant="secondary" className="h-11 rounded-md bg-white/12 px-5 text-white hover:bg-white/20" onClick={handleSectionLink("contact")}>
                <MessageCircle className="h-4 w-4" />
                {copy.hero.booking}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="story" className="bg-[#050505] px-5 py-24 text-white sm:px-8 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.42fr_0.58fr]">
          <div className="lg:sticky lg:top-24 lg:h-fit">
            <p className="text-sm font-semibold uppercase text-white/40">{copy.about.eyebrow}</p>
            <h2 className="mt-3 max-w-md text-4xl font-semibold leading-tight sm:text-5xl">
              {copy.about.title}
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/55">
              {copy.about.body}
            </p>
            <figure className="mt-8 max-w-md overflow-hidden rounded-md bg-[#050505] shadow-[0_26px_90px_-62px_rgba(255,255,255,0.45)]">
              <div className="relative flex h-[42svh] min-h-[280px] max-h-[430px] items-center justify-center overflow-hidden bg-[#050505]">
                {aboutVisualPhotos.map((photo, index) => (
                  <SessionImage
                    key={`${photo.id}-${photo.src}`}
                    src={photo.src}
                    alt={photo.alt}
                    className={`absolute left-1/2 top-1/2 max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 object-contain transition duration-700 ${
                      activeAboutPhoto.src === photo.src ? "scale-100 opacity-100" : "scale-[0.985] opacity-0"
                    }`}
                  />
                ))}
              </div>
            </figure>
          </div>
          <div className="space-y-[15svh] pb-[8svh]">
            {copy.about.highlightLines.map((line, index) => (
              <p
                key={line}
                ref={(node) => {
                  highlightRefs.current[index] = node
                }}
                data-highlight-index={index}
                className={`max-w-4xl text-4xl font-semibold leading-tight transition duration-500 sm:text-6xl ${
                  activeHighlightIndex === index ? "text-white" : "text-white/20"
                }`}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section id="moments" ref={momentsSectionRef} className="relative min-h-[190svh] bg-[#050505] text-white">
        <div className="sticky top-0 flex min-h-[100svh] items-center overflow-hidden px-5 py-16 sm:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <div className="relative min-h-[78svh]">
              <div
                className="absolute inset-0 transition duration-700 ease-out"
                style={{
                  opacity: Math.max(0, 1 - momentScrollStage * 1.65),
                  transform: `translateY(${-momentScrollStage * 26}px) scale(${1 - momentScrollStage * 0.025})`,
                }}
              >
                <div className="min-h-[78svh]">
                  <div className="flex snap-x items-start gap-4 overflow-x-auto pb-4 [scrollbar-width:none] lg:grid lg:min-h-[78svh] lg:grid-cols-3 lg:grid-rows-2 lg:items-stretch lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
                    {primaryMomentGroups.slice(0, 6).map((group, index) => (
                      <MomentGroupFrame
                        key={group.id}
                        group={group}
                        eager={index < 2}
                        locale={pageLocale}
                        className="h-[56svh] min-h-[430px] lg:h-auto"
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div
                className="absolute inset-0 transition duration-700 ease-out"
                style={{
                  opacity: Math.min(1, Math.max(0, (momentScrollStage - 0.38) / 0.42)),
                  transform: `translateY(${Math.max(0, 1 - momentScrollStage) * 32}px) scale(${0.985 + Math.min(1, momentScrollStage) * 0.015})`,
                  pointerEvents: momentScrollStage > 0.46 ? "auto" : "none",
                }}
              >
                <div className="flex min-h-[78svh] snap-x gap-4 overflow-x-auto pb-4 [scrollbar-width:none] lg:grid lg:grid-cols-1 lg:grid-rows-1 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
                  {featureMomentGroups.slice(0, 1).map((group, index) => (
                    <MomentGroupFrame
                      key={`${group.id}-featured`}
                      group={group}
                      eager={index === 0}
                      imageFit="contain"
                      locale={pageLocale}
                      className="h-[64svh] min-h-[480px] lg:h-auto"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="process" className="border-y border-[#24251f] bg-[#0b0c0a] px-5 py-20 text-white sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.46fr_0.54fr]">
            <div className="space-y-8">
              <div>
                <p className="text-sm font-semibold uppercase text-white/40">{copy.process.eyebrow}</p>
                <h2 className="mt-3 max-w-xl text-4xl font-semibold leading-tight sm:text-6xl">
                  {copy.process.title}
                </h2>
              </div>

              <div className="relative pb-[10svh] pt-4">
                <div className="pointer-events-none absolute bottom-0 left-[1.1rem] top-4 hidden w-px bg-white/12 sm:block" />
                {displayShootSteps.map((step, index) => (
                  <article
                    key={step.title}
                    ref={(node) => {
                      stepRefs.current[index] = node
                    }}
                    data-step-index={index}
                    className={`group relative grid min-h-[36svh] gap-5 border-t border-white/12 py-8 transition duration-500 sm:grid-cols-[3.25rem_minmax(0,1fr)] sm:border-t-0 sm:py-10 ${
                      activeStepIndex === index ? "text-white" : "text-white/35"
                    }`}
                  >
                    <div className="relative flex items-start gap-3 sm:block">
                      <span
                        className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition duration-500 ${
                          activeStepIndex === index
                            ? "border-white bg-white text-[#151612]"
                            : "border-white/20 bg-[#0b0c0a] text-white/42"
                        }`}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="max-w-2xl sm:pt-6">
                      <h3
                        className={`text-3xl font-semibold leading-tight transition duration-500 sm:text-4xl ${
                          activeStepIndex === index ? "translate-x-0 opacity-100" : "translate-x-0 opacity-62"
                        }`}
                      >
                        {step.title}
                      </h3>
                      <p
                        className={`mt-5 max-w-xl text-lg leading-8 transition duration-500 ${
                          activeStepIndex === index ? "text-white/74" : "text-white/38"
                        }`}
                      >
                        {step.body}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

          <div className="lg:sticky lg:top-16 lg:h-[calc(100svh-8rem)]">
            <div className="relative h-[72svh] min-h-[520px] overflow-hidden rounded-md bg-[#050505] lg:h-full">
              <div className="absolute inset-3 flex items-center justify-center overflow-hidden rounded-sm bg-black">
                {shootVisualPhotos.map((photo, index) => {
                  const isActive = activeShootPhoto.src === photo.src

                  return (
                    <SessionImage
                      key={`${photo.id}-${photo.src}-${index}`}
                      src={photo.src}
                      alt={photo.alt}
                      className={`absolute h-full w-full object-contain transition duration-700 ${
                        isActive ? "scale-100 opacity-100" : "scale-[0.985] opacity-0"
                      }`}
                    />
                  )
                })}
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      <section id="options" className="bg-[#efe8dc] px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-sm border-y border-[#20231f] py-10 sm:py-12">
            <div className="pointer-events-none absolute inset-x-0 top-10 border-t border-[#20231f]/12" />
            <div className="pointer-events-none absolute inset-x-0 bottom-10 border-t border-[#20231f]/12" />
            <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-stretch">
              <div className="relative z-10 flex min-h-[430px] flex-col justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase text-[#7a6f62]">{copy.options.eyebrow}</p>
                  <h2 className="mt-5 max-w-md text-6xl font-semibold leading-[0.9] tracking-normal text-[#20231f] sm:text-7xl lg:text-[5.15rem]">
                    {copy.options.titleTop}
                    <br />
                    {copy.options.titleBottom}
                  </h2>
                </div>
              </div>

              <div className="relative z-10 min-h-[430px]">
                <div className="absolute bottom-0 left-0 top-0 hidden w-px bg-[#20231f] lg:block" />
                <div className="flex h-full flex-col justify-between gap-8 lg:pl-9">
                  <div className="rounded-md border border-[#20231f] bg-[#f5efe4] p-5">
                    <div className="flex items-center gap-3 text-[#20231f]">
                      <Camera className="h-5 w-5 text-[#355d63]" />
                      <h3 className="text-xl font-semibold">{copy.options.typesTitle}</h3>
                    </div>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {copy.options.serviceTypes.map((label, index) => {
                        const Icon = serviceTypes[index]?.icon || Camera
                        return (
                          <span key={label} className="inline-flex items-center gap-2 border-t border-[#20231f]/18 pt-3 text-base font-semibold text-[#20231f]">
                            <Icon className="h-4 w-4 text-[#355d63]" />
                            <span className="font-mono text-xs text-[#b9aa94]">0{index + 1}</span>
                            {label}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-[0.78fr_1.22fr]">
                    <div className="rounded-md border border-[#20231f]/40 bg-[#f5efe4] p-5">
                      <div className="flex items-center gap-2 text-[#355d63]">
                        <Languages className="h-5 w-5" />
                        <h3 className="text-xl font-semibold text-[#20231f]">{copy.options.languagesTitle}</h3>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {copy.options.languageItems.map((item) => (
                          <span key={item} className="rounded-full border border-[#20231f]/24 bg-[#efe8dc] px-4 py-2 text-sm font-semibold text-[#20231f]">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-md border border-[#20231f]/40 bg-[#f5efe4] p-5">
                      <div className="flex items-center gap-2 text-[#355d63]">
                        <CalendarDays className="h-5 w-5" />
                        <h3 className="text-xl font-semibold text-[#20231f]">{copy.options.briefTitle}</h3>
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {copy.options.briefItems.map((item, index) => (
                          <div key={item} className="flex items-center gap-3 border-t border-[#20231f]/18 pt-3">
                            <span className="font-mono text-xs text-[#9b8b78]">0{index + 1}</span>
                            <span className="text-sm font-semibold text-[#20231f]">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="locations" className="bg-[#f5f2ec] px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 grid gap-4 lg:grid-cols-[0.38fr_0.62fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase text-[#7a6f62]">{copy.locations.eyebrow}</p>
              <h2 className="mt-3 max-w-md text-4xl font-semibold leading-tight sm:text-5xl">
                {copy.locations.title}
              </h2>
            </div>
            <p className="max-w-xl leading-7 text-[#676256]">
              {copy.locations.body}
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[0.58fr_0.42fr]">
            <div className="grid gap-3 lg:order-2 lg:max-h-[calc(100svh-8rem)] lg:overflow-y-auto lg:pr-1">
              {displayLocations.map((location, index) => (
                <article
                  key={location.id}
                  ref={(node) => {
                    locationRefs.current[index] = node
                  }}
                  data-location-id={location.id}
                  className={`rounded-md border p-5 transition duration-500 ${
                    activeLocationId === location.id
                      ? "border-[#20231f] bg-white shadow-[0_24px_70px_-48px_rgba(32,35,31,0.7)]"
                      : "border-[#ded4c6] bg-white/60 text-[#7a6f62]"
                  }`}
                  onMouseEnter={() => setActiveLocationId(location.id)}
                >
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
                        activeLocationId === location.id ? "bg-[#20231f] text-white" : "bg-[#f0e8da] text-[#4e493f]"
                      }`}
                      onClick={() => setActiveLocationId(location.id)}
                      aria-label={`Focus ${location.name}`}
                    >
                      {index + 1}
                    </button>
                    <div>
                      <h3 className="text-xl font-semibold leading-tight text-[#20231f]">
                        <a href={location.href} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                          {location.name}
                        </a>
                      </h3>
                      <p className="mt-2 text-sm text-[#7a6f62]">{location.place}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="lg:sticky lg:top-16 lg:order-1 lg:h-[calc(100svh-8rem)]">
              <div className="relative h-[70svh] min-h-[540px] overflow-hidden rounded-md border border-[#ded4c6] bg-[#dfe9ea] shadow-[0_24px_70px_-58px_rgba(32,35,31,0.55)] lg:h-full">
                <div ref={mapRootRef} className="absolute inset-0 z-0 h-full w-full [&_.leaflet-tooltip.photo-session-map-tooltip]:rounded-md [&_.leaflet-tooltip.photo-session-map-tooltip]:border-[#ded4c6] [&_.leaflet-tooltip.photo-session-map-tooltip]:bg-white/95 [&_.leaflet-tooltip.photo-session-map-tooltip]:px-2.5 [&_.leaflet-tooltip.photo-session-map-tooltip]:py-1.5 [&_.leaflet-tooltip.photo-session-map-tooltip]:text-xs [&_.leaflet-tooltip.photo-session-map-tooltip]:font-semibold [&_.leaflet-tooltip.photo-session-map-tooltip]:text-[#20231f] [&_.leaflet-tooltip.photo-session-map-tooltip]:shadow-sm" />
                <div
                  className={`pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-[#dfe9ea] transition duration-500 ${
                    mapReady ? "opacity-0" : "opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#355d63]">
                    {locations.slice(0, 6).map((location, index) => (
                      <span
                        key={location.id}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[#355d63]/30 bg-white/72"
                      >
                        {index + 1}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(255,250,242,0.05),rgba(32,35,31,0.08))]" />
                <div className="absolute bottom-5 left-5 right-5 z-20 rounded-md bg-white/92 px-4 py-3 text-sm text-[#20231f] shadow-sm backdrop-blur">
                  <p className="font-semibold">{activeDisplayLocation.name}</p>
                  <p className="mt-1 text-xs text-[#676256]">{activeDisplayLocation.place} · {activeDisplayLocation.bestTime}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#050505] px-5 py-24 text-white sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-9 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-white/40">{copy.testimonials.eyebrow}</p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
                {copy.testimonials.title}
              </h2>
            </div>
          </div>

          <div
            ref={testimonialScrollerRef}
            className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-5 [scrollbar-width:none] sm:-mx-8 sm:px-8 [&::-webkit-scrollbar]:hidden"
          >
            {copy.testimonials.items.map((item) => (
              <article
                key={`${item.name}-${item.context}`}
                className="min-w-[82vw] snap-start rounded-md border border-white/10 bg-white/[0.06] p-5 shadow-[0_24px_80px_-70px_rgba(255,255,255,0.45)] sm:min-w-[420px] lg:min-w-[470px]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#d7c4a5] text-sm font-bold text-[#151612]">
                      {item.name.slice(0, 1)}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="mt-0.5 text-xs font-semibold uppercase text-white/38">{item.context}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 text-[#d7c4a5]">
                    {[0, 1, 2, 3, 4].map((star) => (
                      <Star key={star} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </div>
                </div>

                <p className="mt-6 text-[1.05rem] font-semibold leading-8 text-white/88">“{item.quote}”</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-y border-[#ded4c6] bg-[#fffaf2] px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.32fr_0.68fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-[#7a6f62]">{copy.pricing.eyebrow}</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
              {copy.pricing.title}
            </h2>
          </div>
              <div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {copy.pricing.packages.map((item, index) => {
                    const isSelected = selectedPackageIndex === index
                    return (
                <button
                  key={item.name}
                  type="button"
                  className={`rounded-md border p-5 text-left transition ${
                    isSelected
                      ? "border-[#20231f] bg-[#20231f] text-white shadow-[0_24px_70px_-50px_rgba(32,35,31,0.82)]"
                      : "border-[#ded4c6] bg-white hover:border-[#9cb4b7]"
                  }`}
                  onClick={() => setSelectedPackageIndex(index)}
                  aria-pressed={isSelected}
                >
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-4 text-3xl font-semibold">{item.price}</p>
                  <p className={`mt-2 flex items-center gap-2 text-sm ${isSelected ? "text-white/62" : "text-[#676256]"}`}>
                    <Clock className="h-4 w-4" />
                    {item.note}
                  </p>
                </button>
                    )
                  })}
                </div>
                <p className="mt-4 text-sm leading-7 text-[#676256]">
                  {copy.pricing.note}
                </p>
          </div>
        </div>
      </section>

      <section className="bg-[#f5f2ec] px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.34fr_0.66fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-[#7a6f62]">{copy.delivery.eyebrow}</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
              {copy.delivery.title}
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-md border border-[#ded4c6] bg-white p-5">
              <h3 className="font-semibold">{copy.delivery.includedTitle}</h3>
              <ul className="mt-4 grid gap-2 text-sm leading-6 text-[#676256]">
                {copy.delivery.includedItems.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#355d63]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-md border border-[#ded4c6] bg-white p-5">
              <h3 className="font-semibold">{copy.delivery.boundaryTitle}</h3>
              <ul className="mt-4 grid gap-2 text-sm leading-6 text-[#676256]">
                {copy.delivery.boundaryItems.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#355d63]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section id="contact" className="bg-[#f5f2ec] px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.34fr_0.66fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-[#7a6f62]">{copy.contact.eyebrow}</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
              {copy.contact.title}
            </h2>
            <ol className="mt-6 grid gap-3 text-sm leading-6 text-[#676256]">
              {copy.contact.processItems.map((item, index) => (
                <li key={item} className="flex gap-3 rounded-md border border-[#ded4c6] bg-white px-4 py-3">
                  <span className="font-mono text-xs font-semibold text-[#355d63]">0{index + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <a
              href={xhsHref}
              target="_blank"
              rel="noreferrer"
              className="group flex min-h-[220px] flex-col justify-between rounded-md border border-[#20231f] bg-[#20231f] p-5 text-white transition hover:bg-[#2b302a]"
            >
              <div>
                <MessageCircle className="h-6 w-6" />
                <h3 className="mt-5 text-2xl font-semibold">{copy.contact.xhsTitle}</h3>
                <p className="mt-3 text-sm leading-6 text-white/62">{copy.contact.xhsBody}</p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
                {copy.contact.xhsAction}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </a>

            <button
              type="button"
              className="group flex min-h-[220px] flex-col justify-between rounded-md border border-[#ded4c6] bg-white p-5 text-left transition hover:border-[#20231f]"
              onClick={() => setIsEmailFormOpen(true)}
            >
              <div>
                <Mail className="h-6 w-6 text-[#355d63]" />
                <h3 className="mt-5 text-2xl font-semibold text-[#20231f]">{copy.contact.emailTitle}</h3>
                <p className="mt-3 text-sm leading-6 text-[#676256]">{copy.contact.emailBody}</p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#20231f]">
                {copy.contact.emailAction}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </button>

            {bookingMessage && (
              <p className={`md:col-span-2 rounded-md border px-4 py-3 text-sm font-semibold ${
                bookingStatus === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-[#c9ddd9] bg-[#edf4f2] text-[#355d63]"
              }`}>
                {bookingMessage}
              </p>
            )}
          </div>
        </div>
      </section>

      {isEmailFormOpen && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/58 px-5 py-8 backdrop-blur-sm">
          <form onSubmit={handleBookingSubmit} className="max-h-full w-full max-w-3xl overflow-y-auto rounded-md border border-[#ded4c6] bg-white p-5 shadow-[0_32px_110px_rgba(0,0,0,0.38)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase text-[#7a6f62]">{copy.form.eyebrow}</p>
                <h3 className="mt-2 text-3xl font-semibold leading-tight text-[#20231f]">{copy.form.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#676256]">
                  {copy.form.packagePrefix}: {selectedPackage.name} / {selectedPackage.price} / {selectedPackage.note}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-[#ded4c6] px-3 py-2 text-sm font-semibold text-[#20231f] transition hover:border-[#20231f]"
                onClick={() => setIsEmailFormOpen(false)}
              >
                {copy.form.close}
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-[#20231f]">
                {copy.form.name}
                <input
                  required
                  value={bookingForm.name}
                  onChange={(event) => updateBookingField("name", event.target.value)}
                  className="h-11 rounded-md border border-[#ded4c6] bg-[#fffaf2] px-3 text-sm font-medium outline-none transition focus:border-[#355d63]"
                  placeholder={copy.form.namePlaceholder}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#20231f]">
                {copy.form.date}
                <input
                  required
                  value={bookingForm.date}
                  onChange={(event) => updateBookingField("date", event.target.value)}
                  className="h-11 rounded-md border border-[#ded4c6] bg-[#fffaf2] px-3 text-sm font-medium outline-none transition focus:border-[#355d63]"
                  placeholder={copy.form.datePlaceholder}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#20231f]">
                {copy.form.contact}
                <input
                  required
                  value={bookingForm.contact}
                  onChange={(event) => updateBookingField("contact", event.target.value)}
                  className="h-11 rounded-md border border-[#ded4c6] bg-[#fffaf2] px-3 text-sm font-medium outline-none transition focus:border-[#355d63]"
                  placeholder={copy.form.contactPlaceholder}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#20231f]">
                {copy.form.people}
                <input
                  value={bookingForm.people}
                  onChange={(event) => updateBookingField("people", event.target.value)}
                  className="h-11 rounded-md border border-[#ded4c6] bg-[#fffaf2] px-3 text-sm font-medium outline-none transition focus:border-[#355d63]"
                  placeholder={copy.form.peoplePlaceholder}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#20231f]">
                {copy.form.style}
                <input
                  value={bookingForm.style}
                  onChange={(event) => updateBookingField("style", event.target.value)}
                  className="h-11 rounded-md border border-[#ded4c6] bg-[#fffaf2] px-3 text-sm font-medium outline-none transition focus:border-[#355d63]"
                  placeholder={copy.form.stylePlaceholder}
                />
              </label>
            </div>

            <label className="mt-4 grid gap-2 text-sm font-semibold text-[#20231f]">
              {copy.form.note}
              <textarea
                value={bookingForm.note}
                onChange={(event) => updateBookingField("note", event.target.value)}
                className="min-h-28 rounded-md border border-[#ded4c6] bg-[#fffaf2] px-3 py-3 text-sm font-medium outline-none transition focus:border-[#355d63]"
                placeholder={copy.form.notePlaceholder}
              />
            </label>

            <div className="mt-5 rounded-md border border-[#ded4c6] bg-[#f7f3ec] p-4 text-sm leading-6 text-[#676256]">
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
        </div>
      )}

      <section className="border-t border-[#ded4c6] bg-[#fffaf2] px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.34fr_0.66fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-[#7a6f62]">{copy.faq.eyebrow}</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
              {copy.faq.title}
            </h2>
          </div>
          <div className="grid gap-3">
            {copy.faq.items.map((faq) => (
              <details key={faq.question} className="rounded-md border border-[#ded4c6] bg-white p-5">
                <summary className="cursor-pointer font-semibold">{faq.question}</summary>
                <p className="mt-3 leading-7 text-[#676256]">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#ded4c6] bg-[#20231f] px-5 py-8 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">{copy.footer.title}</p>
            <p className="mt-1 max-w-xl text-sm leading-6 text-white/60">{copy.footer.notice}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-10 rounded-md bg-[#f2eadb] text-[#20231f] hover:bg-[#e7dcc9]" onClick={handleSectionLink("contact")}>
              {copy.footer.booking}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-md border border-white/20 bg-white/10 px-4 text-white hover:bg-white/16"
              onClick={handleScrollTop}
            >
              <ArrowDown className="h-4 w-4 rotate-180" />
              {copy.footer.top}
            </Button>
          </div>
        </div>
      </footer>
    </main>
  )
}
