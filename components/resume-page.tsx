"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { Instagram, Linkedin, Mail, MessageCircle } from "lucide-react"
import { MasterShotsShowcase } from "@/components/master-collections-showcase"
import type { SVGProps } from "react"

const XiaohongshuIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="1em" height="1em" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" fill="#ff2442" />
    <path
      d="M6.5 8h2l1 1.6L10.5 8h2l-1.9 3 1.9 3h-2L9.5 12.4 8.5 14h-2l2-3zm6.3 0h1.6v2h1.3V8h1.6v6h-1.6v-2h-1.3v2h-1.6zm5.7 0c1.4 0 2.2.7 2.2 1.7 0 .8-.4 1.3-1 1.5.7.1 1.1.7 1.1 1.5 0 1.1-.9 1.9-2.3 1.9h-2.3V8zM18.7 10h-.9v1.1h.9c.4 0 .7-.2.7-.5s-.3-.6-.7-.6zm0 2.3h-1v1.2h1c.5 0 .8-.3.8-.6s-.3-.6-.8-.6z"
      fill="#fff"
    />
  </svg>
)

type Experience = {
  title: string
  organization: string
  location: string
  period: string
  summary: string
  highlights: string[]
  discipline: "ai" | "photo"
}

type FocusCard = {
  title: string
  description: string
  list: string[]
  accent: string
  tone?: "light" | "dark"
}

type CaseStudy = {
  title: string
  context: string
  disciplineTag: string
  result: string
  highlights: string[]
}

const experiences: Experience[] = [
  {
    title: "Data Scientist",
    organization: "Lexembed",
    location: "Stockholm, Sweden",
    period: "Aug 2025 — Present",
    discipline: "ai",
    summary:
      "Designing multilingual knowledge engines that blend Agentic RAG, case-based reasoning, and knowledge graphs for legal intelligence teams.",
    highlights: [
      "Built a multi-hop QA flow that fuses entity extraction with graph traversals for rapid compliance research.",
      "Introduced quantitative retrieval guardrails using RAGAS and automated regression suites for every release.",
    ],
  },
  {
    title: "Data Specialist (Intern)",
    organization: "International Digital Economy Academy",
    location: "Shenzhen, China",
    period: "Aug 2023 — Mar 2024",
    discipline: "ai",
    summary:
      "Owned the end-to-end lifecycle for policy moderation models, from generative data augmentation to adversarial hardening and deployment.",
    highlights: [
      "Fine-tuned DeBERTaV3 with QLoRA + TPE, cutting VRAM usage by 80% and improving F1 by 5 points.",
      "Used TextAttack adversarial suites to harden classifiers and validated robustness with macro-F1 and MCC dashboards.",
    ],
  },
  {
    title: "Portrait & Travel Sessions Photographer",
    organization: "Freelance Studio",
    location: "Stockholm · On-location",
    period: "2024 — Present",
    discipline: "photo",
    summary:
      "Think of me as the friend who carries cameras, chats through nerves, and helps you leave with portraits you actually like—whether it’s passport refreshes or playful travel diaries.",
    highlights: [
      "Deliver same-day biometric-friendly headshots for visas and IDs, plus natural retouching (skin tones, stray hairs) without the heavy filter look.",
      "Join shoots as a travel buddy—mapping quiet alleys, cafés, or ferries—so the day feels like hanging out rather than a formal booking.",
      "Help prep outfits and pacing, but note I can’t stamp or certify official documents—everything stays casual and personal.",
    ],
  },
  {
    title: "Street & Candid Sessions",
    organization: "Self-initiated",
    location: "Stockholm",
    period: "2023 — Present",
    discipline: "photo",
    summary:
      "Lead relaxed portrait walks through Gamla Stan, Södermalm backstreets, and lakeside trails—no stylists, just a friend with a camera and plenty of time.",
    highlights: [
      "Guide you in prepping outfits and playlists, then stroll together so the shoot feels like catching up rather than performing.",
      "Capture both candid street frames and clean portraits, retouching lightly while keeping your features and mood intact.",
      "Share albums plus editing notes so you can re-export or print with the same color story later.",
    ],
  },
]

const focusCards: FocusCard[] = [
  {
    title: "Data Systems Practice",
    description:
      "Day job energy goes into multilingual RAG stacks, speech models, and measurable retrieval governance. I prefer shipping explainable systems over publishing papers.",
    list: ["Agentic RAG orchestration", "Knowledge graphs & KG ops", "QLoRA + TPE fine-tuning", "Triton + GPU tooling"],
    accent: "from-zinc-100 via-white to-zinc-50",
    tone: "light",
  },
  {
    title: "Freelance Photography Journal",
    description:
      "Photography is a lifelong hobby and dialogue space. I freelance selectively, document rituals, and use this site to talk with friends about taste and visual research.",
    list: ["Gallery conversations & residencies", "Slow-fashion capsule stories", "Experimental lighting notebooks", "Community photo salons"],
    accent: "from-rose-50 via-white to-zinc-50",
    tone: "light",
  },
]

const caseStudies: CaseStudy[] = [
  {
    title: "Knowledge Graph Challenge on Heterogeneous Sources",
    context: "VTT · Finland · 3rd place · 2025 AaltoAI Hackathon",
    disciplineTag: "AI Systems",
    result: "Automated ingestion + semantic entity resolution with 100% traceability.",
    highlights: [
      "Hybrid search (Qdrant ANN + BM25) fused with RRF and Cross-Encoder rerankers.",
      "HDBSCAN-powered entity resolution using `text-embedding-small` vectors.",
      "Evaluation suite covering Hit Rate, MRR, and innovation lineage tracking.",
    ],
  },
  {
    title: "SNLP Challenge: Multilingual Speech + Toxicity",
    context: "Aalto University · 2nd place",
    disciplineTag: "AI Research",
    result: "WER 0.0664 / CER 0.0123 with Wav2Vec2-BERT + SpecAugment.",
    highlights: [
      "Fine-tuned multilingual BERT with Triton acceleration and WandB tracking.",
      "Benchmarked four multilingual toxicity models across English / German / Finnish.",
      "Blended character-level noise defenses with balanced sampling strategies.",
    ],
  },
  {
    title: "Recommendation & Uni-cloud Platform",
    context: "Kunshan Yuanpai Trading · China",
    disciplineTag: "Data Products",
    result: "Reduced query latency and improved personalization for merchandising teams.",
    highlights: [
      "DBSCAN clustering + MAB exploration to surface high-value customer cohorts.",
      "Optimized MongoDB schema and SQL interfaces for order + inventory ops.",
      "Built Tableau dashboards to translate raw telemetry into decisions.",
    ],
  },
]

const skills = [
  {
    title: "Data Science / AI",
    items: [
      "Agentic RAG orchestration with LangChain + custom tools",
      "Python, PyTorch, Triton inference, Qdrant/BM25 hybrid retrieval",
      "ASR & NLP fine-tuning (DeBERTaV3, Wav2Vec2, multilingual BERT)",
    ],
  },
  {
    title: "Photography Practice",
    items: [
      "Portrait direction & candid street sessions",
      "On-location natural light planning (Stockholm / EU / Shenzhen)",
      "Color-proofing, light post-processing, and proof print prep",
    ],
  },
]

const services = [
  {
    label: "Portrait Sessions",
    description:
      "Book me as a portrait/travel friend—passport renewals, casual street walks, light retouching included (official stamped docs not supported).",
  },
  {
    label: "Data Systems Engagements",
    description:
      "Open to full-time roles or embedded sprints for retrieval, multilingual QA, ASR research, or evaluation pipelines.",
  },
]

const contactLinks = [
  {
    label: "Email",
    value: "773882712cunyli@gmail.com",
    href: "mailto:773882712cunyli@gmail.com",
    icon: Mail,
  },
  {
    label: "Instagram",
    value: "instagram.com",
    href: "https://www.instagram.com",
    icon: Instagram,
  },
  {
    label: "LinkedIn",
    value: "linkedin.com/in/lijie-li-605a2a292",
    href: "https://www.linkedin.com/in/lijie-li-605a2a292",
    icon: Linkedin,
  },
  {
    label: "Xiaohongshu",
    value: "xhslink.com/m/3mrL9nhJm4E",
    href: "https://xhslink.com/m/3mrL9nhJm4E",
    icon: XiaohongshuIcon,
  },
  {
    label: "WeChat",
    icon: MessageCircle,
    copyValue: "Llj773882712",
  },
]

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
  const [copiedContact, setCopiedContact] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const shouldReduceMotion = prefersReducedMotion
  const disableScrollLinkedMotion = prefersReducedMotion || isMobile

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
        className="relative isolate flex min-h-[100svh] items-center overflow-hidden border-b border-zinc-200 bg-white"
        {...createSectionMotionProps(isMobile ? 0.4 : 0.8)}
        variants={maybeFade}
      >
        <motion.div
          className="absolute inset-0 pointer-events-none opacity-60 [background:radial-gradient(circle_at_top,_rgba(17,24,39,0.08),_transparent_55%)]"
          style={disableScrollLinkedMotion ? undefined : { y: heroGlowY }}
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-20 sm:px-10 lg:flex-row lg:items-center">
          <motion.div className="max-w-2xl space-y-6" variants={maybeFade}>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-zinc-500">Resume</p>
            <h1 className="text-4xl font-light leading-tight text-zinc-900 sm:text-5xl lg:text-6xl">
              Lijie Li · Data Scientist & Photographer
            </h1>
            <p className="text-lg leading-relaxed text-zinc-600">
              I build multilingual AI systems for knowledge-intensive teams, and I keep a freelance-but-playful photo practice
              for friends, travelers, and anyone chasing better portraits. Whether the medium is code or light, I try to make the
              process transparent, collaborative, and quietly artful.
            </p>
            <motion.div className="flex flex-wrap gap-4" variants={maybeFade}>
              <Link
                href="#contact"
                className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium uppercase tracking-wide text-white transition hover:bg-zinc-800"
              >
                Talk Data Work
              </Link>
              <Link
                href="#master-series"
                className="rounded-full border border-zinc-900 px-5 py-2.5 text-sm font-medium uppercase tracking-wide text-zinc-900 transition hover:bg-zinc-900 hover:text-white"
              >
                Master Collections
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            className="grid w-full gap-6 rounded-3xl border border-zinc-100 bg-zinc-900/90 p-6 text-white shadow-xl sm:grid-cols-3 lg:w-auto lg:grid-cols-1"
            style={
              disableScrollLinkedMotion
                ? undefined
                : {
                    y: statsLift,
                    boxShadow: statsShadow,
                  }
            }
          >
            {[
              { label: "Data / AI Systems", value: "12" },
              { label: "Portrait Walks / Yr", value: "40+" },
              { label: "Master Shots Catalogued", value: "180+" },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                {...getCardMotionProps(index, { immediate: true })}
              >
                <p className="text-sm uppercase tracking-wide text-zinc-200">{stat.label}</p>
                <p className="mt-2 text-4xl font-light">{stat.value}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        className="border-b border-zinc-200 bg-white/60"
        variants={maybeSection}
        {...createSectionMotionProps()}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-14 sm:px-10">
          <div className="flex flex-col gap-3">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Dual Practice</p>
            <h2 className="text-2xl font-light text-zinc-900">Analytical rigor meets cinematic intuition</h2>
            <p className="text-base text-zinc-600">
              Research notebooks, lighting studies, and retrieval diagrams live in the same workspace. Data modeling informs how I
              choreograph light; field recordings inspire interaction flows.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {focusCards.map((card, index) => {
              const isDark = card.tone === "dark"
              return (
                <motion.article
                  key={card.title}
                  {...getCardMotionProps(index, { viewportAmount: 0.25 })}
                  className={`rounded-3xl border border-zinc-200 bg-gradient-to-br ${card.accent} p-8 shadow-sm`}
                >
                  <p
                    className={`text-sm uppercase tracking-wide ${
                      isDark ? "text-white/70" : "text-zinc-500"
                    }`}
                  >
                    Practice #{index + 1}
                  </p>
                  <h3 className={`mt-2 text-xl font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                    {card.title}
                  </h3>
                  <p className={`mt-3 text-base ${isDark ? "text-white/85" : "text-zinc-700"}`}>{card.description}</p>
                  <ul className={`mt-6 space-y-2 text-sm ${isDark ? "text-white/80" : "text-zinc-600"}`}>
                    {card.list.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className={`mt-1 h-1.5 w-1.5 rounded-full ${isDark ? "bg-white" : "bg-zinc-900"}`} />
                        <span>{item}</span>
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
        className="border-b border-zinc-200 bg-white"
        variants={maybeSection}
        {...createSectionMotionProps(0.3)}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-14 sm:px-10">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Hybrid Case Studies</p>
            <h2 className="text-2xl font-light text-zinc-900">Where data products and visuals converge</h2>
            <p className="text-base text-zinc-600">Selected systems pairing measurable rigor with sensory storytelling.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {caseStudies.map((study, index) => (
              <motion.article
                key={study.title}
                className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
                {...getCardMotionProps(index, { viewportAmount: 0.3 })}
              >
                <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  <span>{study.disciplineTag}</span>
                  <span>{study.context}</span>
                </div>
                <h3 className="text-lg font-medium text-zinc-900">{study.title}</h3>
                <p className="text-sm text-zinc-500">{study.result}</p>
                <ul className="mt-2 space-y-2 text-sm text-zinc-600">
                  {study.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1 w-1 rounded-full bg-zinc-900" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.article>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="border-b border-zinc-200 bg-white/60"
        variants={maybeSection}
        {...createSectionMotionProps(0.35)}
      >
        <div className="mx-auto max-w-4xl px-5 py-14 text-center sm:px-10">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Studio Notes & Dialogue</p>
          <h2 className="mt-3 text-2xl font-light text-zinc-900">Build logs, moodboards, and open conversations</h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-600">
            My background spans research-heavy programs, yet the work I share here stays grounded in shipped systems,
            experiments, and visual notebooks. I publish working notes, lighting studies, and retrieval diagrams so friends
            can drop by, swap tactics, or plan a casual photo walk.
          </p>
        </div>
      </motion.section>

      <motion.section
        className="border-b border-zinc-200 bg-white"
        variants={maybeSection}
        {...createSectionMotionProps(0.3)}
      >
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-light text-zinc-900">Experience</h2>
              <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Parallel tracks</p>
            </div>
            <Link
              href="https://www.linkedin.com/in/lijie-li-605a2a292"
              target="_blank"
              className="text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
            >
              View full CV on LinkedIn ↗
            </Link>
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            {[
              { label: "AI / Data Roles", items: experiences.filter((role) => role.discipline === "ai") },
              { label: "Creative Commissions", items: experiences.filter((role) => role.discipline === "photo") },
            ].map((column, columnIndex) => (
              <div key={column.label} className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">{column.label}</p>
                  <div className="ml-4 h-px flex-1 bg-zinc-200" />
                </div>
                {column.items.map((role, index) => (
                  <motion.div
                    key={role.title}
                    className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition will-change-transform hover:-translate-y-1 hover:shadow-md"
                    {...getCardMotionProps(index + columnIndex, { viewportAmount: 0.35 })}
                  >
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-zinc-500">{role.period}</p>
                        <h3 className="mt-1 text-lg font-medium text-zinc-900">{role.title}</h3>
                        <p className="text-sm text-zinc-500">
                          {role.organization} · {role.location}
                        </p>
                      </div>
                      <p className="text-sm text-zinc-600">{role.summary}</p>
                      <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                        {role.highlights.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-900" />
                            <span>{item}</span>
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
        id="master-series"
        className="border-b border-zinc-200 bg-zinc-900 text-white"
        variants={maybeSection}
        {...createSectionMotionProps(0.25)}
      >
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">Master-tagged Sets</p>
              <h2 className="text-2xl font-light">Curated Showcase</h2>
            </div>
            <Link
              href="/portfolio"
              className="text-sm uppercase tracking-wide text-zinc-200 underline-offset-4 hover:text-white hover:underline"
            >
              Explore all sets →
            </Link>
          </div>
          <div className="mt-10">
            <MasterShotsShowcase />
          </div>
        </div>
      </motion.section>

      <motion.section
        className="border-b border-zinc-200 bg-white"
        variants={maybeSection}
        {...createSectionMotionProps(0.35)}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-16 sm:px-10 lg:flex-row">
          <motion.div
            className="w-full rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm"
            {...getFadeInViewProps(0.4)}
          >
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Capabilities</p>
            <h2 className="mt-3 text-2xl font-light text-zinc-900">Core skills</h2>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {skills.map((group, index) => (
                <motion.div
                  key={group.title}
                  className="rounded-2xl border border-zinc-100 bg-zinc-50 p-5"
                  {...getFadeInViewProps(0.6)}
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{group.title}</p>
                  <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                    {group.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-900" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="w-full rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm"
            {...getFadeInViewProps(0.4)}
          >
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Commissions & Engagements</p>
            <h2 className="mt-3 text-2xl font-light text-zinc-900">Ways we can collaborate</h2>
            <div className="mt-6 flex flex-col gap-4 lg:flex-row">
              {services.map((service, index) => (
                <motion.div
                  key={service.label}
                  className="flex flex-1 flex-col justify-between rounded-3xl border border-zinc-100 bg-zinc-50/80 px-6 py-6 shadow-inner"
                  {...getFadeInViewProps(0.6)}
                >
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{service.label}</p>
                    <p className="mt-3 text-base text-zinc-700">{service.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        id="contact"
        className="bg-white"
        variants={maybeSection}
        {...createSectionMotionProps(0.4)}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-16 text-center sm:px-10">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Availability</p>
          <h2 className="text-3xl font-light text-zinc-900">Accepting shoots & data engagements</h2>
          <p className="text-base text-zinc-600">
            Currently booking portrait sessions across Europe and Shenzhen, and taking on remote/onsite data science
            engagements that run from retrieval architecture to ASR research sprints.
          </p>
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-4">
            {contactLinks.map((contact) => {
              const Icon = contact.icon
              if (contact.copyValue) {
                return (
                  <button
                    key={contact.label}
                    type="button"
                    title={`Copy ${contact.label}`}
                    aria-label={`Copy ${contact.label}`}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:-translate-y-0.5 hover:border-zinc-300"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(contact.copyValue || "")
                        setCopiedContact(contact.label)
                        setTimeout(() => setCopiedContact(null), 1500)
                      } catch {
                        setCopiedContact("Copy failed")
                        setTimeout(() => setCopiedContact(null), 1500)
                      }
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
                  key={contact.label}
                  href={contact.href}
                  target="_blank"
                  rel="noreferrer"
                  title={contact.label}
                  aria-label={contact.label}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:-translate-y-0.5 hover:border-zinc-300"
                >
                  <Icon className="h-5 w-5" />
                  <span className="sr-only">{contact.label}</span>
                </Link>
              )
            })}
          </div>
          {copiedContact && (
            <p className="text-xs text-emerald-500" role="status">
              {copiedContact === "Copy failed" ? "Copy failed. Please try again." : `${copiedContact} copied!`}
            </p>
          )}
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Based in Stockholm · Shenzhen friendly · English / 中文
          </p>
        </div>
      </motion.section>
    </div>
  )
}
