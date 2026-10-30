const origin = (value: string | undefined) => {
  if (!value) return ""
  const url = new URL(value)
  return ["https:", "http:"].includes(url.protocol) ? url.origin : ""
}

export function contentSecurityPolicy(nonce?: string) {
  const supabase = origin(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const bucket = origin(process.env.NEXT_PUBLIC_BUCKET_URL)
  const storage = origin(process.env.R2_ENDPOINT_URL)
  const connect = ["'self'", supabase, supabase.replace(/^https:/, "wss:"), bucket, storage].filter(Boolean).join(" ")
  // Public pages stay statically cached; private pages receive per-request nonces.
  const scripts = nonce ? `'self' 'nonce-${nonce}' 'strict-dynamic'` : "'self' 'unsafe-inline'"
  return [
    "default-src 'self'", `script-src ${scripts}${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:",
    "font-src 'self' data:", "media-src 'self' blob: https:", `connect-src ${connect}${process.env.NODE_ENV === "development" ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    "worker-src 'self' blob:", "frame-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    ...(process.env.VERCEL === "1" ? ["upgrade-insecure-requests"] : []),
  ].join("; ")
}
