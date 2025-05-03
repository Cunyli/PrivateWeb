"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase"
import { PictureSetForm } from "./picture-set-form"
import { PictureSetList } from "./picture-set-list"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import type { PictureSet } from "@/lib/pictureSet.types"
import type { PictureSetSubmitData } from "@/lib/form-types"
import { deleteFileFromR2 } from "@/utils/r2-helpers"

export function AdminDashboard() {
  const [pictureSets, setPictureSets] = useState<PictureSet[]>([])
  const [editingPictureSet, setEditingPictureSet] = useState<PictureSet | null>(null)
  const [activeTab, setActiveTab] = useState("list")

  useEffect(() => {
    fetchPictureSets()
  }, [])

  const fetchPictureSets = async () => {
    try {
      // First fetch the picture sets
      const { data: setsData, error: setsError } = await supabase
        .from("picture_sets")
        .select("*")
        .order("created_at", { ascending: false })

      if (setsError) {
        console.error("Error fetching picture sets:", setsError)
        toast({
          title: "Error",
          description: "Failed to load picture sets",
          variant: "destructive",
        })
        return
      }

      // Then fetch pictures for each set
      const sets = await Promise.all(
        (setsData || []).map(async (set) => {
          const { data: picturesData } = await supabase
            .from("pictures")
            .select("*")
            .eq("picture_set_id", set.id)
            .order("order_index", { ascending: true })

          return {
            ...set,
            pictures: picturesData || [],
          }
        }),
      )

      setPictureSets(sets)
    } catch (error) {
      console.error("Error in fetchPictureSets:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading data",
        variant: "destructive",
      })
    }
  }

  // Handle adding or updating a picture set
  const handleSubmitPictureSet = async (newPictureSet: PictureSetSubmitData, pictureSetId?: number) => {
    try {
      console.log("Submitting picture set with position:", newPictureSet.position)

      if (pictureSetId) {
        // Get the existing picture set to compare and handle file deletions
        const { data: existingSet } = await supabase
          .from("picture_sets")
          .select("cover_image_url")
          .eq("id", pictureSetId)
          .single()

        // Update existing picture set
        const { error: updateError } = await supabase
          .from("picture_sets")
          .update({
            title: newPictureSet.title,
            subtitle: newPictureSet.subtitle,
            description: newPictureSet.description,
            cover_image_url: newPictureSet.cover_image_url,
            position: newPictureSet.position,
          })
          .eq("id", pictureSetId)

        if (updateError) {
          console.error("Error updating picture set:", updateError)
          toast({
            title: "Error",
            description: "Failed to update picture set",
            variant: "destructive",
          })
          return
        }

        // If cover image was changed, delete the old one from R2
        if (
          existingSet &&
          existingSet.cover_image_url &&
          existingSet.cover_image_url !== newPictureSet.cover_image_url
        ) {
          await deleteFileFromR2(existingSet.cover_image_url)
        }

        // Handle pictures - this is more complex as we need to:
        // 1. Update existing pictures
        // 2. Add new pictures
        // 3. Remove deleted pictures

        // Get existing pictures
        const { data: existingPictures } = await supabase
          .from("pictures")
          .select("*")
          .eq("picture_set_id", pictureSetId)

        const existingIds = existingPictures?.map((p) => p.id) || []
        const updatedIds = newPictureSet.pictures.filter((p) => p.id).map((p) => p.id as number)

        // Find pictures to delete (in existing but not in updated)
        const picturesToDelete = existingPictures?.filter((p) => !updatedIds.includes(p.id)) || []
        const idsToDelete = picturesToDelete.map((p) => p.id)

        // Delete removed pictures from R2 storage first
        for (const picture of picturesToDelete) {
          if (picture.image_url) {
            await deleteFileFromR2(picture.image_url)
          }
          if (picture.raw_image_url) {
            await deleteFileFromR2(picture.raw_image_url)
          }
        }

        // Then delete from database
        if (idsToDelete.length > 0) {
          const { error: deleteError } = await supabase.from("pictures").delete().in("id", idsToDelete)

          if (deleteError) {
            console.error("Error deleting pictures:", deleteError)
          }
        }

        // Update or insert pictures
        for (const [index, picture] of newPictureSet.pictures.entries()) {
          if (picture.id) {
            // Find the existing picture to compare URLs
            const existingPicture = existingPictures?.find((p) => p.id === picture.id)

            // Update existing picture
            const { error: pictureUpdateError } = await supabase
              .from("pictures")
              .update({
                title: picture.title,
                subtitle: picture.subtitle,
                description: picture.description,
                image_url: picture.image_url || undefined,
                raw_image_url: picture.raw_image_url || undefined,
                order_index: index,
              })
              .eq("id", picture.id)

            if (pictureUpdateError) {
              console.error("Error updating picture:", pictureUpdateError)
            }

            // Delete old images if they were replaced
            if (existingPicture) {
              if (existingPicture.image_url && existingPicture.image_url !== picture.image_url) {
                await deleteFileFromR2(existingPicture.image_url)
              }
              if (existingPicture.raw_image_url && existingPicture.raw_image_url !== picture.raw_image_url) {
                await deleteFileFromR2(existingPicture.raw_image_url)
              }
            }
          } else {
            // Insert new picture
            const { error: pictureInsertError } = await supabase.from("pictures").insert({
              picture_set_id: pictureSetId,
              order_index: index,
              title: picture.title,
              subtitle: picture.subtitle,
              description: picture.description,
              image_url: picture.image_url,
              raw_image_url: picture.raw_image_url,
            })

            if (pictureInsertError) {
              console.error("Error inserting picture:", pictureInsertError)
            }
          }
        }

        toast({
          title: "Success",
          description: "Picture set updated successfully",
        })

        // Reset edit mode
        setEditingPictureSet(null)
        setActiveTab("list")
      } else {
        // Insert new picture set
        const { data: pictureSetData, error: pictureSetError } = await supabase
          .from("picture_sets")
          .insert({
            title: newPictureSet.title,
            subtitle: newPictureSet.subtitle,
            description: newPictureSet.description,
            cover_image_url: newPictureSet.cover_image_url,
            position: newPictureSet.position,
          })
          .select()

        if (pictureSetError) {
          console.error("Error inserting picture set:", pictureSetError)
          toast({
            title: "Error",
            description: "Failed to create picture set",
            variant: "destructive",
          })
          return
        }

        const pictureSetId = pictureSetData[0].id

        // Insert all pictures
        for (const [index, picture] of newPictureSet.pictures.entries()) {
          const { error: pictureError } = await supabase.from("pictures").insert({
            picture_set_id: pictureSetId,
            order_index: index,
            title: picture.title,
            subtitle: picture.subtitle,
            description: picture.description,
            image_url: picture.image_url,
            raw_image_url: picture.raw_image_url,
          })

          if (pictureError) {
            console.error("Error inserting picture:", pictureError)
          }
        }

        toast({
          title: "Success",
          description: "Picture set created successfully",
        })
      }

      // Refresh the picture sets
      fetchPictureSets()
    } catch (error) {
      console.error("Error in handleSubmitPictureSet:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  // Handle deleting a picture set
  const handleDeletePictureSet = async (id: number) => {
    try {
      // First get the picture set and its pictures to delete files from R2
      const { data: pictureSet } = await supabase.from("picture_sets").select("*, pictures(*)").eq("id", id).single()

      if (pictureSet) {
        // Delete cover image from R2
        if (pictureSet.cover_image_url) {
          await deleteFileFromR2(pictureSet.cover_image_url)
        }

        // Delete all picture images from R2
        if (pictureSet.pictures && pictureSet.pictures.length > 0) {
          for (const picture of pictureSet.pictures) {
            if (picture.image_url) {
              await deleteFileFromR2(picture.image_url)
            }
            if (picture.raw_image_url) {
              await deleteFileFromR2(picture.raw_image_url)
            }
          }
        }
      }

      // Then delete from database (pictures will be deleted via CASCADE)
      const { error } = await supabase.from("picture_sets").delete().eq("id", id)

      if (error) {
        console.error("Error deleting picture set:", error)
        toast({
          title: "Error",
          description: "Failed to delete picture set",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Picture set deleted successfully",
      })

      // Refresh the picture sets
      fetchPictureSets()
    } catch (error) {
      console.error("Error in handleDeletePictureSet:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  // Handle editing a picture set
  const handleEditPictureSet = (pictureSet: PictureSet) => {
    setEditingPictureSet(pictureSet)
    setActiveTab("form")
  }

  // Handle canceling edit mode
  const handleCancelEdit = () => {
    setEditingPictureSet(null)
    setActiveTab("list")
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="list">Picture Sets</TabsTrigger>
          <TabsTrigger value="form">{editingPictureSet ? "Edit Picture Set" : "Add New Picture Set"}</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <PictureSetList pictureSets={pictureSets} onEdit={handleEditPictureSet} onDelete={handleDeletePictureSet} />
        </TabsContent>
        <TabsContent value="form">
          <PictureSetForm
            onSubmit={handleSubmitPictureSet}
            editingPictureSet={editingPictureSet}
            onCancel={handleCancelEdit}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
