"use client"

import { supabase } from "@/utils/supabase"
import { safeReturnPath } from "@/utils/safe-return-path"

export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data, error } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (error || !token) throw new Error("Missing admin session")
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance.error || assurance.data?.currentLevel !== "aal2") {
    const next = safeReturnPath(window.location.pathname + window.location.search)
    window.location.assign(`/login?next=${encodeURIComponent(next)}`)
    throw new Error("Two-factor authentication required")
  }
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}
