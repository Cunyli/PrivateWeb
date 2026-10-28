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
