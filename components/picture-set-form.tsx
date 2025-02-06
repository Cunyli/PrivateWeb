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

  // Helper: convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remove prefix "data:*/*;base64," if needed
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Helper: upload file via API and return image URL
  const uploadFile = async (file: File, objectName: string): Promise<string> => {
    const base64Data = await fileToBase64(file);
    const res = await fetch("/api/upload-to-r2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileData: base64Data,
        objectName,
        contentType: file.type,
      }),
    });
    if (!res.ok) throw new Error("Upload failed");
    // Use fixed public URL base and object's path
    return `https://pub-aa03052e73cc405b9b70dc0fc8aeb455.r2.dev/${objectName}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Upload cover image if selected
      let cover_image_url = "";
      if (cover) {
        // Add "picture/" folder prefix
        const objectName = `picture/cover-${Date.now()}-${cover.name}`;
        cover_image_url = await uploadFile(cover, objectName);
      }

      // Process pictures: upload each file if available
      const processedPictures = await Promise.all(
        pictures.map(async (picture, idx) => {
          let image_url = "";
          if (picture.cover instanceof File) {
            // Add "picture/" folder prefix for picture files
            const objectName = `picture/picture-${Date.now()}-${idx}-${picture.cover.name}`;
            image_url = await uploadFile(picture.cover, objectName);
          }
          // Return picture object with the uploaded image_url
          return {
            title: picture.title,
            subtitle: picture.subtitle,
            description: picture.description,
            cover: null,
            image_url,
          };
        })
      );

      const newPictureSet = {
        title,
        subtitle,
        description,
        cover_image_url,
        pictures: processedPictures,
      };

      onSubmit(newPictureSet);
      resetForm();
    } catch (error) {
      console.error("Error submitting picture set:", error);
    } finally {
      setIsSubmitting(false);
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

