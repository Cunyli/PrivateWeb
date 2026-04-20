"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PictureSetForm } from "./picture-set-form"
import { PictureSetList } from "./picture-set-list"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import type { PictureSet } from "@/lib/pictureSet.types"
import type { PictureSetSubmitData } from "@/lib/form-types"
import { useI18n } from "@/lib/i18n"
import { adminFetch } from "@/utils/admin-auth-client"

export function AdminDashboard() {
  const { t } = useI18n()
  const [pictureSets, setPictureSets] = useState<PictureSet[]>([])
  const [editingPictureSet, setEditingPictureSet] = useState<PictureSet | null>(null)
  const [activeTab, setActiveTab] = useState("list")
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const fetchPictureSets = async (q?: string) => {
    try {
      setIsLoading(true)
      const query = (typeof q === "string" ? q : searchQuery).trim()
      const url = query ? `/api/admin/picture-sets?q=${encodeURIComponent(query)}` : "/api/admin/picture-sets"
      const res = await adminFetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t("loadSetsFail"))
      setPictureSets(Array.isArray(data?.items) ? data.items : [])
    } catch (error) {
      console.error("Error in fetchPictureSets(server):", error)
      toast({ title: t("error"), description: t("loadSetsFail"), variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPictureSets()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPictureSets(searchQuery)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleSubmitPictureSetServer = async (newPictureSet: PictureSetSubmitData, pictureSetId?: number) => {
    try {
      if (pictureSetId) {
        const res = await adminFetch(`/api/admin/picture-sets/${pictureSetId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newPictureSet),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          console.error("API update picture-set failed:", data)
          toast({ title: t("error"), description: data?.error || t("updateSetFail"), variant: "destructive" })
          return
        }
        if (Array.isArray(data?.storageDeleteErrors) && data.storageDeleteErrors.length > 0) {
          console.warn("Picture set updated, but some old image assets were not deleted:", data.storageDeleteErrors)
          toast({
            title: t("success"),
            description: `${t("updateSetSuccess")} Storage cleanup skipped ${data.storageDeleteErrors.length} file(s).`,
          })
        } else {
          toast({ title: t("success"), description: t("updateSetSuccess") })
        }
        setEditingPictureSet(null)
        setActiveTab("list")
        setTimeout(async () => {
          await fetchPictureSets()
        }, 0)
        return
      }

      const res = await adminFetch("/api/admin/picture-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPictureSet),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error("API create picture-set failed:", data)
        toast({ title: t("error"), description: data?.error || t("createSetFail"), variant: "destructive" })
        return
      }

      toast({ title: t("success"), description: t("createSetSuccess") })
      setEditingPictureSet(null)
      setActiveTab("list")
      await fetchPictureSets()
    } catch (error) {
      console.error("Error in handleSubmitPictureSetServer:", error)
      toast({ title: t("error"), description: t("unexpectedError"), variant: "destructive" })
    }
  }

  const handleDeletePictureSet = async (id: number) => {
    try {
      const res = await adminFetch(`/api/admin/picture-sets/${id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error("Delete set failed:", data)
        toast({ title: t("error"), description: data?.error || t("deleteSetFail"), variant: "destructive" })
        return
      }
      if (Array.isArray(data?.storageDeleteErrors) && data.storageDeleteErrors.length > 0) {
        console.warn("Picture set deleted, but some image assets were not deleted:", data.storageDeleteErrors)
        toast({
          title: t("success"),
          description: `${t("deleteSetSuccess")} Storage cleanup skipped ${data.storageDeleteErrors.length} file(s).`,
        })
      } else {
        toast({ title: t("success"), description: t("deleteSetSuccess") })
      }
      await fetchPictureSets()
    } catch (error) {
      console.error("Error in handleDeletePictureSet(server):", error)
      toast({ title: t("error"), description: t("unexpectedDeleteError"), variant: "destructive" })
    }
  }

  const handleEditPictureSet = async (pictureSet: PictureSet) => {
    try {
      const res = await adminFetch(`/api/admin/picture-sets/${pictureSet.id}`)
      const data = await res.json()
      if (!res.ok) {
        console.error("Load set detail failed:", data)
        toast({ title: t("error"), description: data?.error || t("loadSetDataFail"), variant: "destructive" })
        return
      }
      setEditingPictureSet(data.item as PictureSet)
      setActiveTab("form")
    } catch (error) {
      console.error("Error in handleEditPictureSet:", error)
      toast({ title: t("error"), description: t("unexpectedError"), variant: "destructive" })
    }
  }

  const handleCancelEdit = () => {
    setEditingPictureSet(null)
    setActiveTab("list")
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">{t("adminDashboard")}</h1>
        <Button asChild variant="outline">
          <Link href="/portfolio">Home</Link>
        </Button>
      </div>

      <div className="mb-6 flex gap-2 items-center">
        <Input
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <Button size="sm" variant="outline" onClick={() => setSearchQuery("")}>
            {t("clear")}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="list">{t("pictureSetsTab")}</TabsTrigger>
          <TabsTrigger value="form">{editingPictureSet ? t("editSetTab") : t("addNewSetTab")}</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <p>{t("loadingSets")}</p>
            </div>
          ) : (
            <PictureSetList pictureSets={pictureSets} onEdit={handleEditPictureSet} onDelete={handleDeletePictureSet} />
          )}
        </TabsContent>
        <TabsContent value="form">
          <PictureSetForm
            onSubmit={handleSubmitPictureSetServer}
            editingPictureSet={editingPictureSet}
            onCancel={handleCancelEdit}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
