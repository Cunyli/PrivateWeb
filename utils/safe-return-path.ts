export function safeReturnPath(value: string | null | undefined, fallback = "/admin"): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback
  try {
    const decoded = decodeURIComponent(value)
    if (decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded)) return fallback
    const base = "https://portfolio.local"
    const parsed = new URL(value, base)
    return parsed.origin === base ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback
  } catch {
    return fallback
  }
}
