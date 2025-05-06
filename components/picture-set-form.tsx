// components/picture-set-form.tsx
"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, ArrowUp } from "lucide-react"
import imageCompression from "browser-image-compression"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import type { PictureSet } from "@/lib/pictureSet.types"
import type { PictureFormData, PictureSetSubmitData } from "@/lib/form-types"

interface PictureSetFormProps {
  onSubmit: (pictureSet: PictureSetSubmitData, pictureSetId?: number) => void
  editingPictureSet?: PictureSet | null
  onCancel?: () => void
}

// 压缩图片的函数（不变）
async function compressImage(file: File, quality = 0.9): Promise<File> {
  const options = {
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: quality,
    fileType: "image/webp",
  }
  const compressedFile = await imageCompression(file, options)
  return new File([compressedFile], file.name.replace(/\.[^/.]+$/, ".webp"), { type: "image/webp" })
}

// 生成预览 URL
async function getImagePreview(file: File): Promise<{ url: string; size: number }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) =>
      resolve({
        url: e.target?.result as string,
        size: file.size,
      })
    reader.readAsDataURL(file)
  })
}

export function PictureSetForm({ onSubmit, editingPictureSet, onCancel }: PictureSetFormProps) {
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [description, setDescription] = useState("")
  const [cover, setCover] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverOriginalSize, setCoverOriginalSize] = useState<number>(0)
  const [coverImageUrl, setCoverImageUrl] = useState<string>("")
  const [pictures, setPictures] = useState<PictureFormData[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [position, setPosition] = useState<string>("up")
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingId, setEditingId] = useState<number | undefined>(undefined)
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const picturesContainerRef = useRef<HTMLDivElement>(null)

  // 如果在编辑模式，初始化表单数据
  useEffect(() => {
    if (editingPictureSet) {
      console.log("Initializing form with editing picture set:", editingPictureSet.id)
      setIsEditMode(true)
      setEditingId(editingPictureSet.id)
      setTitle(editingPictureSet.title || "")
      setSubtitle(editingPictureSet.subtitle || "")
      setDescription(editingPictureSet.description || "")
      setCoverImageUrl(editingPictureSet.cover_image_url || "")
      setCoverPreview(editingPictureSet.cover_image_url || null)
      setPosition(editingPictureSet.position || "up")

      // Log the pictures we're loading
      console.log(`Loading ${editingPictureSet.pictures?.length || 0} pictures for editing`)

      const formatted = (editingPictureSet.pictures || []).map((pic) => ({
        id: pic.id,
        title: pic.title || "",
        subtitle: pic.subtitle || "",
        description: pic.description || "",
        cover: null,
        image_url: pic.image_url || "",
        raw_image_url: pic.raw_image_url || "",
        previewUrl: pic.image_url || undefined,
      }))
      setPictures(formatted)
    } else {
      setIsEditMode(false)
      setEditingId(undefined)
      resetForm()
    }
  }, [editingPictureSet])

  // Monitor scroll position to show/hide scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      if (formRef.current) {
        const scrollTop = formRef.current.scrollTop || document.documentElement.scrollTop
        setShowScrollToTop(scrollTop > 300)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // 获取 R2 签名后上传
  const uploadFile = async (file: File, objectName: string): Promise<string> => {
    const res = await fetch("/api/upload-to-r2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectName, contentType: file.type }),
    })
    if (!res.ok) throw new Error("Failed to get signed URL")
    const { uploadUrl } = await res.json()
    const buf = await file.arrayBuffer()
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: buf,
    })
    if (!uploadRes.ok) throw new Error("File upload failed")
    return `/${objectName}`
  }

  // 提交表单：上传封面 + 各张图片 (原图 + 压缩图)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      let cover_image_url = coverImageUrl
      if (cover) {
        const compressed = await compressImage(cover, 0.9)
        cover_image_url = await uploadFile(compressed, `picture/cover-${Date.now()}-${compressed.name}`)
      }

      const processed = await Promise.all(
        pictures.map(async (pic, idx) => {
          let image_url = pic.image_url || ""
          let raw_image_url = pic.raw_image_url || ""
          if (pic.cover instanceof File) {
            raw_image_url = await uploadFile(pic.cover, `picture/original-${Date.now()}-${idx}-${pic.cover.name}`)
            const comp = await compressImage(pic.cover, 0.9)
            image_url = await uploadFile(comp, `picture/compressed-${Date.now()}-${idx}-${comp.name}`)
          }
          return {
            id: pic.id,
            title: pic.title,
            subtitle: pic.subtitle,
            description: pic.description,
            image_url,
            raw_image_url,
          }
        }),
      )

      const payload: PictureSetSubmitData = {
        title,
        subtitle,
        description,
        cover_image_url,
        position,
        pictures: processed,
      }

      console.log(`Submitting form with ${processed.length} pictures`)

      onSubmit(payload, editingId)
      if (!isEditMode) resetForm()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 文件选中后生成预览并压缩
  const handlePictureChange = async (i: number, field: keyof PictureFormData, val: string | File | null) => {
    const arr = [...pictures]
    if (field === "cover" && val instanceof File) {
      const { url, size } = await getImagePreview(val)
      const comp = await compressImage(val, 0.9)
      const previewComp = await getImagePreview(comp)
      arr[i] = {
        ...arr[i],
        cover: val,
        previewUrl: url,
        originalSize: size,
        compressedSize: previewComp.size,
        compressedFile: comp,
      }
    } else {
      arr[i] = { ...arr[i], [field]: val }
    }
    setPictures(arr)
  }

  const handleAddPicture = () => {
    console.log("Adding new picture to form")
    setPictures((p) => [
      ...p,
      {
        title: "",
        subtitle: "",
        description: "",
        cover: null,
        previewUrl: undefined,
        originalSize: 0,
        compressedSize: 0,
        compressedFile: null,
      },
    ])

    // Scroll to the newly added picture after a short delay
    setTimeout(() => {
      if (picturesContainerRef.current) {
        const pictureElements = picturesContainerRef.current.querySelectorAll(".picture-item")
        if (pictureElements.length > 0) {
          const lastPicture = pictureElements[pictureElements.length - 1]
          lastPicture.scrollIntoView({ behavior: "smooth", block: "center" })
        }
      }
    }, 100)
  }

  const handleRemovePicture = (i: number) => {
    console.log(`Removing picture at index ${i}`)
    const arr = [...pictures]
    arr.splice(i, 1)
    setPictures(arr)
  }

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setCover(f)
    if (f) {
      const { url, size } = await getImagePreview(f)
      setCoverPreview(url)
      setCoverOriginalSize(size)
      setCoverImageUrl("")
    } else {
      setCoverPreview(null)
      setCoverOriginalSize(0)
    }
  }

  const resetForm = () => {
    setTitle("")
    setSubtitle("")
    setDescription("")
    setCover(null)
    setCoverPreview(null)
    setCoverOriginalSize(0)
    setCoverImageUrl("")
    setPictures([])
    setPosition("up")
  }

  const scrollToTop = () => {
    if (formRef.current) {
      formRef.current.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const formatSize = (b: number) =>
    b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(2) + " KB" : (b / 1048576).toFixed(2) + " MB"

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">{isEditMode ? "Edit Picture Set" : "Create New Picture Set"}</h2>
        {isEditMode && onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel Edit
          </Button>
        )}
      </div>
      {/* 标题/副标题/描述/位置 */}
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="subtitle">Subtitle</Label>
        <Input id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="position">Position</Label>
        <Select value={position} onValueChange={setPosition}>
          <SelectTrigger id="position">
            <SelectValue placeholder="Select position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="up">Top Row</SelectItem>
            <SelectItem value="down">Bottom Row</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 封面预览（宽度减半） */}
      <div className="space-y-2">
        <Label htmlFor="cover">Cover Image</Label>
        {coverPreview && (
          <div className="mt-2 mb-4 p-4 border rounded">
            <div className="relative aspect-video w-1/2 overflow-hidden rounded-md bg-gray-100">
              <img
                src={coverPreview || "/placeholder.svg"}
                alt="Cover preview"
                className="object-contain w-full h-full"
              />
            </div>
            {coverOriginalSize > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Original size: {formatSize(coverOriginalSize)} • Will be compressed to WebP at 90% quality
              </p>
            )}
          </div>
        )}
        <Input id="cover" type="file" accept="image/*" onChange={handleCoverChange} />
      </div>

      {/* 多张图片列表 */}
      <div className="space-y-4" ref={picturesContainerRef}>
        <div className="sticky top-4 z-10 bg-white py-2 border-b flex justify-between items-center">
          <Label>Pictures ({pictures.length})</Label>
          <Button type="button" onClick={handleAddPicture} className="flex items-center gap-1">
            <Plus className="h-4 w-4" /> Add Picture
          </Button>
        </div>

        {pictures.map((pic, idx) => (
          <div key={idx} className="space-y-2 p-4 border rounded picture-item">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">
                Picture {idx + 1} {pic.id ? `(ID: ${pic.id})` : "(New)"}
              </h3>
              <Button type="button" variant="destructive" size="sm" onClick={() => handleRemovePicture(idx)}>
                Remove
              </Button>
            </div>

            <Input
              placeholder="Title"
              value={pic.title}
              onChange={(e) => handlePictureChange(idx, "title", e.target.value)}
            />
            <Input
              placeholder="Subtitle"
              value={pic.subtitle}
              onChange={(e) => handlePictureChange(idx, "subtitle", e.target.value)}
            />
            <Textarea
              placeholder="Description"
              value={pic.description}
              onChange={(e) => handlePictureChange(idx, "description", e.target.value)}
            />

            {/* 图片预览（宽度减半） */}
            {pic.previewUrl && (
              <div className="mt-2 mb-4">
                <div className="relative aspect-video w-1/2 overflow-hidden rounded-md bg-gray-100">
                  <img
                    src={pic.previewUrl || "/placeholder.svg"}
                    alt={`Picture ${idx + 1}`}
                    className="object-contain w-full h-full"
                  />
                </div>
                {pic.originalSize! > 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Original size: {formatSize(pic.originalSize!)}
                    {pic.compressedSize && (
                      <>
                        {" "}
                        • Compressed size: {formatSize(pic.compressedSize)} (
                        {((pic.compressedSize / pic.originalSize!) * 100).toFixed(1)}%)
                      </>
                    )}
                  </p>
                )}
              </div>
            )}

            <Input
              type="file"
              accept="image/*"
              onChange={(e) => handlePictureChange(idx, "cover", e.target.files?.[0] || null)}
            />
          </div>
        ))}

        {/* Action buttons at the bottom */}
        {/* Floating Add Picture button at the bottom */}
      </div>

      {/* Action buttons at the bottom */}
      <div className="sticky bottom-0 bg-white py-4 border-t z-10 space-y-2">
        {/* Add Picture button above the submit button */}
        <Button
          type="button"
          onClick={handleAddPicture}
          className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Picture
        </Button>

        {/* Submit button */}
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Submitting..." : isEditMode ? "Update Picture Set" : "Submit Picture Set"}
        </Button>
      </div>

      {/* Scroll to top button */}
      {showScrollToTop && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="fixed bottom-8 left-8 z-20 rounded-full shadow-lg"
          onClick={scrollToTop}
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </form>
  )
}
