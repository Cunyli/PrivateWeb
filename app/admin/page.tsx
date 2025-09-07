"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/utils/supabase"
import { AdminDashboard } from "@/components/admin-dashboard"

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
      } else {
        setLoading(false)
      }
    }
    checkUser()
  }, [router])

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <AdminDashboard />
  )
}
