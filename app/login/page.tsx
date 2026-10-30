"use client"

import { useDocumentTitle } from "@/lib/use-document-title"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { I18nProvider, useI18n } from "@/lib/i18n"
import { supabase } from "@/utils/supabase"
import { safeReturnPath } from "@/utils/safe-return-path"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Stage = "password" | "setup" | "verify"

function LoginInner() {
  const { t, locale, setLocale } = useI18n()
  const zh = locale === "zh"
  useDocumentTitle(`${zh ? "登录" : "Sign in"} · Lijie Li`)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [factorId, setFactorId] = useState("")
  const [qr, setQr] = useState("")
  const [secret, setSecret] = useState("")
  const [stage, setStage] = useState<Stage>("password")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const destination = () => safeReturnPath(new URLSearchParams(window.location.search).get("next"))

  const status = async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw new Error("session")
    const response = await fetch("/api/admin/mfa-status", {
      headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store",
    })
    if (!response.ok) throw new Error("access")
    return response.json() as Promise<{ assuranceLevel: "aal1" | "aal2" }>
  }

  const continueSession = async () => {
    const access = await status()
    if (access.assuranceLevel === "aal2") {
      router.replace(destination()); router.refresh(); return
    }
    const factors = await supabase.auth.mfa.listFactors()
    if (factors.error) throw factors.error
    const verified = factors.data.totp[0]
    if (verified) { setFactorId(verified.id); setStage("verify") }
    else setStage("setup")
  }

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session || cancelled) return
      setBusy(true)
      try { await continueSession() }
      catch { if (!cancelled) setError(zh ? "请重新登录管理员账号。" : "Please sign in with an administrator account.") }
      finally { if (!cancelled) setBusy(false) }
    })
    return () => { cancelled = true }
  }, [])

  const login = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("")
    try {
      const result = await supabase.auth.signInWithPassword({ email, password })
      if (result.error) throw result.error
      setPassword("")
      await continueSession()
    } catch {
      setError(zh ? "无法登录，请检查账号、密码和访问权限。" : "Unable to sign in. Check your credentials and access.")
    } finally { setBusy(false) }
  }

  const enroll = async () => {
    setBusy(true); setError("")
    try {
      await status()
      const factors = await supabase.auth.mfa.listFactors()
      if (factors.error) throw factors.error
      // Only retire abandoned, unverified setup attempts from this screen.
      for (const factor of factors.data.all) {
        if (factor.factor_type === "totp" && factor.status === "unverified" && factor.friendly_name === "Portfolio admin") {
          const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id })
          if (removed.error) throw removed.error
        }
      }
      const result = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Portfolio admin", issuer: "Lijie Portfolio" })
      if (result.error) throw result.error
      const image = result.data.totp.qr_code
      const prefix = "data:image/svg+xml;utf-8,"
      setFactorId(result.data.id)
      setQr(image.startsWith(prefix) ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(image.slice(prefix.length))}` : image)
      setSecret(result.data.totp.secret); setStage("verify")
    } catch { setError(zh ? "暂时无法设置验证器，请重试。" : "Could not set up your authenticator. Please try again.") }
    finally { setBusy(false) }
  }

  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("")
    try {
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
      if (result.error) throw result.error
      const access = await status()
      if (access.assuranceLevel !== "aal2") throw new Error("verification")
      setQr(""); setSecret(""); setCode("")
      router.replace(destination()); router.refresh()
    } catch { setCode(""); setError(zh ? "验证码无效或已过期，请输入新的六位验证码。" : "That code is invalid or expired. Enter a fresh six-digit code.") }
    finally { setBusy(false) }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setStage("password"); setFactorId(""); setQr(""); setSecret(""); setCode(""); setError("")
  }

  return <main className="flex min-h-screen items-center justify-center bg-gray-100 px-5 py-16">
    <div className="absolute right-4 top-4"><select aria-label={zh ? "语言" : "Language"} value={locale} onChange={event => setLocale(event.target.value as "zh" | "en")} className="rounded border px-2 py-1"><option value="en">English</option><option value="zh">中文</option></select></div>
    <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-md sm:p-8">
      <h1 className="mb-3 text-center text-2xl font-semibold">{stage === "password" ? t("loginTitle") : stage === "setup" ? (zh ? "保护你的后台" : "Secure your admin") : (zh ? "二次验证" : "Two-factor verification")}</h1>
      {stage !== "password" && <p className="mb-6 text-sm leading-6 text-gray-600">{stage === "setup" ? (zh ? "用验证器扫码绑定，之后登录时输入验证码。" : "Set up an authenticator, then use its code when you sign in.") : qr ? (zh ? "用验证器扫描下方二维码，再输入六位验证码。" : "Scan this QR code with your authenticator, then enter the six-digit code.") : (zh ? "请输入验证器中的六位验证码。" : "Enter the six-digit code from your authenticator.")}</p>}
      {error && <p role="alert" className="mb-4 text-sm leading-6 text-red-700">{error}</p>}
      {stage === "password" && <form onSubmit={login} className="space-y-4">
        <div><Label htmlFor="email">{t("email")}</Label><Input id="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required disabled={busy}/></div>
        <div><Label htmlFor="password">{t("password")}</Label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy}/></div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? (zh ? "验证中…" : "Checking…") : t("login")}</Button>
      </form>}
      {stage === "setup" && <Button type="button" className="w-full" onClick={() => void enroll()} disabled={busy}>{zh ? "设置验证器" : "Set up authenticator"}</Button>}
      {stage === "verify" && <form onSubmit={verify} className="space-y-4">
        {qr && <><img src={qr} alt={zh ? "验证器绑定二维码" : "Authenticator setup QR code"} className="mx-auto h-48 w-48"/><details className="text-sm"><summary className="cursor-pointer">{zh ? "无法扫码？手动输入密钥" : "Can’t scan? Enter the setup key manually"}</summary><code className="mt-3 block break-all rounded bg-gray-100 p-3">{secret}</code></details></>}
        <div><Label htmlFor="verification-code">{zh ? "六位验证码" : "Six-digit code"}</Label><Input id="verification-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} required disabled={busy}/></div>
        <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>{busy ? (zh ? "验证中…" : "Verifying…") : (zh ? "验证并进入后台" : "Verify and continue")}</Button>
      </form>}
      {stage !== "password" && <button type="button" className="mt-5 min-h-11 w-full text-sm text-gray-600 underline underline-offset-4" disabled={busy} onClick={() => void signOut()}>{zh ? "退出并使用其他账号" : "Sign out and use another account"}</button>}
    </div>
  </main>
}

export default function LoginPage() { return <I18nProvider><LoginInner/></I18nProvider> }
