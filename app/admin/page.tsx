"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { adminFetch } from "@/utils/admin-auth-client"
import { AdminDashboard } from "@/components/admin-dashboard"
import { useI18n } from "@/lib/i18n"

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      try {
        const response = await adminFetch("/api/admin/session", { cache: "no-store" })
        if (response.status === 401) {
          router.push("/login?next=/admin")
        } else if (!response.ok) {
          setAuthError("This account is not allowed to access admin.")
          setLoading(false)
        } else {
          setLoading(false)
        }
      } catch (e) {
        console.warn('checkUser failed:', e)
        if (e instanceof Error && e.message === "Missing admin session") {
          router.push("/login?next=/admin")
          return
        }
        setAuthError("Unable to verify admin access.")
        setLoading(false)
      }
    }
    checkUser()
  }, [router])

  const { t } = useI18n()
  if (loading) return <div>{t('loadingSets')}</div>
  if (authError) return <div className="p-6 text-sm text-red-600">{authError}</div>

  return <AdminDashboard />
}
