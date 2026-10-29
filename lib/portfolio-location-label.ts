type LocationName = {
  name?: string | null
  name_en?: string | null
  name_zh?: string | null
}

// Older location records can have an empty or Chinese-valued English field.
const englishFallbacks: Record<string, string> = {
  "洛桑": "Lausanne",
  "瑞士": "Switzerland",
}

export function portfolioLocationLabel(location: LocationName, locale: string, unknown: string) {
  const original = location.name?.trim() || ""
  if (locale === "zh") return location.name_zh?.trim() || original || unknown
  const english = location.name_en?.trim() || ""
  return englishFallbacks[english] || english || englishFallbacks[original] || original || unknown
}

const placeLabels:Record<string,{zh:string;en:string}>={
  helsinki:{zh:"赫尔辛基",en:"Helsinki"},stockholm:{zh:"斯德哥尔摩",en:"Stockholm"},switzerland:{zh:"瑞士",en:"Switzerland"},
  croatia:{zh:"克罗地亚",en:"Croatia"},barcelona:{zh:"巴塞罗那",en:"Barcelona"},lijiang:{zh:"丽江",en:"Lijiang"},
  spiez:{zh:"施皮茨",en:"Spiez"},zermatt:{zh:"采尔马特",en:"Zermatt"},florence:{zh:"佛罗伦萨",en:"Florence"},
  aalto:{zh:"阿尔托大学",en:"Aalto"},portraits:{zh:"人像作品",en:"Portraits"},
}
export function localizePlaceText(value:string,locale:"zh"|"en"){
  return value.split(/(\s*[·/]\s*)/).map(part=>placeLabels[part.trim().toLowerCase()]?.[locale] || part).join("")
}
