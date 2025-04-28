"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase"
import { PictureSetForm } from "./picture-set-form"
import { PictureSetList } from "./picture-set-list"
import type { PictureSet } from "@/lib/pictureSet.types"
import type { Picture } from "@/lib/pictureSet.types"

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

  // Update the handleAddPictureSet function to properly handle both image URLs
  const handleAddPictureSet = async (
    newPictureSet: Omit<PictureSet, "id" | "created_at" | "updated_at" | "pictures"> & {
      pictures: Omit<Picture, "id" | "picture_set_id" | "order_index" | "created_at" | "updated_at">[]
    },
  ) => {
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

      // Insert all pictures with both image URLs
      for (const [index, picture] of newPictureSet.pictures.entries()) {
        const { error: pictureError } = await supabase.from("pictures").insert({
          picture_set_id: pictureSetId,
          order_index: index, // Add order_index based on array position
          title: picture.title,
          subtitle: picture.subtitle,
          description: picture.description,
          image_url: picture.image_url, // compressed version
          raw_image_url: picture.raw_image_url, // original version
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
