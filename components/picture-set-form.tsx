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

// Updated helper function with crossOrigin support
async function compressImage(file: File, quality: number = 0.88): Promise<File> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous"; // Allow cross-origin usage for local file
    image.src = URL.createObjectURL(file);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas context not available"));
        return;
      }
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Compression failed"));
          return;
        }
        const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".webp"), { type: "image/webp" });
        resolve(compressedFile);
      }, "image/webp", quality);
    };
    image.onerror = (err) => reject(err);
  });
}

export function PictureSetForm({ onSubmit }: PictureSetFormProps) {
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [description, setDescription] = useState("")
  const [cover, setCover] = useState<File | null>(null)
  const [pictures, setPictures] = useState<Picture[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Updated: upload file via signed URL
  const uploadFile = async (file: File, objectName: string): Promise<string> => {
    const res = await fetch("/api/upload-to-r2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectName,
        contentType: file.type,
      }),
    });
    if (!res.ok) throw new Error("Failed to get signed URL");
    const { uploadUrl } = await res.json();
    const fileBuffer = await file.arrayBuffer();
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: fileBuffer,
    });
    if (!uploadRes.ok) throw new Error("File upload failed");
    return `https://pub-aa03052e73cc405b9b70dc0fc8aeb455.r2.dev/${objectName}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let cover_image_url = "";
      if (cover) {
        // Compress cover image to WebP before upload
        const compressedCover = await compressImage(cover, 0.88);
        const objectName = `picture/cover-${Date.now()}-${compressedCover.name}`;
        cover_image_url = await uploadFile(compressedCover, objectName);
      }

      // Process pictures: compress and upload each file if available
      const processedPictures = await Promise.all(
        pictures.map(async (picture, idx) => {
          let image_url = "";
          if (picture.cover instanceof File) {
            const compressedPicture = await compressImage(picture.cover, 0.88);
            const objectName = `picture/picture-${Date.now()}-${idx}-${compressedPicture.name}`;
            image_url = await uploadFile(compressedPicture, objectName);
          }
          return {
            title: picture.title,
            subtitle: picture.subtitle,
            description: picture.description,
            cover: null,
            image_url, // use image_url key for database insertion
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

