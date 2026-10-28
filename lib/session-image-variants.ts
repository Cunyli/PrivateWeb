// Responsive display copies. Original photographs remain available to the photo viewer.
export const sessionImageVariants: Record<string, {src: string; srcSet: string}> = {
  "/photo-session/cover-florence.jpg": {
    "src": "/photo-session/optimized/cover-florence-1280.webp",
    "srcSet": "/photo-session/optimized/cover-florence-640.webp 640w, /photo-session/optimized/cover-florence-1280.webp 1280w, /photo-session/optimized/cover-florence-1920.webp 1920w, /photo-session/optimized/cover-florence-2560.webp 2560w"
  },
  "/private/master1.jpg": {
    "src": "/photo-session/optimized/master1-1280.webp",
    "srcSet": "/photo-session/optimized/master1-640.webp 640w, /photo-session/optimized/master1-1280.webp 1280w"
  },
  "/private/master2.jpg": {
    "src": "/photo-session/optimized/master2-1280.webp",
    "srcSet": "/photo-session/optimized/master2-640.webp 640w, /photo-session/optimized/master2-1280.webp 1280w"
  },
  "/private/master3.jpg": {
    "src": "/photo-session/optimized/master3-1280.webp",
    "srcSet": "/photo-session/optimized/master3-640.webp 640w, /photo-session/optimized/master3-1280.webp 1280w"
  },
  "/private/master4.jpg": {
    "src": "/photo-session/optimized/master4-1280.webp",
    "srcSet": "/photo-session/optimized/master4-640.webp 640w, /photo-session/optimized/master4-1280.webp 1280w"
  },
  "/private/independent.jpg": {
    "src": "/photo-session/optimized/independent-1280.webp",
    "srcSet": "/photo-session/optimized/independent-640.webp 640w, /photo-session/optimized/independent-1280.webp 1280w"
  }
}

// The private originals are intentionally excluded from Git/deployment. The
// already-selected public display copy must also back their lightbox view.
export function sessionViewerSource(src: string): string {
  return src.startsWith("/private/") ? sessionImageVariants[src]?.src || src : src
}
