"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import imageCompression from "browser-image-compression"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import type { PictureSet } from "@/lib/pictureSet.types"
import type { PictureFormData, PictureSetSubmitData } from "@/lib/form-types"

interface PictureSetFormProps {
  onSubmit: (pictureSet: PictureSetSubmitData, pictureSetId?: number) => void
  editingPictureSet?: PictureSet | null
  onCancel?: () => void
}

// Enhanced compression function using browser-image-compression
async function compressImage(file: File, quality = 0.9): Promise<File> {
  try {
    const options = {
      maxWidthOrHeight: 1920, // Max width/height in pixels
      useWebWorker: true, // Use web workers for better performance
      initialQuality: quality, // Quality setting (0.9 = 90%)
      fileType: "image/webp", // Convert to WebP for better compression
    }

    // Compress the image
    const compressedFile = await imageCompression(file, options)

    // Rename to .webp extension
    return new File([compressedFile], file.name.replace(/\.[^/.]+$/, ".webp"), { type: "image/webp" })
  } catch (error) {
    console.error("Compression error:", error)
    throw error
  }
}

// Helper function to generate image preview and get file size
async function getImagePreview(file: File): Promise<{ url: string; size: number }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      resolve({
        url: e.target?.result as string,
        size: file.size,
      })
    }
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

  // Load data when editing an existing picture set
  useEffect(() => {
    if (editingPictureSet) {
      setIsEditMode(true)
      setEditingId(editingPictureSet.id)
      setTitle(editingPictureSet.title || "")
      setSubtitle(editingPictureSet.subtitle || "")
      setDescription(editingPictureSet.description || "")
      setCoverImageUrl(editingPictureSet.cover_image_url || "")
      setCoverPreview(editingPictureSet.cover_image_url || null)

      // Make sure to set the position correctly
      setPosition(editingPictureSet.position || "up")
      console.log("Setting position to:", editingPictureSet.position || "up")

      // Load existing pictures
      if (editingPictureSet.pictures && editingPictureSet.pictures.length > 0) {
        const formattedPictures = editingPictureSet.pictures.map((pic) => ({
          id: pic.id,
          title: pic.title || "",
          subtitle: pic.subtitle || "",
          description: pic.description || "",
          cover: null,
          image_url: pic.image_url || "",
          raw_image_url: pic.raw_image_url || "",
          previewUrl: pic.image_url || undefined,
        }))
        setPictures(formattedPictures)
      } else {
        setPictures([])
      }
    } else {
      setIsEditMode(false)
      setEditingId(undefined)
      resetForm()
    }
  }, [editingPictureSet])

  // Updated: upload file via signed URL
  const uploadFile = async (file: File, objectName: string): Promise<string> => {
    const res = await fetch("/api/upload-to-r2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectName,
        contentType: file.type,
      }),
    })
    if (!res.ok) throw new Error("Failed to get signed URL")
    const { uploadUrl } = await res.json()
    const fileBuffer = await file.arrayBuffer()
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: fileBuffer,
    })
    if (!uploadRes.ok) throw new Error("File upload failed")
    return `https://pub-aa03052e73cc405b9b70dc0fc8aeb455.r2.dev/${objectName}`
  }

  // Update the handleSubmit function to upload both original and compressed images
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      let cover_image_url = coverImageUrl
      if (cover) {
        // Compress cover image to WebP before upload
        const compressedCover = await compressImage(cover, 0.9)
        const objectName = `picture/cover-${Date.now()}-${compressedCover.name}`
        cover_image_url = await uploadFile(compressedCover, objectName)
      }

      // Process pictures: compress and upload each file if available
      const processedPictures = await Promise.all(
        pictures.map(async (picture, idx) => {
          let image_url = picture.image_url || ""
          let raw_image_url = picture.raw_image_url || ""

          if (picture.cover instanceof File) {
            // Upload the original image first
            const originalObjectName = `picture/original-${Date.now()}-${idx}-${picture.cover.name}`
            raw_image_url = await uploadFile(picture.cover, originalObjectName)

            // Then upload the compressed version
            const compressedPicture = await compressImage(picture.cover, 0.9)
            const compressedObjectName = `picture/compressed-${Date.now()}-${idx}-${compressedPicture.name}`
            image_url = await uploadFile(compressedPicture, compressedObjectName)
          }

          // Return only the properties needed for database submission
          return {
            id: picture.id,
            title: picture.title,
            subtitle: picture.subtitle,
            description: picture.description,
            image_url,
            raw_image_url,
          }
        }),
      )

      // Create the object that matches what the database expects
      const newPictureSet: PictureSetSubmitData = {
        title,
        subtitle,
        description,
        cover_image_url,
        position, // Make sure position is included
        pictures: processedPictures,
      }

      console.log("Submitting picture set with position:", position)
      onSubmit(newPictureSet, editingId)

      if (!isEditMode) {
        resetForm()
      }
    } catch (error) {
      console.error("Error submitting picture set:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update the handlePictureChange function to also generate and store the compressed file
  const handlePictureChange = async (index: number, field: keyof PictureFormData, value: string | File | null) => {
    const updatedPictures = [...pictures]

    // If changing the image file, generate preview and compressed version
    if (field === "cover" && value instanceof File) {
      const { url, size } = await getImagePreview(value)

      // Create the compressed version but don't upload it yet
      const compressedFile = await compressImage(value, 0.9)
      const compressedPreview = await getImagePreview(compressedFile)

      updatedPictures[index] = {
        ...updatedPictures[index],
        [field]: value,
        previewUrl: url,
        originalSize: size,
        compressedSize: compressedPreview.size,
        compressedFile: compressedFile,
      }
    } else {
      updatedPictures[index] = { ...updatedPictures[index], [field]: value }
    }

    setPictures(updatedPictures)
  }

  const handleAddPicture = () => {
    setPictures([
      ...pictures,
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
  }

  const handleRemovePicture = (index: number) => {
    const updatedPictures = [...pictures]
    updatedPictures.splice(index, 1)
    setPictures(updatedPictures)
  }

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setCover(file)

    if (file) {
      const { url, size } = await getImagePreview(file)
      setCoverPreview(url)
      setCoverOriginalSize(size)
      setCoverImageUrl("") // Clear the existing URL since we're uploading a new file
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

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B"
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + " KB"
    else return (bytes / 1048576).toFixed(2) + " MB"
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">{isEditMode ? "Edit Picture Set" : "Create New Picture Set"}</h2>
        {isEditMode && onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel Edit
          </Button>
        )}
      </div>

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
      <div className="space-y-2">
        <Label htmlFor="cover">Cover Image</Label>
        {coverPreview && (
          <div className="mt-2 mb-4 p-4 border rounded">
            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-gray-100">
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
        <Input id="cover" type="file" onChange={handleCoverChange} accept="image/*" />
      </div>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label>Pictures</Label>
          <Button type="button" onClick={handleAddPicture} size="sm">
            Add Picture
          </Button>
        </div>
        {pictures.map((picture, index) => (
          <div key={index} className="space-y-2 p-4 border rounded">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">Picture {index + 1}</h3>
              <Button type="button" variant="destructive" size="sm" onClick={() => handleRemovePicture(index)}>
                Remove
              </Button>
            </div>
            <Input
              placeholder="Title"
              value={picture.title}
              onChange={(e) => handlePictureChange(index, "title", e.target.value)}
            />
            <Input
              placeholder="Subtitle"
              value={picture.subtitle}
              onChange={(e) => handlePictureChange(index, "subtitle", e.target.value)}
            />
            <Textarea
              placeholder="Description"
              value={picture.description}
              onChange={(e) => handlePictureChange(index, "description", e.target.value)}
            />

            {picture.previewUrl && (
              <div className="mt-2 mb-4">
                <div className="relative aspect-video w-full overflow-hidden rounded-md bg-gray-100">
                  <img
                    src={picture.previewUrl || "/placeholder.svg"}
                    alt={`Picture ${index + 1} preview`}
                    className="object-contain w-full h-full"
                  />
                </div>
                {picture.originalSize && picture.originalSize > 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Original size: {formatSize(picture.originalSize || 0)}
                    {picture.compressedSize && (
                      <>
                        {" "}
                        • Compressed size: {formatSize(picture.compressedSize)}(
                        {((picture.compressedSize / (picture.originalSize || 1)) * 100).toFixed(1)}% of original)
                      </>
                    )}
                  </p>
                )}
              </div>
            )}

            <Input
              type="file"
              onChange={(e) => handlePictureChange(index, "cover", e.target.files?.[0] || null)}
              accept="image/*"
            />
          </div>
        ))}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : isEditMode ? "Update Picture Set" : "Submit Picture Set"}
      </Button>
    </form>
  )
}
