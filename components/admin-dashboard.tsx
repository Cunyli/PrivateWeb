"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase"
import { PictureSetForm } from "./picture-set-form"
import { PictureSetList } from "./picture-set-list"

interface PictureSet {
  id?: string
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
  image_url: string
}

export function AdminDashboard() {
  const [pictureSets, setPictureSets] = useState<PictureSet[]>([])

  useEffect(() => {
    fetchPictureSets()
  }, [])

  const fetchPictureSets = async () => {
    const { data, error } = await supabase.from("picture_sets").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching picture sets:", error)
    } else {
      setPictureSets(data || [])
    }
  }

  const handleAddPictureSet = async (newPictureSet: PictureSet) => {
    try {
      // Insert the picture set
      const { data: pictureSetData, error: pictureSetError } = await supabase
        .from("picture_sets")
        .insert({
          title: newPictureSet.title,
          subtitle: newPictureSet.subtitle,
          description: newPictureSet.description,
          cover_image_url: newPictureSet.cover_image_url,
        })
        .select()

      if (pictureSetError) throw pictureSetError

      const pictureSetId = pictureSetData[0].id

      // Insert the pictures
      for (const picture of newPictureSet.pictures) {
        const { error: pictureError } = await supabase.from("pictures").insert({
          picture_set_id: pictureSetId,
          title: picture.title,
          subtitle: picture.subtitle,
          description: picture.description,
          image_url: picture.image_url,
        })

        if (pictureError) throw pictureError
      }

      // Refresh the picture sets
      fetchPictureSets()
    } catch (error) {
      console.error("Error adding picture set:", error)
    }
  }

  return (
    <div className="space-y-8">
      <PictureSetForm onSubmit={handleAddPictureSet} />
      <PictureSetList pictureSets={pictureSets} />
    </div>
  )
}

