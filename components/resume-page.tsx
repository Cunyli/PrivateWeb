"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { Instagram, Linkedin, Mail, MessageCircle } from "lucide-react"
import { MasterShotsShowcase } from "@/components/master-collections-showcase"
import type { SVGProps } from "react"
import { useI18n } from "@/lib/i18n"
import { LangSwitcher } from "@/components/lang-switcher"
import { ProtectedImage } from "@/components/protected-image"

const XiaohongshuIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="1em" height="1em" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" fill="#ff2442" />
    <path
      d="M6.5 8h2l1 1.6L10.5 8h2l-1.9 3 1.9 3h-2L9.5 12.4 8.5 14h-2l2-3zm6.3 0h1.6v2h1.3V8h1.6v6h-1.6v-2h-1.3v2h-1.6zm5.7 0c1.4 0 2.2.7 2.2 1.7 0 .8-.4 1.3-1 1.5.7.1 1.1.7 1.1 1.5 0 1.1-.9 1.9-2.3 1.9h-2.3V8zM18.7 10h-.9v1.1h.9c.4 0 .7-.2.7-.5s-.3-.6-.7-.6zm0 2.3h-1v1.2h1c.5 0 .8-.3.8-.6s-.3-.6-.8-.6z"
      fill="#fff"
    />
  </svg>
)

type Locale = "en" | "zh"
type LocalizedString = Record<Locale, string>

type Experience = {
  title: LocalizedString
  organization: LocalizedString
  location: LocalizedString
  period: LocalizedString
  summary: LocalizedString
  highlights: LocalizedString[]
  discipline: "ai" | "photo"
}

type FocusCard = {
  title: LocalizedString
  description: LocalizedString
  list: LocalizedString[]
  accent: string
  tone?: "light" | "dark"
}

type CaseStudy = {
  title: LocalizedString
  context: LocalizedString
  disciplineTag: LocalizedString
  result: LocalizedString
  highlights: LocalizedString[]
}

const heroCopy = {
  badge: { en: "Resume", zh: "简历" },
  title: {
    en: "Lijie Li · Data Scientist & Photographer",
    zh: "李力洁 · 数据科学家与摄影师",
  },
  description: {
    en: "I build multilingual AI systems for knowledge-intensive teams, and I keep a freelance-but-playful photo practice for friends, travelers, and anyone chasing better portraits. Whether the medium is code or light, I try to make the process transparent, collaborative, and quietly artful.",
    zh: "我为知识密集型团队构建多语言 AI 系统，也维持一个松弛的自由摄影实践，陪伴朋友、旅人与寻找好照片的人。无论是代码还是光线，我都希望过程透明、合作，并保留一份克制的审美。",
  },
  primaryCta: { en: "Talk Data Work", zh: "联系数据合作" },
  secondaryCta: { en: "Master Collections", zh: "大师系列" },
}

const techStack = [
  {
    category: { en: "AI & Machine Learning", zh: "AI 与机器学习" },
    items: ["Deep Learning", "NLP", "Speech Recognition", "Generative Models", "RAG Systems", "Data Mining"],
  },
  {
    category: { en: "Engineering & Cloud", zh: "工程与云架构" },
    items: ["Python", "PyTorch", "LangChain", "Triton", "Spark", "Azure AI Factory", "Git", "Linux", "Async IO"],
  },
  {
    category: { en: "Data & Analytics", zh: "数据与分析" },
    items: ["SQL", "Tableau", "MongoDB", "SPSS", "Visualization", "Statistics"],
  },
  {
    category: { en: "Photography & Art", zh: "摄影与艺术" },
    items: ["Sony Alpha", "Capture One", "Color Grading", "Studio Lighting", "Composition", "Visual Storytelling"],
  },
]

const dualPracticeCopy = {
  badge: { en: "Dual Practice", zh: "双轨实践" },
  heading: {
    en: "Analytical rigor meets cinematic intuition",
    zh: "理性分析与电影感直觉交汇",
  },
  body: {
    en: "Research notebooks, lighting studies, and retrieval diagrams live in the same workspace. Data modeling informs how I choreograph light; field recordings inspire interaction flows.",
    zh: "研究笔记、用光草图与检索流程图放在同一个工作台。建模思路影响我如何布光，声音与实地记录又反过来启发交互与系统结构。",
  },
}

const focusCards: FocusCard[] = [
  {
    title: { en: "Data Systems Practice", zh: "数据系统实践" },
    description: {
      en: "Day job energy goes into multilingual RAG stacks, speech models, and measurable retrieval governance. I prefer shipping explainable systems over publishing papers.",
      zh: "日常工作专注于多语言 RAG、语音模型与可量化的检索治理，比起论文更在意可交付、可解释的系统。",
    },
    list: [
      { en: "Agentic RAG orchestration", zh: "Agentic RAG 编排" },
      { en: "Knowledge graphs & KG ops", zh: "知识图谱构建与运维" },
      { en: "QLoRA + TPE fine-tuning", zh: "QLoRA + TPE 微调" },
      { en: "Triton + GPU tooling", zh: "Triton 与 GPU 工具链" },
    ],
    accent: "from-zinc-100 via-white to-zinc-50",
    tone: "light",
  },
  {
    title: { en: "Freelance Photography Journal", zh: "自由摄影记录" },
    description: {
      en: "Photography is a lifelong hobby and dialogue space. I freelance selectively, document rituals, and use this site to talk with friends about taste and visual research.",
      zh: "摄影是长期的兴趣和对话场。我会挑选项目，记录仪式感，并在这里和朋友讨论美学与视觉研究。",
    },
    list: [
      { en: "Gallery conversations & residencies", zh: "与画廊的对话与驻地" },
      { en: "Slow-fashion capsule stories", zh: "慢时尚胶囊故事" },
      { en: "Experimental lighting notebooks", zh: "实验用光手记" },
      { en: "Community photo salons", zh: "社区摄影沙龙" },
    ],
    accent: "from-rose-50 via-white to-zinc-50",
    tone: "light",
  },
]

const caseStudySectionCopy = {
  badge: { en: "Hybrid Case Studies", zh: "混合案例" },
  heading: {
    en: "Where data products and visuals converge",
    zh: "数据产品与视觉叙事的交汇",
  },
  summary: {
    en: "Selected systems pairing measurable rigor with sensory storytelling.",
    zh: "挑选出既可量化又具感官叙事的系统。",
  },
}

const caseStudies: CaseStudy[] = [
  {
    title: {
      en: "Knowledge Graph Challenge on Heterogeneous Sources",
      zh: "异构数据知识图谱挑战",
    },
    context: {
      en: "VTT · Finland · 3rd place · 2025 AaltoAI Hackathon",
      zh: "VTT · 芬兰 · AaltoAI 2025 黑客松季军",
    },
    disciplineTag: { en: "AI Systems", zh: "AI 系统" },
    result: {
      en: "Automated ingestion + semantic entity resolution with 100% traceability.",
      zh: "自动采集与语义实体消解，确保 100% 可追溯。",
    },
    highlights: [
      {
        en: "Hybrid search (Qdrant ANN + BM25) fused with RRF and Cross-Encoder rerankers.",
        zh: "Qdrant ANN + BM25 的混合搜索，结合 RRF 与 Cross-Encoder 重排。",
      },
      {
        en: "HDBSCAN-powered entity resolution using `text-embedding-small` vectors.",
        zh: "以 `text-embedding-small` 向量结合 HDBSCAN 完成实体消解。",
      },
      {
        en: "Evaluation suite covering Hit Rate, MRR, and innovation lineage tracking.",
        zh: "评估体系覆盖 Hit Rate、MRR 与创新谱系追踪。",
      },
    ],
  },
  {
    title: {
      en: "SNLP Challenge: Multilingual Speech + Toxicity",
      zh: "SNLP 挑战：多语语音与毒性检测",
    },
    context: { en: "Aalto University · 2nd place", zh: "阿尔托大学 · 亚军" },
    disciplineTag: { en: "AI Research", zh: "AI 研究" },
    result: {
      en: "WER 0.0664 / CER 0.0123 with Wav2Vec2-BERT + SpecAugment.",
      zh: "采用 Wav2Vec2-BERT + SpecAugment，WER 0.0664 / CER 0.0123。",
    },
    highlights: [
      {
        en: "Fine-tuned multilingual BERT with Triton acceleration and WandB tracking.",
        zh: "以 Triton 加速并用 WandB 记录，微调多语 BERT。",
      },
      {
        en: "Benchmarked four multilingual toxicity models across English / German / Finnish.",
        zh: "在英/德/芬三语上测试四套毒性模型。",
      },
      {
        en: "Blended character-level noise defenses with balanced sampling strategies.",
        zh: "结合字符级噪声防御与均衡采样策略。",
      },
    ],
  },
  {
    title: {
      en: "Recommendation & Uni-cloud Platform",
      zh: "推荐与云一体平台",
    },
    context: { en: "Kunshan Yuanpai Trading · China", zh: "昆山源湃贸易 · 中国" },
    disciplineTag: { en: "Data Products", zh: "数据产品" },
    result: {
      en: "Reduced query latency and improved personalization for merchandising teams.",
      zh: "降低查询延迟并提升商品团队的个性化推荐。",
    },
    highlights: [
      {
        en: "DBSCAN clustering + MAB exploration to surface high-value customer cohorts.",
        zh: "DBSCAN 聚类 + MAB 探索定位高价值客群。",
      },
      {
        en: "Optimized MongoDB schema and SQL interfaces for order + inventory ops.",
        zh: "优化 MongoDB 结构与 SQL 接口，串联订单与库存。",
      },
      {
        en: "Built Tableau dashboards to translate raw telemetry into decisions.",
        zh: "搭建 Tableau 看板，把原始遥测转化为决策。",
      },
    ],
  },
  {
    title: {
      en: "Agent Challenge on Automated Personalized Marketing",
      zh: "自动化个性化营销 Agent 挑战",
    },
    context: { en: "P&G · Finland · 3rd place · 2025 Junction", zh: "宝洁 · 芬兰 · 2025 Junction 季军" },
    disciplineTag: { en: "AI Engineering", zh: "AI 工程" },
    result: {
      en: "Multimodal n8n Agentic workflow for localized multi-channel assets.",
      zh: "多模态 n8n Agent 工作流，实现本地化多渠道资产生成。",
    },
    highlights: [
      {
        en: "Engineered a multimodal n8n Agentic workflow that adapts visual elements and optimizes text constraints for specific channels, achieving cultural localization.",
        zh: "构建多模态 n8n Agent 工作流，自适应调整视觉元素与文本约束，实现跨渠道（SMS/Email）的文化本地化。",
      },
      {
        en: "Implemented a Self-Reflective and adaptive design with CoT reasoning to iteratively critique outputs and enforce safety guardrails.",
        zh: "采用思维链 (CoT) 的自反思与自适应设计，迭代审查输出并执行安全护栏，显著减少幻觉并确保品牌合规。",
      },
    ],
  },
]

const studioNotesCopy = {
  badge: { en: "Studio Notes & Dialogue", zh: "工作室札记" },
  heading: {
    en: "Build logs, moodboards, and open conversations",
    zh: "建造日志、灵感板与开放对话",
  },
  body: {
    en: "My background spans research-heavy programs, yet the work I share here stays grounded in shipped systems, experiments, and visual notebooks. I publish working notes, lighting studies, and retrieval diagrams so friends can drop by, swap tactics, or plan a casual photo walk.",
    zh: "学习背景偏研究，但我更愿意分享真正上线的系统、实验与视觉手帐。这里公开工作记录、用光研究与检索图，方便朋友随时交流战术或约一场轻松的拍摄。",
  },
  link: { en: "View Gallery", zh: "浏览画廊" },
}

const experiences: Experience[] = [
  {
    title: { en: "Data Scientist", zh: "数据科学家" },
    organization: { en: "Lexembed", zh: "Lexembed" },
    location: { en: "Stockholm, Sweden", zh: "瑞典·斯德哥尔摩" },
    period: { en: "Aug 2025 — Present", zh: "2025 年 8 月 — 至今" },
    discipline: "ai",
    summary: {
      en: "Designing multilingual knowledge engines that blend Agentic RAG, case-based reasoning, and knowledge graphs for legal intelligence teams.",
      zh: "为法律智能团队打造多语言知识引擎，结合 Agentic RAG、案例推理与知识图谱。",
    },
    highlights: [
      {
        en: "Built a multi-hop QA flow that fuses entity extraction with graph traversals for rapid compliance research.",
        zh: "构建多跳问答流程，将实体抽取与图遍历结合，加速合规检索。",
      },
      {
        en: "Introduced quantitative retrieval guardrails using RAGAS and automated regression suites for every release.",
        zh: "引入 RAGAS 与自动回归套件，为每次发布建立量化检索护栏。",
      },
    ],
  },
  {
    title: { en: "Data Specialist (Intern)", zh: "数据专员（实习）" },
    organization: { en: "International Digital Economy Academy", zh: "国创数字经济研究院" },
    location: { en: "Shenzhen, China", zh: "中国·深圳" },
    period: { en: "Aug 2023 — Mar 2024", zh: "2023 年 8 月 — 2024 年 3 月" },
    discipline: "ai",
    summary: {
      en: "Owned the end-to-end lifecycle for policy moderation models, from generative data augmentation to adversarial hardening and deployment.",
      zh: "负责政策内容审核模型的全流程：生成式扩充、对抗强化与部署。",
    },
    highlights: [
      {
        en: "Fine-tuned DeBERTaV3 with QLoRA + TPE, cutting VRAM usage by 80% and improving F1 by 5 points.",
        zh: "使用 QLoRA + TPE 微调 DeBERTaV3，显存降 80%，F1 提升 5 分。",
      },
      {
        en: "Used TextAttack adversarial suites to harden classifiers and validated robustness with macro-F1 and MCC dashboards.",
        zh: "借助 TextAttack 套件强化分类器，并用 macro-F1 / MCC 仪表板验证鲁棒性。",
      },
    ],
  },
  {
    title: { en: "Portrait & Travel Sessions Photographer", zh: "人像与旅拍摄影师" },
    organization: { en: "Freelance Studio", zh: "自由工作室" },
    location: { en: "Stockholm · On-location", zh: "斯德哥尔摩 · 外景" },
    period: { en: "2024 — Present", zh: "2024 — 至今" },
    discipline: "photo",
    summary: {
      en: "Think of me as the friend who carries cameras, chats through nerves, and helps you leave with portraits you actually like—whether it’s passport refreshes or playful travel diaries.",
      zh: "像朋友一样陪你拍照：带着相机、聊天缓解紧张，从证件照到旅拍都能带走喜欢的照片。",
    },
    highlights: [
      {
        en: "Deliver same-day biometric-friendly headshots for visas and IDs, plus natural retouching (skin tones, stray hairs) without the heavy filter look.",
        zh: "当天交付符合标准的证件与签证照，轻量润饰肤色与碎发，不做过度滤镜。",
      },
      {
        en: "Join shoots as a travel buddy—mapping quiet alleys, cafés, or ferries—so the day feels like hanging out rather than a formal booking.",
        zh: "以旅伴身份同行，规划小巷、咖啡馆或渡轮，让拍摄像散步而非正式预约。",
      },
      {
        en: "Help prep outfits and pacing, but note I can’t stamp or certify official documents—everything stays casual and personal.",
        zh: "协助准备服装与节奏，但不提供官方盖章或认证，保持私人与轻松感。",
      },
    ],
  },
  {
    title: { en: "Street & Candid Sessions", zh: "街头与纪实漫拍" },
    organization: { en: "Self-initiated", zh: "自发项目" },
    location: { en: "Stockholm", zh: "斯德哥尔摩" },
    period: { en: "2023 — Present", zh: "2023 — 至今" },
    discipline: "photo",
    summary: {
      en: "Lead relaxed portrait walks through Gamla Stan, Södermalm backstreets, and lakeside trails—no stylists, just a friend with a camera and plenty of time.",
      zh: "带你在老城、南城小路与湖畔散步拍照，没有造型师，像朋友约会一样。",
    },
    highlights: [
      {
        en: "Guide you in prepping outfits and playlists, then stroll together so the shoot feels like catching up rather than performing.",
        zh: "一起挑服装、准备歌单，再慢慢散步，拍摄更像聊天。",
      },
      {
        en: "Capture both candid street frames and clean portraits, retouching lightly while keeping your features and mood intact.",
        zh: "记录街拍瞬间与正式人像，只做轻度润饰，保留神态。",
      },
      {
        en: "Share albums plus editing notes so you can re-export or print with the same color story later.",
        zh: "提供相册和调色笔记，方便之后再导出或打印。",
      },
    ],
  },
]

const experienceSectionCopy = {
  heading: { en: "Experience", zh: "经历" },
  badge: { en: "Parallel tracks", zh: "双线发展" },
  link: { en: "View full CV on LinkedIn ↗", zh: "在 LinkedIn 查看完整履历 ↗" },
  columns: [
    { label: { en: "AI / Data Roles", zh: "AI / 数据角色" }, discipline: "ai" as const },
    { label: { en: "Creative Commissions", zh: "创意委托" }, discipline: "photo" as const },
  ],
}

const masterSectionCopy = {
  badge: { en: "Master-tagged Sets", zh: "大师标签合集" },
  heading: { en: "Curated Showcase", zh: "策展精选" },
  link: { en: "Explore all sets →", zh: "浏览所有作品 →" },
}

const skills = [
  {
    title: { en: "Data Science / AI", zh: "数据科学 / AI" },
    items: [
      { en: "Agentic RAG orchestration with LangChain + custom tools", zh: "结合 LangChain 与自研工具的 Agentic RAG 编排" },
      { en: "Python, PyTorch, Triton inference, Qdrant/BM25 hybrid retrieval", zh: "Python、PyTorch、Triton 推理，Qdrant/BM25 混合检索" },
      { en: "ASR & NLP fine-tuning (DeBERTaV3, Wav2Vec2, multilingual BERT)", zh: "ASR / NLP 微调（DeBERTaV3、Wav2Vec2、多语 BERT）" },
    ],
  },
  {
    title: { en: "Photography Practice", zh: "摄影实践" },
    items: [
      { en: "Portrait direction & candid street sessions", zh: "人像引导与街头纪实" },
      { en: "On-location natural light planning (Stockholm / EU / Shenzhen)", zh: "外景自然光规划（斯德哥尔摩 / 欧盟 / 深圳）" },
      { en: "Color-proofing, light post-processing, and proof print prep", zh: "色彩校准、轻后期与试印准备" },
    ],
  },
]

const capabilitiesCopy = {
  badge: { en: "Capabilities", zh: "能力图谱" },
  heading: { en: "Core skills", zh: "核心技能" },
}

const services = [
  {
    label: { en: "Portrait Sessions", zh: "人像拍摄" },
    description: {
      en: "Book me as a portrait/travel friend—passport renewals, casual street walks, light retouching included (official stamped docs not supported).",
      zh: "以旅伴/朋友的方式约拍：证件照、街头散步、轻润饰均可（不提供官方盖章）。",
    },
  },
  {
    label: { en: "Data Systems Engagements", zh: "数据系统合作" },
    description: {
      en: "Open to full-time roles or embedded sprints for retrieval, multilingual QA, ASR research, or evaluation pipelines.",
      zh: "可接受全职或短期驻场，聚焦检索、多语 QA、ASR 研究与评估流水线。",
    },
  },
]

const servicesSectionCopy = {
  badge: { en: "Commissions & Engagements", zh: "委托与合作" },
  heading: { en: "Ways we can collaborate", zh: "可以如何合作" },
}

const contactLinks = [
  {
    key: "email",
    label: { en: "Email", zh: "邮箱" },
    value: "773882712cunyli@gmail.com",
    href: "mailto:773882712cunyli@gmail.com",
    icon: Mail,
  },
  {
    key: "instagram",
    label: { en: "Instagram", zh: "Instagram" },
    value: "instagram.com",
    href: "https://www.instagram.com",
    icon: Instagram,
  },
  {
    key: "linkedin",
    label: { en: "LinkedIn", zh: "LinkedIn" },
    value: "linkedin.com/in/cunyli",
    href: "https://www.linkedin.com/in/cunyli",
    icon: Linkedin,
  },
  {
    key: "xiaohongshu",
    label: { en: "Xiaohongshu", zh: "小红书" },
    value: "xhslink.com/m/3mrL9nhJm4E",
    href: "https://xhslink.com/m/3mrL9nhJm4E",
    icon: XiaohongshuIcon,
  },
  {
    key: "wechat",
    label: { en: "WeChat", zh: "微信" },
    icon: MessageCircle,
    copyValue: "Llj773882712",
  },
]

const availabilityCopy = {
  badge: { en: "Availability", zh: "当前档期" },
  heading: { en: "Accepting shoots & data engagements", zh: "接受拍摄与数据合作" },
  body: {
    en: "Currently booking portrait sessions across Europe and Shenzhen, and taking on remote/onsite data science engagements that run from retrieval architecture to ASR research sprints.",
    zh: "目前开放欧洲与深圳的人像预约，也接受远程/驻场的数据项目：从检索架构到 ASR 研究冲刺。",
  },
  footer: {
    en: "Based in Stockholm · Shenzhen friendly · English / 中文",
    zh: "常驻斯德哥尔摩 · 支持深圳合作 · English / 中文",
  },
}

const copyFeedback = {
  copyPrefix: { en: "Copy", zh: "复制" },
  copiedSuffix: { en: "copied!", zh: "已复制！" },
  copyFailed: { en: "Copy failed. Please try again.", zh: "复制失败，请重试。" },
}

const fadeInUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
}

const sectionReveal = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: "easeOut" } },
}

const cardReveal = {
  hidden: { opacity: 0, y: 48 },
  visible: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: "easeOut", delay: index * 0.08 },
  }),
}

export function ResumePage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const [copyStatus, setCopyStatus] = useState<{ type: "success" | "error"; key?: string } | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const shouldReduceMotion = prefersReducedMotion
  const disableScrollLinkedMotion = prefersReducedMotion || isMobile
  const { locale } = useI18n()
  const contactLabelMap = useMemo(() => {
    return contactLinks.reduce((acc, link) => {
      acc[link.key] = link.label[locale]
      return acc
    }, {} as Record<string, string>)
  }, [locale])

  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return
    const mq = window.matchMedia("(max-width: 640px)")
    const update = () => setIsMobile(mq.matches)
    update()
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update)
      return () => mq.removeEventListener("change", update)
    }
    mq.addListener(update)
    return () => mq.removeListener(update)
  }, [])

  const { scrollYProgress } = useScroll({
    target: pageRef,
    offset: ["start start", "end start"],
  })

  const heroGlowY = useTransform(scrollYProgress, [0, 0.6], ["0%", "25%"])
  const statsLift = useTransform(scrollYProgress, [0, 0.25], [0, -24])
  const statsShadowDepth = useTransform(scrollYProgress, [0, 0.25], [0.15, 0.4])
  const statsShadow = useTransform(statsShadowDepth, (value) => `0 40px 120px rgba(15,15,15,${value})`)
  const progressOpacity = useTransform(scrollYProgress, [0, 0.05], [0, 1])

  const createSectionMotionProps = (amount?: number) => {
    if (shouldReduceMotion) return {}
    return {
      initial: "hidden" as const,
      whileInView: "visible" as const,
      viewport: { once: true, amount: amount ?? (isMobile ? 0.25 : 0.55) },
    }
  }

  const getCardMotionProps = (index: number, options?: { viewportAmount?: number; immediate?: boolean }) => {
    if (shouldReduceMotion) return {}
    if (options?.immediate) {
      return {
        custom: index,
        variants: cardReveal,
        initial: "hidden" as const,
        animate: "visible" as const,
      }
    }
    return {
      custom: index,
      variants: cardReveal,
      initial: "hidden" as const,
      whileInView: "visible" as const,
      viewport: { once: true, amount: options?.viewportAmount ?? (isMobile ? 0.25 : 0.45) },
    }
  }

  const getFadeInViewProps = (amount?: number) => {
    if (shouldReduceMotion) return {}
    return {
      variants: fadeInUp,
      initial: "hidden" as const,
      whileInView: "visible" as const,
      viewport: { once: true, amount: amount ?? (isMobile ? 0.25 : 0.4) },
    }
  }

  const maybeFade = shouldReduceMotion ? undefined : fadeInUp
  const maybeSection = shouldReduceMotion ? undefined : sectionReveal

  return (
    <div ref={pageRef} className="relative min-h-[100svh] bg-zinc-50 text-zinc-900">
      <motion.div
        className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[2px] origin-left bg-zinc-900/80"
        style={
          disableScrollLinkedMotion
            ? { opacity: 0 }
            : {
              scaleX: scrollYProgress,
              opacity: progressOpacity,
            }
        }
      />

      <motion.section
        className="relative isolate flex min-h-[92svh] items-center overflow-hidden"
        {...createSectionMotionProps(isMobile ? 0.4 : 0.8)}
        variants={maybeFade}
      >
        <div className="absolute right-4 top-4 z-20">
          <LangSwitcher className="h-10 w-10 border border-zinc-200 bg-white/80 text-zinc-800" />
        </div>
        <ProtectedImage
          src="/private/arua.jpg"
          alt="Background"
          fill
          priority
          containerClassName="absolute inset-0 -z-10"
          className="object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <motion.div
          className="absolute inset-0 pointer-events-none opacity-60 [background:radial-gradient(circle_at_top,_rgba(17,24,39,0.08),_transparent_55%)]"
          style={disableScrollLinkedMotion ? undefined : { y: heroGlowY }}
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-center items-center">
          <motion.div className="max-w-2xl space-y-6" variants={maybeFade}>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-zinc-400">{heroCopy.badge[locale]}</p>
            <h1 className="text-4xl font-light leading-tight text-white sm:text-5xl lg:text-6xl">
              {heroCopy.title[locale]}
            </h1>
            <p className="text-lg leading-relaxed text-zinc-200">{heroCopy.description[locale]}</p>
            <motion.div className="flex flex-wrap gap-4" variants={maybeFade}>
              <Link
                href="#contact"
                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium uppercase tracking-wide text-zinc-900 transition hover:bg-zinc-200"
              >
                {heroCopy.primaryCta[locale]}
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            className="w-full rounded-3xl border border-white/10 bg-black/20 p-6 text-white shadow-2xl backdrop-blur-md lg:w-[480px]"
            style={
              disableScrollLinkedMotion
                ? undefined
                : {
                  y: statsLift,
                  boxShadow: statsShadow,
                }
            }
          >
            <div className="grid gap-6 sm:grid-cols-2">
              {techStack.map((stack, index) => (
                <motion.div
                  key={stack.category.en}
                  {...getCardMotionProps(index, { immediate: true })}
                  className="space-y-3"
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">
                    {stack.category[locale]}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {stack.items.map((item) => (
                      <span
                        key={item}
                        className="rounded-md bg-white/10 px-2 py-1 text-[10px] font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/20"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        className="relative isolate overflow-hidden"
        variants={maybeSection}
        {...createSectionMotionProps()}
      >
        <ProtectedImage
          src="/private/roma.jpg"
          alt="Dual Practice Background"
          fill
          containerClassName="absolute inset-0 -z-10"
          className="object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-black/70" />
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-14 sm:px-10">
          <div className="flex flex-col gap-3">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">{dualPracticeCopy.badge[locale]}</p>
            <h2 className="text-2xl font-light text-white">{dualPracticeCopy.heading[locale]}</h2>
            <p className="text-base text-zinc-200">{dualPracticeCopy.body[locale]}</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {focusCards.map((card, index) => {
              return (
                <motion.article
                  key={card.title.en}
                  {...getCardMotionProps(index, { viewportAmount: 0.25 })}
                  className="rounded-3xl border border-white/10 bg-black/40 p-8 shadow-sm backdrop-blur-md"
                >
                  <p className="text-sm uppercase tracking-wide text-zinc-400">
                    {locale === "zh" ? `实践 #${index + 1}` : `Practice #${index + 1}`}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-white">
                    {card.title[locale]}
                  </h3>
                  <p className="mt-3 text-base text-zinc-300">{card.description[locale]}</p>
                  <ul className="mt-6 space-y-2 text-sm text-zinc-400">
                    {card.list.map((item) => (
                      <li key={`${card.title.en}-${item.en}`} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white" />
                        <span>{item[locale]}</span>
                      </li>
                    ))}
                  </ul>
                </motion.article>
              )
            })}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="relative isolate overflow-hidden"
        variants={maybeSection}
        {...createSectionMotionProps(0.3)}
      >
        <ProtectedImage
          src="/private/camera4.jpg"
          alt="Case Studies Background"
          fill
          containerClassName="absolute inset-0 -z-10"
          className="object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-black/80" />
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-14 sm:px-10">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">{caseStudySectionCopy.badge[locale]}</p>
            <h2 className="text-2xl font-light text-white">{caseStudySectionCopy.heading[locale]}</h2>
            <p className="text-base text-zinc-300">{caseStudySectionCopy.summary[locale]}</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {caseStudies.map((study, index) => (
              <motion.article
                key={study.title.en}
                className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur-sm transition hover:bg-white/10"
                {...getCardMotionProps(index, { viewportAmount: 0.3 })}
              >
                <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  <span>{study.disciplineTag[locale]}</span>
                  <span>{study.context[locale]}</span>
                </div>
                <h3 className="text-lg font-medium text-white">{study.title[locale]}</h3>
                <p className="text-sm text-zinc-300">{study.result[locale]}</p>
                <ul className="mt-2 space-y-2 text-sm text-zinc-400">
                  {study.highlights.map((item) => (
                    <li key={`${study.title.en}-${item.en}`} className="flex items-start gap-2">
                      <span className="mt-1 h-1 w-1 rounded-full bg-white" />
                      <span>{item[locale]}</span>
                    </li>
                  ))}
                </ul>
              </motion.article>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="relative isolate overflow-hidden"
        variants={maybeSection}
        {...createSectionMotionProps(0.35)}
      >
        <ProtectedImage
          src="/private/DSC03210.jpeg"
          alt="Studio Notes Background"
          fill
          containerClassName="absolute inset-0 -z-10"
          className="object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-black/80" />
        <div className="mx-auto max-w-4xl px-5 py-14 text-center sm:px-10">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">{studioNotesCopy.badge[locale]}</p>
          <h2 className="mt-3 text-2xl font-light text-white">{studioNotesCopy.heading[locale]}</h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-300">{studioNotesCopy.body[locale]}</p>

          {/* Moodboard Grid */}
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              "/private/master1.jpg",
              "/private/master2.jpg",
              "/private/master3.jpg",
              "/private/master4.jpg"
            ].map((img, i) => (
              <div key={img} className={`relative aspect-square overflow-hidden rounded-xl bg-white/5 ${i % 2 === 0 ? 'rotate-2' : '-rotate-2'} transition hover:rotate-0 hover:scale-105 hover:z-10 duration-300`}>
                <ProtectedImage
                  src={img}
                  alt="Moodboard"
                  fill
                  containerClassName="h-full w-full"
                  className="object-cover opacity-80 hover:opacity-100 transition-opacity"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Link
              href="/portfolio"
              className="text-sm uppercase tracking-wide text-zinc-300 underline underline-offset-4 transition hover:text-white"
            >
              {studioNotesCopy.link[locale]}
            </Link>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="relative isolate overflow-hidden"
        variants={maybeSection}
        {...createSectionMotionProps(0.3)}
      >
        <ProtectedImage
          src="/private/valorant.jpg"
          alt="Experience Background"
          fill
          containerClassName="absolute inset-0 -z-10"
          className="object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-black/80" />
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-light text-white">{experienceSectionCopy.heading[locale]}</h2>
              <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">{experienceSectionCopy.badge[locale]}</p>
            </div>
            <Link
              href="https://www.linkedin.com/in/cunyli"
              target="_blank"
              className="text-sm font-medium text-zinc-300 underline underline-offset-4 hover:text-white"
            >
              {experienceSectionCopy.link[locale]}
            </Link>
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            {experienceSectionCopy.columns.map((column, columnIndex) => (
              <div key={column.label.en} className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">{column.label[locale]}</p>
                  <div className="ml-4 h-px flex-1 bg-white/20" />
                </div>
                {experiences
                  .filter((role) => role.discipline === column.discipline)
                  .map((role, index) => (
                    <motion.div
                      key={`${role.title.en}-${role.period.en}`}
                      className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm transition will-change-transform hover:-translate-y-1 hover:bg-white/10"
                      {...getCardMotionProps(index + columnIndex, { viewportAmount: 0.35 })}
                    >
                      <div className="flex flex-col gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-zinc-400">{role.period[locale]}</p>
                          <h3 className="mt-1 text-lg font-medium text-white">{role.title[locale]}</h3>
                          <p className="text-sm text-zinc-400">
                            {role.organization[locale]} · {role.location[locale]}
                          </p>
                        </div>
                        <p className="text-sm text-zinc-300">{role.summary[locale]}</p>
                        <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                          {role.highlights.map((item) => (
                            <li key={`${role.title.en}-${item.en}`} className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white" />
                              <span>{item[locale]}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </motion.section>



      <motion.section
        className="relative isolate overflow-hidden"
        variants={maybeSection}
        {...createSectionMotionProps(0.35)}
      >
        <ProtectedImage
          src="/private/camera2.jpg"
          alt="Capabilities Background"
          fill
          containerClassName="absolute inset-0 -z-10"
          className="object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-black/80" />
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-16 sm:px-10 lg:flex-row">
          <motion.div
            className="w-full rounded-3xl border border-white/10 bg-white/5 p-8 shadow-sm backdrop-blur-sm"
            {...getFadeInViewProps(0.4)}
          >
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">{capabilitiesCopy.badge[locale]}</p>
            <h2 className="mt-3 text-2xl font-light text-white">{capabilitiesCopy.heading[locale]}</h2>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {skills.map((group, index) => (
                <motion.div
                  key={group.title.en}
                  className="rounded-2xl border border-white/10 bg-black/20 p-5"
                  {...getFadeInViewProps(0.6)}
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-zinc-300">{group.title[locale]}</p>
                  <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                    {group.items.map((item) => (
                      <li key={`${group.title.en}-${item.en}`} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white" />
                        <span>{item[locale]}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="w-full rounded-3xl border border-white/10 bg-white/5 p-8 shadow-sm backdrop-blur-sm"
            {...getFadeInViewProps(0.4)}
          >
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">{servicesSectionCopy.badge[locale]}</p>
            <h2 className="mt-3 text-2xl font-light text-white">{servicesSectionCopy.heading[locale]}</h2>
            <div className="mt-6 flex flex-col gap-4 lg:flex-row">
              {services.map((service, index) => (
                <motion.div
                  key={service.label.en}
                  className="flex flex-1 flex-col justify-between rounded-3xl border border-white/10 bg-black/20 px-6 py-6 shadow-inner"
                  {...getFadeInViewProps(0.6)}
                >
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-zinc-300">{service.label[locale]}</p>
                    <p className="mt-3 text-base text-zinc-400">{service.description[locale]}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        id="contact"
        className="relative isolate overflow-hidden"
        variants={maybeSection}
        {...createSectionMotionProps(0.4)}
      >
        <ProtectedImage
          src="/private/selfish.jpg"
          alt="Contact Background"
          fill
          containerClassName="absolute inset-0 -z-10"
          className="object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-black/80" />
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-16 text-center sm:px-10">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">{availabilityCopy.badge[locale]}</p>
          <h2 className="text-3xl font-light text-white">{availabilityCopy.heading[locale]}</h2>
          <p className="text-base text-zinc-300">{availabilityCopy.body[locale]}</p>
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-4">
            {contactLinks.map((contact) => {
              const Icon = contact.icon
              if (contact.copyValue) {
                return (
                  <button
                    key={contact.key}
                    type="button"
                    title={`${copyFeedback.copyPrefix[locale]} ${contact.label[locale]}`}
                    aria-label={`${copyFeedback.copyPrefix[locale]} ${contact.label[locale]}`}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-zinc-300 transition hover:-translate-y-0.5 hover:bg-white/20 hover:text-white"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(contact.copyValue || "")
                        setCopyStatus({ type: "success", key: contact.key })
                      } catch {
                        setCopyStatus({ type: "error" })
                      }
                      setTimeout(() => setCopyStatus(null), 1500)
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                )
              }

              if (!contact.href) {
                return null
              }

              return (
                <Link
                  key={contact.key}
                  href={contact.href}
                  target="_blank"
                  rel="noreferrer"
                  title={contact.label[locale]}
                  aria-label={contact.label[locale]}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-zinc-300 transition hover:-translate-y-0.5 hover:bg-white/20 hover:text-white"
                >
                  <Icon className="h-5 w-5" />
                  <span className="sr-only">{contact.label[locale]}</span>
                </Link>
              )
            })}
          </div>
          {copyStatus && (
            <p
              className={`text-xs ${copyStatus.type === "error" ? "text-red-400" : "text-emerald-400"}`}
              role="status"
            >
              {copyStatus.type === "error"
                ? copyFeedback.copyFailed[locale]
                : `${(copyStatus.key && contactLabelMap[copyStatus.key]) || ""} ${copyFeedback.copiedSuffix[locale]}`.trim()}
            </p>
          )}
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{availabilityCopy.footer[locale]}</p>
        </div>
      </motion.section>
    </div>
  )
}
