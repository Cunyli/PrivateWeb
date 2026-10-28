// Series stay intact: a setting, a portrait, then the quieter details.
// Previews preserve the complete frame; the viewer keeps the original source.
export type SelectedSessionMoment = {
  sourceName: string
  id: string
  src: string
  previewSrc: string
  previewSrcSet?: string
  width: number
  height: number
  alt: {zh: string; en: string}
}

export type SelectedSessionSeries = {
  id: string
  title: string
  place: string
  photos: readonly SelectedSessionMoment[]
}

export const sessionMomentSeries = [
  {
    "id": "ziyang-stockholm",
    "title": "Ziyang",
    "place": "Stockholm",
    "photos": [
      {
        "sourceName": "DSC04140",
        "id": "portrait-2829",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782607427089-9-8fe440af-dcd5-42fc-9701-5f32945b4f3b-DSC04140/w1280.webp",
        "previewSrc": "/photo-session/optimized/dsc04140-640.webp",
        "previewSrcSet": "/photo-session/optimized/dsc04140-640.webp 640w, /photo-session/optimized/dsc04140-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "斯德哥尔摩水边，城市远景中的花束人像",
          "en": "A bouquet portrait with Stockholm across the water"
        }
      },
      {
        "sourceName": "DSC04113",
        "id": "portrait-2828",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782607427089-8-d4d6fefc-1a16-4aee-8b1c-2b55b0aa2f81-DSC04113/w1280.webp",
        "previewSrc": "/portrait-book/DSC04113-640.webp",
        "previewSrcSet": "/portrait-book/DSC04113-640.webp 640w, /portrait-book/DSC04113-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "码头栏杆旁抱着花束的人像",
          "en": "A portrait holding flowers beside the waterfront railing"
        }
      },
      {
        "sourceName": "DSC04070",
        "id": "portrait-2826",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782607427089-6-4c46b380-836f-47d6-87a4-6a7f2cbf05b3-DSC04070/w1280.webp",
        "previewSrc": "/portrait-book/DSC04070-640.webp",
        "previewSrcSet": "/portrait-book/DSC04070-640.webp 640w, /portrait-book/DSC04070-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "水边抱着花束微笑的人像",
          "en": "A smiling portrait with flowers by the water"
        }
      },
      {
        "sourceName": "DSC04154",
        "id": "portrait-2830",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782607427089-10-3df6b0cf-4eab-406b-a432-d55f892d842b-DSC04154/w1280.webp",
        "previewSrc": "/portrait-book/DSC04154-640.webp",
        "previewSrcSet": "/portrait-book/DSC04154-640.webp 640w, /portrait-book/DSC04154-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "花束旁的人像特写",
          "en": "A close portrait beside a bouquet"
        }
      }
    ]
  },
  {
    "id": "xiya-stockholm",
    "title": "Xiya",
    "place": "Stockholm",
    "photos": [
      {
        "sourceName": "DSC04186",
        "id": "portrait-2844",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782607808656-12-440aebba-ff28-4380-bbd9-0c0872965862-DSC04186/w1280.webp",
        "previewSrc": "/portrait-book/DSC04186-640.webp",
        "previewSrcSet": "/portrait-book/DSC04186-640.webp 640w, /portrait-book/DSC04186-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "夜色里抱着花束回望的人像",
          "en": "A portrait looking back with flowers at dusk"
        }
      },
      {
        "sourceName": "DSC04064",
        "id": "portrait-2841",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782607808656-9-8298dc33-d17f-47cb-b6d8-e68cdd000966-DSC04064/w1280.webp",
        "previewSrc": "/portrait-book/DSC04064-640.webp",
        "previewSrcSet": "/portrait-book/DSC04064-640.webp 426w, /portrait-book/DSC04064-1280.webp 853w",
        "width": 853,
        "height": 1280,
        "alt": {
          "zh": "湖畔拿着花束的背影",
          "en": "A lakeside portrait with a bouquet"
        }
      },
      {
        "sourceName": "DSC03927",
        "id": "portrait-2834",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782607808656-2-3e8b744a-a7c5-4f31-b6e7-532d9666c86c-DSC03927/w1280.webp",
        "previewSrc": "/portrait-book/DSC03927-640.webp",
        "previewSrcSet": "/portrait-book/DSC03927-640.webp 640w, /portrait-book/DSC03927-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "水边低头看花的白裙人像",
          "en": "A portrait looking down at flowers beside the water"
        }
      },
      {
        "sourceName": "DSC03917",
        "id": "portrait-2833",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782607808655-1-2059db20-f29d-442d-9a4e-536e0a202481-DSC03917/w1280.webp",
        "previewSrc": "/portrait-book/DSC03917-640.webp",
        "previewSrcSet": "/portrait-book/DSC03917-640.webp 640w, /portrait-book/DSC03917-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "秋千上的自然人像",
          "en": "A relaxed portrait on a swing"
        }
      },
      {
        "sourceName": "DSC04308",
        "id": "portrait-2849",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782607808656-17-c347b2b7-2ede-4d76-b34d-4be76ebff2c1-DSC04308/w1280.webp",
        "previewSrc": "/portrait-book/DSC04308-640.webp",
        "previewSrcSet": "/portrait-book/DSC04308-640.webp 640w, /portrait-book/DSC04308-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "红砖街角的毕业人像",
          "en": "A graduation portrait on a red-brick city street"
        }
      }
    ]
  },
  {
    "id": "hongjia-helsinki",
    "title": "Hongjia",
    "place": "Helsinki",
    "photos": [
      {
        "sourceName": "DSC05589",
        "id": "portrait-2859",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782608854649-2-76acfff2-d44b-45a2-af33-eec517d18186-DSC05589/w1280.webp",
        "previewSrc": "/portrait-book/DSC05589-640.webp",
        "previewSrcSet": "/portrait-book/DSC05589-640.webp 640w, /portrait-book/DSC05589-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "樱花树下光影中的人像",
          "en": "A portrait in light beneath cherry blossoms"
        }
      },
      {
        "sourceName": "DSC05614",
        "id": "portrait-2860",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782608854649-3-a32abcd2-e9d0-4246-855b-e0f382f3386c-DSC05614/w1280.webp",
        "previewSrc": "/portrait-book/DSC05614-640.webp",
        "previewSrcSet": "/portrait-book/DSC05614-640.webp 426w, /portrait-book/DSC05614-1280.webp 853w",
        "width": 853,
        "height": 1280,
        "alt": {
          "zh": "樱花与前景枝叶间的人像",
          "en": "A portrait framed by cherry blossoms and leaves"
        }
      },
      {
        "sourceName": "DSC05771",
        "id": "portrait-2861",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782608854649-4-8352088e-c7b9-452f-8a0d-e69b1e9bae32-DSC05771/w1280.webp",
        "previewSrc": "/portrait-book/DSC05771-640.webp",
        "previewSrcSet": "/portrait-book/DSC05771-640.webp 360w, /portrait-book/DSC05771-1280.webp 720w",
        "width": 720,
        "height": 1280,
        "alt": {
          "zh": "樱花小路上的全身人像",
          "en": "A full-length portrait on a path beneath cherry blossoms"
        }
      }
    ]
  },
  {
    "id": "rico-zermatt",
    "title": "Rico",
    "place": "Zermatt",
    "photos": [
      {
        "sourceName": "DSC06371",
        "id": "portrait-2872",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782610139772-3-4e5e7938-ed88-48d2-9d2d-fce089380d22-DSC06371/w1280.webp",
        "previewSrc": "/photo-session/optimized/dsc06371-640.webp",
        "previewSrcSet": "/photo-session/optimized/dsc06371-640.webp 640w, /photo-session/optimized/dsc06371-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "雪山前的旅行人像",
          "en": "A travel portrait in front of snowy mountains"
        }
      },
      {
        "sourceName": "DSC06283",
        "id": "portrait-2871",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782610139772-2-c45e887e-f020-4a2e-8bed-4df5faa84c44-DSC06283/w1280.webp",
        "previewSrc": "/photo-session/optimized/dsc06283-640.webp",
        "previewSrcSet": "/photo-session/optimized/dsc06283-640.webp 640w, /photo-session/optimized/dsc06283-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "山间长椅上休息的人像",
          "en": "A relaxed portrait on a bench in the mountains"
        }
      }
    ]
  },
  {
    "id": "david-appenzell",
    "title": "David",
    "place": "Appenzell",
    "photos": [
      {
        "sourceName": "DSC07032",
        "id": "portrait-2880",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782610139773-11-1938dbe7-5135-4209-be01-312c6e8e4004-DSC07032/w1280.webp",
        "previewSrc": "/portrait-book/DSC07032-640.webp",
        "previewSrcSet": "/portrait-book/DSC07032-640.webp 640w, /portrait-book/DSC07032-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "山间小路上的旅行人像",
          "en": "A travel portrait on an alpine trail"
        }
      },
      {
        "sourceName": "DSC06852",
        "id": "portrait-2877",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782610139772-8-3aa91218-1999-4341-a454-245607028748-DSC06852/w1280.webp",
        "previewSrc": "/portrait-book/DSC06852-640.webp",
        "previewSrcSet": "/portrait-book/DSC06852-640.webp 640w, /portrait-book/DSC06852-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "山间休息时回望的人像",
          "en": "A relaxed portrait looking back in the mountains"
        }
      },
      {
        "sourceName": "DSC06878",
        "id": "portrait-2878",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782610139772-9-03f1cb8c-1852-4c88-a4ce-2fe85254c233-DSC06878/w1280.webp",
        "previewSrc": "/photo-session/optimized/dsc06878-640.webp",
        "previewSrcSet": "/photo-session/optimized/dsc06878-640.webp 640w, /photo-session/optimized/dsc06878-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "徒步途中与群山同框的人像",
          "en": "A hiking portrait among alpine peaks"
        }
      }
    ]
  },
  {
    "id": "hongjia-oeschinen",
    "title": "Hongjia",
    "place": "Oeschinen",
    "photos": [
      {
        "sourceName": "DSC07178",
        "id": "portrait-2787",
        "src": "https://s3.cunyli.top/picture/responsive/manual-set-110-7fd6cbed61-image-05-DSC07178/w1280.webp",
        "previewSrc": "/portrait-book/DSC07178-640.webp",
        "previewSrcSet": "/portrait-book/DSC07178-640.webp 640w, /portrait-book/DSC07178-1280.webp 1280w",
        "width": 1280,
        "height": 854,
        "alt": {
          "zh": "面对群山的旅行背影",
          "en": "A travel portrait facing the mountain valley"
        }
      },
      {
        "sourceName": "DSC07120",
        "id": "portrait-2882",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782610139773-13-d75ebb3e-d007-4b6a-b8a5-a1c071e912f5-DSC07120/w1280.webp",
        "previewSrc": "/photo-session/optimized/dsc07120-640.webp",
        "previewSrcSet": "/photo-session/optimized/dsc07120-640.webp 640w, /photo-session/optimized/dsc07120-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "在山间草地上行走的人像",
          "en": "A portrait walking through an alpine meadow"
        }
      },
      {
        "sourceName": "DSC07128",
        "id": "portrait-2883",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782610139773-14-7a2634ee-f0f3-46eb-a4a0-55b087cfc764-DSC07128/w1280.webp",
        "previewSrc": "/photo-session/optimized/dsc07128-640.webp",
        "previewSrcSet": "/photo-session/optimized/dsc07128-640.webp 640w, /photo-session/optimized/dsc07128-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "山谷与草地间的旅行人像",
          "en": "A travel portrait between the meadow and mountain valley"
        }
      }
    ]
  },
  {
    "id": "quiet-travel-notes",
    "title": "Travel notes",
    "place": "Europe",
    "photos": [
      {
        "sourceName": "DSC07258",
        "id": "dsc07258-local",
        "src": "/photo-session/dsc07258-1280.jpg",
        "previewSrc": "/photo-session/dsc07258-1280.jpg",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "湖水边自然坐着的旅行人像",
          "en": "A quiet travel portrait beside turquoise mountain water"
        }
      },
      {
        "sourceName": "DSC09183",
        "id": "dsc09183-local",
        "src": "/photo-session/dsc09183-2-1280.jpg",
        "previewSrc": "/photo-session/dsc09183-2-1280.jpg",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "暖色车厢里靠窗阅读的人像",
          "en": "A quiet portrait reading beside a warm train window"
        }
      }
    ]
  },
  {
    "id": "jianji-xinyi",
    "title": "Jianji & Xinyi",
    "place": "Barcelona / Croatia",
    "photos": [
      {
        "sourceName": "DSC00373",
        "id": "portrait-2815",
        "src": "https://s3.cunyli.top/picture/responsive/image-1782576273276-2-e55e7b97-a5e7-4df1-9dee-90ca0504b8c5-DSC00373/w1280.webp",
        "previewSrc": "/portrait-book/DSC00373-640.webp",
        "previewSrcSet": "/portrait-book/DSC00373-640.webp 640w, /portrait-book/DSC00373-1280.webp 847w",
        "width": 847,
        "height": 563,
        "alt": {
          "zh": "沿海边石阶走下的两个人",
          "en": "Two people walking down stone steps toward the sea"
        }
      },
      {
        "sourceName": "DSC00471",
        "id": "portrait-2493",
        "src": "https://s3.cunyli.top/picture/responsive/backfill-image-2493-262535fa9a-compressed-1747312859898-4-DSC00471/w1280.webp",
        "previewSrc": "/portrait-book/DSC00471-640.webp",
        "previewSrcSet": "/portrait-book/DSC00471-640.webp 640w, /portrait-book/DSC00471-1280.webp 1280w",
        "width": 1280,
        "height": 1920,
        "alt": {
          "zh": "海湾上方的双人旅行人像",
          "en": "A couple sharing a travel moment above a bay"
        }
      },
      {
        "sourceName": "DSC09211",
        "id": "portrait-2304",
        "src": "https://s3.cunyli.top/picture/responsive/backfill-image-2304-ad0ece540f-compressed-1746749229791-7-DSC09211/w1280.webp",
        "previewSrc": "/photo-session/optimized/dsc09211-640.webp",
        "previewSrcSet": "/photo-session/optimized/dsc09211-640.webp 640w, /photo-session/optimized/dsc09211-1280.webp 1280w",
        "width": 1280,
        "height": 853,
        "alt": {
          "zh": "海边小路与野花间的两个人",
          "en": "Two people on a seaside path among wildflowers"
        }
      }
    ]
  }
] as const satisfies readonly SelectedSessionSeries[]
