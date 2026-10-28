"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PortraitLibraryAdmin } from "@/components/portrait-library-admin"
import { useI18n } from "@/lib/i18n"
import { adminFetch } from "@/utils/admin-auth-client"

export default function PortraitLibraryAdminPage() {
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const router = useRouter()
  const { t } = useI18n()

  useEffect(() => {
    const checkUser = async () => {
      try {
        const response = await adminFetch("/api/admin/session", { cache: "no-store" })
        if (response.status === 401) {
          router.push("/login?next=/admin/portraits")
        } else if (!response.ok) {
          setAuthError("This account is not allowed to access admin.")
          setLoading(false)
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.warn("checkUser failed:", error)
        if (error instanceof Error && error.message === "Missing admin session") {
          router.push("/login?next=/admin/portraits")
          return
        }
        setAuthError("Unable to verify admin access.")
        setLoading(false)
      }
    }

    checkUser()
  }, [router])

  if (loading) return <div>{t("loadingSets")}</div>
  if (authError) return <div className="p-6 text-sm text-red-600">{authError}</div>

  return <PortraitLibraryAdmin />
}
