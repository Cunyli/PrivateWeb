const prettyPlaces: Record<string, string> = { aalto: "Aalto", helsinki: "Helsinki", stockholm: "Stockholm", switzerland: "Switzerland", zermatt: "Zermatt", oeschinen: "Oeschinen", appenzell: "Appenzell", spiz: "Spiez", lijiang: "Lijiang", italy: "Italy" }
const label = (value: string) => value.replace(/^location:|^model:|^series:/, "").replace(/-/g, " ")
export function photoSeries(setId: number, title: string, subtitle: string, tags: string[]) {
  const models = tags.filter(tag => tag.startsWith("model:")).map(label).sort()
  const places = tags.filter(tag => tag.startsWith("location:")).map(tag => tag.slice(9))
  const place = places.find(value => !["europe", "switzerland", "finland", "italy", "other-city"].includes(value)) || places[0] || ""
  const series = tags.find(tag => tag.startsWith("series:"))
  return {
    id: models.length ? `portrait:${encodeURIComponent(`${series || "shoot"}:${models.join("+")}:${series ? "" : place}`)}` : `set:${setId}`,
    title: models.length ? models.join(" & ") : title || "未命名系列",
    subtitle: models.length ? prettyPlaces[place] || label(place) : subtitle || "",
    portrait: models.length > 0,
  }
}

export function preferSeriesPlace(current: string, candidate: string) {
  const broad=new Set(["","europe","switzerland","finland","italy","other city"])
  return broad.has(current.toLowerCase()) && !broad.has(candidate.toLowerCase()) ? candidate : current || candidate
}

export const portraitPoolId = "portrait-pool"
export function isPortraitPool(title?: string | null, tags: string[] = []) {
  return /^portrait booking samples$/i.test(String(title || "").trim()) || tags.includes("portrait-library")
}
export function curationGroup(setId: number, title: string, subtitle: string, tags: string[]) {
  return isPortraitPool(title,tags)
    ? {id:portraitPoolId,title:"人像素材库",subtitle:"",portrait:true}
    : photoSeries(setId,title,subtitle,tags)
}
