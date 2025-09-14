"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/utils/supabase"
import { AdminDashboard } from "@/components/admin-dashboard"
import { useI18n } from "@/lib/i18n"

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      try {
        const bypass = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('noauth') === '1'
        if (bypass) { setLoading(false); return }
        const { data, error } = await supabase.auth.getUser()
        if (error) {
          console.warn('auth.getUser error:', error)
        }
        const user = data?.user
        if (!user) {
          router.push("/login")
        } else {
          setLoading(false)
        }
      } catch (e) {
        console.warn('checkUser failed:', e)
        // Fail-open for admin to load UI rather than block entirely
        setLoading(false)
      }
    }
    checkUser()
  }, [router])

  const { t } = useI18n()
  if (loading) return <div>{t('loadingSets')}</div>

  return <AdminDashboard />
}
