"use client"

import { useDocumentTitle } from "@/lib/use-document-title"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Check, ChevronDown, Copy, Linkedin, Mail, MessageCircle } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { LangSwitcher } from "./lang-switcher"
import styles from "./resume-studio.module.css"

type Locale = "en" | "zh"
type LocalizedString = Record<Locale, string>

type Experience = {
  title: LocalizedString
  organization: LocalizedString
  location: LocalizedString
  period: LocalizedString
  summary: LocalizedString
  highlights: LocalizedString[]
  discipline: "ai"
}

type CaseStudy = {
  title: LocalizedString
  context: LocalizedString
  disciplineTag: LocalizedString
  result: LocalizedString
  highlights: LocalizedString[]
  href?: string
  linkLabel?: LocalizedString
}

const heroCopy = {
  title: {
    en: "Lijie Li · Data Scientist",
    zh: "李立杰 · 数据科学",
  },
  schools: {
    en: ["Aalto University", "KTH Royal Institute of Technology"],
    zh: ["阿尔托大学", "瑞典皇家工学院"],
  },
  description: {
    en: "MSc Data Science candidate at Aalto and KTH. I work on speech AI, retrieval systems, and practical ML pipelines, with current research on universal speech enhancement for speech-based health biomarkers.",
    zh: "Aalto 与 KTH 数据科学硕士在读。主要做语音 AI、检索系统和可复现实验流水线，目前研究面向健康语音生物标志物的通用语音增强。",
  },
  primaryCta: { en: "Contact", zh: "联系我" },
}


const caseStudies: CaseStudy[] = [
  {
    title: {
      en: "Public AI Feed",
      zh: "公开 AI 信息流",
    },
    context: {
      en: "Personal portfolio · Next.js public demo",
      zh: "个人作品集 · Next.js 公开 Demo",
    },
    disciplineTag: { en: "Productized AI Workflow", zh: "AI 工作流产品化" },
    result: {
      en: "A read-only public version of my private AI feed, designed to show useful signals without exposing personal workflow state.",
      zh: "把私有 AI 信息流整理成可分享的只读公开版，只展示有价值的信号，不暴露个人工作流状态。",
    },
    highlights: [
      {
        en: "Built as `/ai-feed/public` with data served through `/api/ai-feed/public`, separate from the private `/ai-feed` workbench.",
        zh: "页面实现为 `/ai-feed/public`，数据由 `/api/ai-feed/public` 提供，与私有 `/ai-feed` 工作台分离。",
      },
      {
        en: "Keeps only public-facing blocks and removes pinned items, read/discard state, task controls, and admin affordances.",
        zh: "只保留适合公开展示的内容块，并移除钉住、已读/丢弃状态、待办控制和 admin 入口。",
      },
      {
        en: "Filters personal and tracking-heavy links before rendering, so the page can serve as a live demo from the resume site.",
        zh: "渲染前过滤个人链接和追踪型链接，让页面可以作为简历站里的在线 Demo。",
      },
    ],
    href: "/ai-feed/public",
    linkLabel: { en: "Open public demo", zh: "打开公开 Demo" },
  },
  {
    title: {
      en: "Universal Speech Enhancement for Health Biomarkers",
      zh: "面向健康语音生物标志物的通用语音增强",
    },
    context: {
      en: "Aalto University · Master's thesis / research assistant work",
      zh: "Aalto University · 硕士论文 / 研究助理工作",
    },
    disciplineTag: { en: "Speech Research", zh: "语音研究" },
    result: {
      en: "Testing whether enhancement can reduce recording-condition drift before biomarker classification.",
      zh: "测试语音增强能否在生物标志物分类前缓解录音条件漂移。",
    },
    highlights: [
      {
        en: "Building distorted-speech simulation and cleaning pipelines for noisy, reverberant, codec-degraded, and microphone-mismatched speech.",
        zh: "构建失真语音模拟与清理流程，覆盖噪声、混响、codec 退化与麦克风差异。",
      },
      {
        en: "Benchmarking public speech-enhancement baselines and connecting outputs to the lab's AVQI biomarker evaluation pipeline.",
        zh: "评测公开语音增强 baseline，并将增强结果接入实验室已有 AVQI 生物标志物评估流程。",
      },
      {
        en: "Running PyTorch experiments on Aalto Triton with Slurm job scripts and WandB records.",
        zh: "在 Aalto Triton 上用 Slurm 和 WandB 运行、记录 PyTorch 实验。",
      },
    ],
  },
  {
    title: {
      en: "Legal QA with Agentic RAG",
      zh: "法律问答 Agentic RAG",
    },
    context: {
      en: "Lexembed · Sweden",
      zh: "Lexembed · 瑞典",
    },
    disciplineTag: { en: "Retrieval Systems", zh: "检索系统" },
    result: {
      en: "Built components for source-grounded legal QA over uploaded document collections.",
      zh: "为上传文档集合构建带来源依据的法律问答组件。",
    },
    highlights: [
      {
        en: "Implemented query decomposition, entity extraction, document retrieval, and source-grounded answer generation.",
        zh: "实现问题拆解、实体抽取、文档检索和有来源依据的答案生成。",
      },
      {
        en: "Used RAGAS-style checks to compare retrieval relevance, answer grounding, and citation quality.",
        zh: "使用 RAGAS 风格评估比较检索相关性、答案 grounding 和引用质量。",
      },
      {
        en: "Kept the workflow explicit because legal QA needs traceability more than fluent unconstrained generation.",
        zh: "保持流程显式可追踪，因为法律问答比普通生成更依赖证据链。",
      },
    ],
  },
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
      en: "Built a pipeline for merging innovation records from company sources and graph files.",
      zh: "构建将公司来源与图谱文件中的创新记录合并的流水线。",
    },
    highlights: [
      {
        en: "Flattened graph relationships into a unified relation table before entity resolution and graph reconstruction.",
        zh: "先将图关系展平成统一关系表，再进行实体消解和规范图谱重建。",
      },
      {
        en: "Used embeddings and HDBSCAN for semantic duplicate detection while preserving source IDs, names, descriptions, and lineage.",
        zh: "用 embedding 与 HDBSCAN 做语义去重，同时保留 source id、名称、描述和来源追踪。",
      },
      {
        en: "Built hybrid retrieval with Qdrant ANN + BM25, RRF fusion, and Cross-Encoder reranking; evaluated with Hit Rate and MRR.",
        zh: "构建 Qdrant ANN + BM25、RRF 融合和 Cross-Encoder 重排，并用 Hit Rate / MRR 评估。",
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
        en: "Fine-tuned Wav2Vec2-BERT with SpecAugment and regularization for low-resource Esperanto ASR.",
        zh: "使用 Wav2Vec2-BERT、SpecAugment 和正则化做低资源世界语 ASR。",
      },
      {
        en: "Benchmarked multilingual toxicity models across English, German, and Finnish.",
        zh: "在英语、德语和芬兰语上评测多语毒性分类模型。",
      },
      {
        en: "Used Triton GPU resources and WandB to track model comparisons and error analysis.",
        zh: "使用 Triton GPU 资源和 WandB 记录模型对比与错误分析。",
      },
    ],
  },
  {
    title: {
      en: "Reference-Based AI Image Tampering Localization",
      zh: "基于参考图像的 AI 篡改定位",
    },
    context: { en: "Aalto Computer Vision Challenge", zh: "Aalto 计算机视觉挑战" },
    disciplineTag: { en: "Computer Vision", zh: "计算机视觉" },
    result: {
      en: "Localized AI-edited regions by comparing a reference image with its modified version, treating the task as supervised change segmentation.",
      zh: "通过比较参考原图与 AI 编辑图定位被修改区域，将任务建模为有监督变化分割。",
    },
    highlights: [
      {
        en: "Used a Siamese encoder-decoder setup with shared visual encoders and feature-difference fusion, rather than simple RGB subtraction.",
        zh: "采用共享视觉编码器的 Siamese encoder-decoder 和特征差分融合，而不是简单 RGB 差分。",
      },
      {
        en: "Trained the segmentation head with mask-aware losses such as Dice/Focal-style objectives to handle small edited regions.",
        zh: "用 Dice / Focal 风格的 mask-aware loss 训练分割头，处理篡改区域较小的问题。",
      },
      {
        en: "Applied asymmetric augmentation on the edited branch, including compression, color shifts, resizing artifacts, and slight misalignment, to avoid learning only pixel noise.",
        zh: "只在编辑图分支加入压缩、色彩偏移、缩放伪影和轻微错位等非对称增强，避免模型只学习像素噪声。",
      },
    ],
  },
  {
    title: {
      en: "Delivery Time Estimation with Calibrated Uncertainty",
      zh: "带校准不确定性的配送时间预测",
    },
    context: { en: "Wolt Data Science Case", zh: "Wolt 数据科学案例" },
    disciplineTag: { en: "Predictive Modeling", zh: "预测建模" },
    result: {
      en: "Built ETA point models and calibrated prediction intervals for skewed delivery-time errors.",
      zh: "针对右偏配送时间误差构建 ETA 点预测模型和校准预测区间。",
    },
    highlights: [
      {
        en: "Compared target transformations such as raw minutes versus log1p minutes to reduce the effect of long-tail delays.",
        zh: "比较原始分钟数与 log1p 分钟数等目标变换，降低长尾延迟对训练的影响。",
      },
      {
        en: "Tested tree-based regression baselines and inspected residual distributions to separate systematic bias from random delay variance.",
        zh: "测试树模型回归 baseline，并分析残差分布，区分系统性偏差和随机延迟波动。",
      },
      {
        en: "Applied asymmetric conformal prediction on calibration residuals so ETA ranges can allocate more uncertainty to late deliveries than early arrivals.",
        zh: "在校准残差上应用非对称 conformal prediction，让 ETA 区间对迟到分配比早到更多的不确定性。",
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
      en: "Implemented a small recommendation and data-service stack for order, inventory, and customer behavior data.",
      zh: "实现面向订单、库存和用户行为数据的小型推荐与数据服务栈。",
    },
    highlights: [
      {
        en: "Combined DBSCAN customer segmentation, matrix-factorization candidates, and MAB-style re-ranking.",
        zh: "结合 DBSCAN 客群细分、矩阵分解候选生成和 MAB 风格重排。",
      },
      {
        en: "Optimized MongoDB schema and indexes for common order, inventory, and recommendation queries.",
        zh: "针对常见订单、库存和推荐查询优化 MongoDB schema 与索引。",
      },
      {
        en: "Built SQL interfaces and Tableau dashboards for operational reporting.",
        zh: "构建 SQL 接口和 Tableau 看板，用于运营分析。",
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
      en: "Built a campaign-generation workflow that converts a brief into localized SMS/email assets with review checks.",
      zh: "构建将 campaign brief 转换为本地化 SMS / email 资产的生成流程，并加入审核检查。",
    },
    highlights: [
      {
        en: "Used n8n to orchestrate brief parsing, audience/language adaptation, channel-specific copy generation, and asset handoff.",
        zh: "使用 n8n 编排 brief 解析、受众与语言适配、分渠道文案生成和资产交付。",
      },
      {
        en: "Added a self-review step to check brand constraints, safety rules, and SMS/email length limits before final output.",
        zh: "加入自检步骤，在最终输出前检查品牌约束、安全规则和 SMS / email 长度限制。",
      },
    ],
  },
  {
    title: {
      en: "LLM-Based Academic Paper Translation Pipeline",
      zh: "基于 LLM 的论文翻译流程",
    },
    context: { en: "Personal tooling for paper reading", zh: "个人论文阅读工具" },
    disciplineTag: { en: "Document AI", zh: "文档 AI" },
    result: {
      en: "Built a personal research workflow around Codex skills, Zotero MCP, Obsidian notes, and LLM-assisted paper reading.",
      zh: "围绕 Codex skills、Zotero MCP、Obsidian 笔记和 LLM 辅助阅读构建个人论文工作流。",
    },
    highlights: [
      {
        en: "Created and used Codex skills for paper analysis, PDF translation, image extraction, paper recommendation, and Obsidian-formatted note generation.",
        zh: "创建并使用 Codex skills 做论文分析、PDF 翻译、图片提取、论文推荐和 Obsidian 格式笔记生成。",
      },
      {
        en: "Connected Zotero/MCP-style metadata lookup with arXiv/PDF parsing so paper notes include source links, bibliographic context, and extracted figures.",
        zh: "把 Zotero/MCP 风格元数据查询与 arXiv/PDF 解析连接起来，让论文笔记包含来源链接、文献信息和提取图片。",
      },
      {
        en: "Optimized OCR, context-window chunking, and section-aware prompts for long academic PDFs, then saved structured bilingual notes into Obsidian.",
        zh: "优化 OCR、上下文窗口切分和按章节 prompt，用于长 PDF 论文阅读，并保存结构化双语 Obsidian 笔记。",
      },
    ],
  },
]


const experiences: Experience[] = [
  {
    title: { en: "Research Assistant / Master's Thesis Worker", zh: "研究助理 / 硕士论文研究员" },
    organization: { en: "Aalto University", zh: "Aalto University" },
    location: { en: "Espoo, Finland", zh: "芬兰·Espoo" },
    period: { en: "Feb 2026 — Present", zh: "2026 年 2 月 — 至今" },
    discipline: "ai",
    summary: {
      en: "Working on universal speech enhancement for speech-based health biomarkers, with emphasis on data drift, benchmark setup, and downstream evaluation.",
      zh: "研究面向健康语音生物标志物的通用语音增强，重点是数据漂移、benchmark 搭建和下游评估。",
    },
    highlights: [
      {
        en: "Researching and building distorted-data simulation for USE experiments, including noisy, reverberant, codec-degraded, and microphone-mismatched speech.",
        zh: "研究并构建 USE 实验所需的失真数据模拟，包括噪声、混响、codec 退化和麦克风不匹配。",
      },
      {
        en: "Connecting public SE baselines to the lab's AVQI biomarker evaluation pipeline to test whether enhancement reduces drift-induced classification failures.",
        zh: "将公开语音增强 baseline 接入实验室 AVQI 生物标志物评估流程，测试增强能否缓解数据漂移导致的分类失败。",
      },
    ],
  },
  {
    title: { en: "Data Scientist", zh: "数据科学家" },
    organization: { en: "Lexembed", zh: "Lexembed" },
    location: { en: "Sweden", zh: "瑞典" },
    period: { en: "Aug 2025 — Feb 2026", zh: "2025 年 8 月 — 2026 年 2 月" },
    discipline: "ai",
    summary: {
      en: "Developing legal QA components around Agentic RAG, document retrieval, and source-grounded generation.",
      zh: "围绕 Agentic RAG、文档检索和有来源依据的生成开发法律问答组件。",
    },
    highlights: [
      {
        en: "Built query decomposition, entity extraction, knowledge-graph context, and case-based retrieval steps for uploaded legal documents.",
        zh: "为上传法律文档构建问题拆解、实体抽取、知识图谱上下文和案例检索步骤。",
      },
      {
        en: "Used RAGAS-based checks to compare citation grounding, answer relevance, and retrieval quality during iteration.",
        zh: "在迭代中用 RAGAS 风格指标比较引用 grounding、答案相关性和检索质量。",
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
]


const skills = [
  {
    title: { en: "ML / Systems", zh: "机器学习 / 系统" },
    items: [
      { en: "Python, PyTorch, scikit-learn, LangChain, Pydantic", zh: "Python、PyTorch、scikit-learn、LangChain、Pydantic" },
      { en: "Speech enhancement, ASR, RAG, embeddings, Mamba, conformal prediction", zh: "语音增强、ASR、RAG、embedding、Mamba、conformal prediction" },
      { en: "Linux, Slurm, Triton HPC, GPU training, Docker, Git, WandB", zh: "Linux、Slurm、Triton HPC、GPU 训练、Docker、Git、WandB" },
      { en: "MongoDB, Qdrant, BM25, HDBSCAN, Spark, Tableau", zh: "MongoDB、Qdrant、BM25、HDBSCAN、Spark、Tableau" },
    ],
  },
]


const services = [
  {
    label: { en: "Data Science Roles", zh: "数据科学岗位" },
    description: {
      en: "Open to full-time roles in ML/NLP, retrieval, and applied research; short consulting is possible.",
      zh: "开放 ML/NLP、检索与应用研究方向的全职岗位，也可短期咨询合作。",
    },
  },
]


const contactLinks = [
  {
    key: "email",
    label: { en: "Email", zh: "邮箱" },
    value: "773882712cunyli@gmail.com",
    href: "mailto:773882712cunyli@gmail.com",
    icon: Mail,
  },
  {
    key: "linkedin",
    label: { en: "LinkedIn", zh: "LinkedIn" },
    value: "linkedin.com/in/cunyli",
    href: "https://www.linkedin.com/in/cunyli",
    icon: Linkedin,
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
  heading: { en: "Open to data science roles", zh: "开放数据科学岗位" },
  body: {
    en: "Based in Espoo. Open to onsite or remote ML, speech, retrieval, and AI infrastructure roles across Europe, and to internship opportunities in China.",
    zh: "常驻 Espoo，开放欧洲范围内线下或远程的 ML、语音、检索和 AI infrastructure 岗位，也接受国内实习机会。",
  },
  footer: {
    en: "Based in Espoo · Europe roles · China internships · English / 中文",
    zh: "常驻 Espoo · 欧洲岗位 · 国内实习 · English / 中文",
  },
}


const copyFeedback = {
  copyPrefix: { en: "Copy", zh: "复制" },
  copiedSuffix: { en: "copied!", zh: "已复制！" },
  copyFailed: { en: "Copy failed. Please try again.", zh: "复制失败，请重试。" },
}


const photographyPreview = [
  { src: "/photo-session/dsc06071-1280.jpg", alt: { en: "A travel portrait overlooking a mountain lake", zh: "山间湖泊旁的旅行人像" } },
  { src: "/photo-session/dsc07258-1280.jpg", alt: { en: "A portrait beside turquoise mountain water", zh: "碧绿湖水旁的人像" } },
  { src: "/photo-session/dsc09183-2-1280.jpg", alt: { en: "Reading in the warm light of a journey", zh: "旅途中暖光下的阅读片刻" } },
  { src: "/photo-session/dsc06766-1280.jpg", alt: { en: "A photographer in an alpine flower field", zh: "高山花田里的摄影者" } },
]

export function ResumePage() {
  const { locale } = useI18n()
  useDocumentTitle(`${locale==="zh"?"简历":"Resume"} · Lijie Li`)
  const lang: Locale = locale === "en" ? "en" : "zh"
  const zh = lang === "zh"
  const page = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const reset = useRef<number | null>(null)

  useEffect(() => {
    const root = page.current
    if (!root) return
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.target.hasAttribute("data-photo-window")) {
          entry.target.setAttribute("data-in-view", String(entry.isIntersecting))
        } else if (entry.isIntersecting) {
          entry.target.setAttribute("data-revealed", "true")
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.06 })
    root.querySelectorAll("[data-reveal], [data-photo-window]").forEach(element => observer.observe(element))
    root.dataset.enhanced = "true"
    return () => {
      observer.disconnect()
      if (reset.current !== null) window.clearTimeout(reset.current)
    }
  }, [])

  const copyWeChat = async () => {
    try {
      await navigator.clipboard.writeText("Llj773882712")
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
    if (reset.current !== null) window.clearTimeout(reset.current)
    reset.current = window.setTimeout(() => setCopied(false), 2600)
  }
  const featured = caseStudies[1]
  const projects = caseStudies.filter((_, index) => index !== 1)

  return <div ref={page} className={styles.page} data-editorial-resume lang={lang}>
    <header className={`${styles.header} ${styles.shell}`}>
      <a href="#top" className={styles.brand}>Lijie Li<span aria-hidden="true">.</span></a>
      <div className={styles.headerRight}>
        <a href="#contact" className={styles.smallLink}>{zh ? "联系我" : "Get in touch"}<ArrowUpRight size={14} aria-hidden="true" /></a>
        <LangSwitcher />
      </div>
    </header>

    <section id="top" className={styles.hero} aria-labelledby="resume-heading">
      <p className={`${styles.eyebrow} ${styles.arrive}`} style={{ animationDelay: "50ms" }}>{zh ? "数据科学 / 应用研究" : "DATA SCIENCE / APPLIED RESEARCH"}</p>
      <h1 id="resume-heading" className={`${styles.heroTitle} ${styles.arrive}`} style={{ animationDelay: "120ms" }}>
        {zh ? <>让模型，<br /><span>走进真实问题。</span></> : <>Models for<br /><span>real-world questions.</span></>}
      </h1>
      <p className={`${styles.introduction} ${styles.arrive}`} style={{ animationDelay: "200ms" }}>{heroCopy.description[lang]}</p>
      <div className={`${styles.heroActions} ${styles.arrive}`} style={{ animationDelay: "280ms" }}>
        <a href="#contact" className={styles.primaryButton}>{heroCopy.primaryCta[lang]}<ArrowUpRight size={16} aria-hidden="true" /></a>
        <Link href="/portfolio" className={styles.secondaryButton}>{zh ? "摄影作品集" : "Photography portfolio"}<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
      <div className={`${styles.schools} ${styles.arrive}`} style={{ animationDelay: "360ms" }}>{heroCopy.schools[lang].map(school => <span key={school}>{school}</span>)}</div>
      <nav className={styles.sectionNav} aria-label={zh ? "简历章节" : "Resume sections"}>
        <a href="#case-studies"><span>01</span>{zh ? "项目" : "Projects"}</a>
        <a href="#experience"><span>02</span>{zh ? "经历" : "Experience"}</a>
        <a href="#contact"><span>03</span>{zh ? "联系" : "Contact"}</a>
      </nav>
    </section>

    <section className={styles.photography} aria-label={zh ? "摄影作品预览" : "Photography preview"}>
      <div className={styles.photoWindow} data-photo-window>
        <div className={styles.photoTrack}>
          {[0, 1].map(copy => <div className={styles.photoGroup} key={copy} aria-hidden={copy === 1 ? true : undefined}>
            {photographyPreview.map(photo => <Link href="/portfolio" className={styles.photo} key={photo.src} tabIndex={copy === 1 ? -1 : undefined} aria-label={copy === 0 ? `${zh ? "查看作品集：" : "View portfolio: "}${photo.alt[lang]}` : undefined}>
              <img src={photo.src} width={1280} height={853} alt={copy === 0 ? photo.alt[lang] : ""} loading="lazy" decoding="async" draggable={false} />
              <span className={styles.photoArrow} aria-hidden="true"><ArrowUpRight size={20} strokeWidth={1.4} /></span>
            </Link>)}
          </div>)}
        </div>
      </div>
      <div className={`${styles.photoCaption} ${styles.shell}`}>
        <span>{zh ? "摄影" : "PHOTOGRAPHY"}</span>
        <Link href="/portfolio" className={styles.textLink}>{zh ? "打开作品集" : "Explore the portfolio"}<ArrowUpRight size={15} aria-hidden="true" /></Link>
      </div>
    </section>

    <div className={styles.shell}>
      <section id="case-studies" className={styles.section}>
        <div className={styles.sectionHeading} data-reveal>
          <div><span className={styles.sectionIndex}>01 / {zh ? "项目" : "PROJECTS"}</span><h2>{zh ? "把想法做出来。" : "Ideas, put to work."}</h2></div>
          <span className={styles.sectionMeta}>{String(caseStudies.length).padStart(2, "0")} {zh ? "个项目" : "projects"}</span>
        </div>
        <div className={styles.projectLayout}>
          <article className={styles.featuredProject} data-reveal>
            <div className={styles.featuredTop}><span>{zh ? "当前研究" : "CURRENT RESEARCH"}</span><span>01</span></div>
            <div className={styles.researchMotif} aria-hidden="true">
              <svg viewBox="0 0 400 90" fill="none"><path d="M0 45H400" stroke="currentColor" opacity=".16" />{Array.from({ length: 64 }, (_, index) => {
                const height = 4 + Math.pow(Math.sin(index * 0.38), 2) * Math.sin(Math.PI * index / 63) * 75
                return <path key={index} d={`M${(index * 6.2 + 4).toFixed(2)} ${(45 - height / 2).toFixed(2)}v${height.toFixed(2)}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              })}</svg>
            </div>
            <h3>{featured.title[lang]}</h3>
            <p className={styles.featuredContext}>{featured.context[lang]}</p>
            <p className={styles.featuredResult}>{featured.result[lang]}</p>
            <ul>{featured.highlights.map(item => <li key={item.en}>{item[lang]}</li>)}</ul>
            <a href="#contact" className={styles.featuredLink}>{zh ? "聊聊这个研究" : "Talk about the research"}<ArrowUpRight size={18} aria-hidden="true" /></a>
          </article>
          <div className={styles.projectList}>
            {projects.map((project, index) => <details className={styles.project} key={project.title.en} data-reveal>
              <summary><span className={styles.projectNumber}>{String(index + 2).padStart(2, "0")}</span><div><span className={styles.projectTag}>{project.disciplineTag[lang]}</span><h3>{project.title[lang]}</h3><p>{project.context[lang]}</p></div><ChevronDown size={18} strokeWidth={1.3} aria-hidden="true" /></summary>
              <div className={styles.projectDetails}><p>{project.result[lang]}</p><ul>{project.highlights.map(item => <li key={item.en}>{item[lang]}</li>)}</ul>{project.href && <Link className={styles.textLink} href={project.href}>{project.linkLabel?.[lang] || (zh ? "查看项目" : "Open project")}<ArrowUpRight size={15} aria-hidden="true" /></Link>}</div>
            </details>)}
          </div>
        </div>
      </section>

      <section id="experience" className={styles.section}>
        <div className={styles.sectionHeading} data-reveal><div><span className={styles.sectionIndex}>02 / {zh ? "经历" : "EXPERIENCE"}</span><h2>{zh ? "一路做过的事。" : "Along the way."}</h2></div><a href="https://www.linkedin.com/in/cunyli" target="_blank" rel="noreferrer" className={styles.textLink}>LinkedIn<ArrowUpRight size={14} aria-hidden="true" /></a></div>
        <div className={styles.experiences}>{experiences.map(role => <article key={role.organization.en} className={styles.experience} data-reveal>
          <div className={styles.experienceDate}><p>{role.period[lang]}</p><span>{role.location[lang]}</span></div>
          <div><p className={styles.organization}>{role.organization[lang]}</p><h3>{role.title[lang]}</h3><p className={styles.body}>{role.summary[lang]}</p></div>
        </article>)}</div>
        <div className={styles.skills} data-reveal>{skills[0].items.map((item, index) => <div key={item.en}><span>{(zh ? ["语言与工具", "模型与方法", "实验与部署", "数据与检索"] : ["Code & tools", "Models & methods", "Experiments & deployment", "Data & retrieval"])[index]}</span><p>{item[lang]}</p></div>)}</div>
      </section>

      <section id="contact" className={styles.resumeContact} data-reveal>
        <span className={styles.sectionIndex}>03 / {zh ? "联系" : "CONTACT"}</span>
        <div className={styles.contactGrid}>
          <div><h2>{zh ? <>聊聊<br /><span>下一件事。</span></> : <>Let’s talk<br /><span>about what’s next.</span></>}</h2><p className={styles.body}>{availabilityCopy.body[lang]}</p></div>
          <div className={styles.contactLinks}>
            {contactLinks.filter(contact => contact.href).map(contact => <a href={contact.href} key={contact.key} target={contact.href?.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer"><div><span>{contact.label[lang]}</span><p>{contact.value}</p></div><ArrowUpRight size={22} strokeWidth={1.4} aria-hidden="true" /></a>)}
            <button type="button" onClick={copyWeChat}><div><span>{zh ? "微信" : "WeChat"}</span><p>Llj773882712</p></div>{copied ? <Check size={21} aria-hidden="true" /> : <Copy size={19} strokeWidth={1.4} aria-hidden="true" />}</button>
            <p className={styles.copyStatus} role="status">{copied ? (zh ? "微信号已复制" : "WeChat ID copied") : copyError ? (zh ? "请复制：Llj773882712" : "Copy: Llj773882712") : ""}</p>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <a href="#top" className={styles.brand}>Lijie Li<span aria-hidden="true">.</span></a>
        <div><Link href="/portfolio">{zh ? "作品集" : "Portfolio"}<ArrowUpRight size={14} aria-hidden="true" /></Link><Link href="/helsinki-photo-session">{zh ? "约拍" : "Photo sessions"}<ArrowUpRight size={14} aria-hidden="true" /></Link></div>
      </footer>
    </div>
  </div>
}
