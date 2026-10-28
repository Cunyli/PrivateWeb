import portfolioImageLoader from "./portfolio-image-loader"

export function photoSource(url: string, bucket: string, width = 640, original = false) {
  const source = !url || url === "/placeholder.svg" ? "/placeholder.svg" : /^https?:/.test(url) ? url : `${bucket}${url}`
  const separator = source.includes("?") ? "&" : "?"
  return portfolioImageLoader({ src: original ? `${source}${separator}variant=original` : source, width })
}
