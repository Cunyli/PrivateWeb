"use client"

import { useState } from "react"
import { supabase } from "@/utils/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface PictureSet {
  title: string
  subtitle: string
  description: string
  cover_image_url: string
  pictures: Picture[]
}

interface Picture {
  title: string
  subtitle: string
  description: string
  cover: File | null
  image_url?: string
}

interface PictureSetFormProps {
  onSubmit: (pictureSet: PictureSet) => void
}

export function PictureSetForm({ onSubmit }: PictureSetFormProps) {
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [description, setDescription] = useState("")
  const [cover, setCover] = useState<File | null>(null)
  const [pictures, setPictures] = useState<Picture[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      let coverUrl = ""
      if (cover) {
        const { data, error } = await supabase.storage.from("covers").upload(`${Date.now()}-${cover.name}`, cover)

        if (error) throw error

        const { data: publicUrlData } = supabase.storage.from("covers").getPublicUrl(data.path)

        coverUrl = publicUrlData.publicUrl
      }

      const newPictureSet: PictureSet = {
        title,
        subtitle,
        description,
        cover_image_url: coverUrl,
        pictures: await Promise.all(
          pictures.map(async (picture) => {
            let imageUrl = ""
            if (picture.cover) {
              const { data, error } = await supabase.storage
                .from("pictures")
                .upload(`${Date.now()}-${picture.cover.name}`, picture.cover)

              if (error) throw error

              const { data: publicUrlData } = supabase.storage.from("pictures").getPublicUrl(data.path)

              imageUrl = publicUrlData.publicUrl
            }

            return {
              title: picture.title,
              subtitle: picture.subtitle,
              description: picture.description,
              image_url: imageUrl,
            }
          }),
        ),
      }

      onSubmit(newPictureSet)
      resetForm()
    } catch (error) {
      console.error("Error submitting picture set:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddPicture = () => {
    setPictures([...pictures, { title: "", subtitle: "", description: "", cover: null }])
  }

  const handlePictureChange = (index: number, field: keyof Picture, value: string | File | null) => {
    const updatedPictures = [...pictures]
    updatedPictures[index] = { ...updatedPictures[index], [field]: value }
    setPictures(updatedPictures)
  }

  const resetForm = () => {
    setTitle("")
    setSubtitle("")
    setDescription("")
    setCover(null)
    setPictures([])
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
        <Label htmlFor="cover">Cover Image</Label>
        <Input id="cover" type="file" onChange={(e) => setCover(e.target.files?.[0] || null)} accept="image/*" />
      </div>
      <div className="space-y-4">
        <Label>Pictures</Label>
        {pictures.map((picture, index) => (
          <div key={index} className="space-y-2 p-4 border rounded">
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
            <Input
              type="file"
              onChange={(e) => handlePictureChange(index, "cover", e.target.files?.[0] || null)}
              accept="image/*"
            />
          </div>
        ))}
        <Button type="button" onClick={handleAddPicture}>
          Add Picture
        </Button>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : "Submit Picture Set"}
      </Button>
    </form>
  )
}

