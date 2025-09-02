"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase"
import { PictureSetForm } from "./picture-set-form"
import { PictureSetList } from "./picture-set-list"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import type { PictureSet, Picture } from "@/lib/pictureSet.types"
import type { PictureFormData, PictureSetSubmitData } from "@/lib/form-types"
import { deleteFileFromR2 } from "@/utils/r2-helpers"

export function AdminDashboard() {
  const [pictureSets, setPictureSets] = useState<PictureSet[]>([])
  const [editingPictureSet, setEditingPictureSet] = useState<PictureSet | null>(null)
  const [activeTab, setActiveTab] = useState("list")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchPictureSets()
  }, [])

  const fetchPictureSets = async () => {
    try {
      setIsLoading(true)
      console.log("Fetching picture sets...")

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

      console.log(`Found ${setsData?.length || 0} picture sets`)

      // Then fetch pictures for each set
      const sets = await Promise.all(
        (setsData || []).map(async (set) => {
          const { data: picturesData, error: picturesError } = await supabase
            .from("pictures")
            .select("*")
            .eq("picture_set_id", set.id)
            .order("order_index", { ascending: true })

          if (picturesError) {
            console.error(`Error fetching pictures for set ${set.id}:`, picturesError)
          }

          console.log(`Set ${set.id} has ${picturesData?.length || 0} pictures`)

          return {
            ...set,
            pictures: picturesData || [],
          }
        }),
      )

      setPictureSets(sets)

      // Don't automatically update editing state when fetching data
      // This prevents unwanted state changes after submit operations
    } catch (error) {
      console.error("Error in fetchPictureSets:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to delete a file from R2 with proper error handling and logging
  const safeDeleteFromR2 = async (url: string | null | undefined): Promise<boolean> => {
    if (!url) {
      console.log("No URL provided to safeDeleteFromR2, skipping")
      return true // Nothing to delete
    }

    try {
      console.log(`Attempting to delete file from R2: ${url}`)

      // Directly call deleteFileFromR2 with the URL
      const success = await deleteFileFromR2(url)

      if (success) {
        console.log(`Successfully deleted file from R2: ${url}`)
      } else {
        console.error(`Failed to delete file from R2: ${url}`)
      }

      return success
    } catch (error) {
      console.error(`Error in safeDeleteFromR2 for URL (${url}):`, error)
      return false
    }
  }

  // Helper function to compare pictures and find ones to delete
  const findPicturesToDelete = (
    existingPictures: Picture[] | null | undefined,
    updatedPictures: PictureFormData[],
  ): Picture[] => {
    if (!existingPictures || existingPictures.length === 0) {
      return []
    }

    // Get IDs of pictures in the updated set
    const updatedIds = updatedPictures.filter((p) => p.id !== undefined).map((p) => p.id as number)

    // Find pictures that exist in the database but not in the updated set
    return existingPictures.filter((p) => !updatedIds.includes(p.id))
  }

  // Handle adding or updating a picture set
  const handleSubmitPictureSet = async (newPictureSet: PictureSetSubmitData, pictureSetId?: number) => {
    try {
      console.log("Submitting picture set with position:", newPictureSet.position)
      console.log(`Picture set has ${newPictureSet.pictures.length} pictures`)

      if (pictureSetId) {
        // EDITING EXISTING PICTURE SET
        console.log(`Editing existing picture set with ID: ${pictureSetId}`)

        // Get the existing picture set to compare and handle file deletions
        const { data: existingSet, error: fetchError } = await supabase
          .from("picture_sets")
          .select("cover_image_url")
          .eq("id", pictureSetId)
          .single()

        if (fetchError) {
          console.error(`Error fetching picture set ${pictureSetId}:`, fetchError)
          toast({
            title: "Error",
            description: "Failed to fetch picture set data",
            variant: "destructive",
          })
          return
        }

        // Get existing pictures
        const { data: existingPictures, error: picturesError } = await supabase
          .from("pictures")
          .select("*")
          .eq("picture_set_id", pictureSetId)

        if (picturesError) {
          console.error(`Error fetching pictures for set ${pictureSetId}:`, picturesError)
          toast({
            title: "Error",
            description: "Failed to fetch picture data",
            variant: "destructive",
          })
          return
        }

        console.log(`Found ${existingPictures?.length || 0} existing pictures in database`)

        // Find pictures to delete (in existing but not in updated)
        const picturesToDelete = findPicturesToDelete(existingPictures, newPictureSet.pictures)
        const idsToDelete = picturesToDelete.map((p) => p.id)

        console.log(`Found ${picturesToDelete.length} pictures to delete:`, idsToDelete)

        // Delete removed pictures from R2 storage first
        for (const picture of picturesToDelete) {
          console.log(`Processing deletion for picture ${picture.id}`)

          // Delete compressed image
          if (picture.image_url) {
            console.log(`Deleting compressed image: ${picture.image_url}`)
            const imageDeleted = await safeDeleteFromR2(picture.image_url)
            console.log(`Deleted compressed image for picture ${picture.id}: ${imageDeleted ? "Success" : "Failed"}`)
          } else {
            console.log(`No compressed image URL for picture ${picture.id}`)
          }

          // Delete raw image
          if (picture.raw_image_url) {
            console.log(`Deleting raw image: ${picture.raw_image_url}`)
            const rawDeleted = await safeDeleteFromR2(picture.raw_image_url)
            console.log(`Deleted raw image for picture ${picture.id}: ${rawDeleted ? "Success" : "Failed"}`)
          } else {
            console.log(`No raw image URL for picture ${picture.id}`)
          }
        }

        // Then delete from database
        if (idsToDelete.length > 0) {
          console.log(`Deleting ${idsToDelete.length} pictures from database:`, idsToDelete)
          const { error: deleteError } = await supabase.from("pictures").delete().in("id", idsToDelete)

          if (deleteError) {
            console.error("Error deleting pictures from database:", deleteError)
            toast({
              title: "Error",
              description: "Failed to delete pictures from database",
              variant: "destructive",
            })
          } else {
            console.log(`Successfully deleted ${idsToDelete.length} pictures from database`)
          }
        }

        // If cover image was changed, delete the old one from R2
        if (
          existingSet &&
          existingSet.cover_image_url &&
          existingSet.cover_image_url !== newPictureSet.cover_image_url
        ) {
          console.log(`Cover image changed. Deleting old cover: ${existingSet.cover_image_url}`)
          await safeDeleteFromR2(existingSet.cover_image_url)
        }

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
              console.error(`Error updating picture ${picture.id}:`, pictureUpdateError)
              continue
            }

            // Delete old images if they were replaced
            if (existingPicture) {
              if (existingPicture.image_url && existingPicture.image_url !== picture.image_url) {
                console.log(
                  `Image URL changed for picture ${picture.id}. Deleting old image: ${existingPicture.image_url}`,
                )
                await safeDeleteFromR2(existingPicture.image_url)
              }
              if (existingPicture.raw_image_url && existingPicture.raw_image_url !== picture.raw_image_url) {
                console.log(
                  `Raw image URL changed for picture ${picture.id}. Deleting old raw image: ${existingPicture.raw_image_url}`,
                )
                await safeDeleteFromR2(existingPicture.raw_image_url)
              }
            }
          } else {
            // Insert new picture
            console.log(`Inserting new picture at index ${index}`)
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
              console.error("Error inserting new picture:", pictureInsertError)
            }
          }
        }

        toast({
          title: "Success",
          description: "Picture set updated successfully",
        })

        // Reset edit mode first - 立即重置编辑状态
        const currentEditingPictureSet = editingPictureSet
        setEditingPictureSet(null)
        setActiveTab("list")
        
        // Refresh the picture sets to update the UI
        // 使用 setTimeout 确保状态重置完成后再刷新数据
        setTimeout(async () => {
          await fetchPictureSets()
        }, 0)
      } else {
        // CREATING NEW PICTURE SET
        console.log("Creating new picture set")

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
        console.log(`Created new picture set with ID: ${pictureSetId}`)

        // Insert all pictures
        for (const [index, picture] of newPictureSet.pictures.entries()) {
          console.log(`Inserting picture at index ${index}`)
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
            console.error(`Error inserting picture at index ${index}:`, pictureError)
          }
        }

        toast({
          title: "Success",
          description: "Picture set created successfully",
        })

        // 新建成功后也切换到列表视图
        setActiveTab("list")
        
        // Refresh the picture sets to update the UI
        await fetchPictureSets()
      }
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
      console.log(`Deleting picture set with ID: ${id}`)

      // First get the picture set and its pictures to delete files from R2
      const { data: pictureSet, error: fetchError } = await supabase
        .from("picture_sets")
        .select("*, pictures(*)")
        .eq("id", id)
        .single()

      if (fetchError) {
        console.error(`Error fetching picture set ${id} for deletion:`, fetchError)
        toast({
          title: "Error",
          description: "Failed to fetch picture set data for deletion",
          variant: "destructive",
        })
        return
      }

      if (!pictureSet) {
        console.error(`Picture set ${id} not found for deletion`)
        toast({
          title: "Error",
          description: "Picture set not found",
          variant: "destructive",
        })
        return
      }

      console.log(`Found picture set with ${pictureSet.pictures?.length || 0} pictures`)

      // Delete cover image from R2
      if (pictureSet.cover_image_url) {
        console.log(`Deleting cover image: ${pictureSet.cover_image_url}`)
        const coverDeleted = await safeDeleteFromR2(pictureSet.cover_image_url)
        console.log(`Cover image deletion ${coverDeleted ? "successful" : "failed"}`)
      }

      // Delete all picture images from R2
      if (pictureSet.pictures && pictureSet.pictures.length > 0) {
        console.log(`Deleting ${pictureSet.pictures.length} pictures from R2`)

        for (const picture of pictureSet.pictures) {
          // Delete compressed image
          if (picture.image_url) {
            console.log(`Deleting compressed image for picture ${picture.id}: ${picture.image_url}`)
            const imageDeleted = await safeDeleteFromR2(picture.image_url)
            console.log(`Deleted compressed image for picture ${picture.id}: ${imageDeleted ? "Success" : "Failed"}`)
          }

          // Delete raw image
          if (picture.raw_image_url) {
            console.log(`Deleting raw image for picture ${picture.id}: ${picture.raw_image_url}`)
            const rawDeleted = await safeDeleteFromR2(picture.raw_image_url)
            console.log(`Deleted raw image for picture ${picture.id}: ${rawDeleted ? "Success" : "Failed"}`)
          }
        }
      }

      // Then delete from database (pictures will be deleted via CASCADE)
      const { error: deleteError } = await supabase.from("picture_sets").delete().eq("id", id)

      if (deleteError) {
        console.error("Error deleting picture set from database:", deleteError)
        toast({
          title: "Error",
          description: "Failed to delete picture set from database",
          variant: "destructive",
        })
        return
      }

      console.log(`Successfully deleted picture set ${id} from database`)

      toast({
        title: "Success",
        description: "Picture set deleted successfully",
      })

      // Refresh the picture sets
      await fetchPictureSets()
    } catch (error) {
      console.error("Error in handleDeletePictureSet:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred during deletion",
        variant: "destructive",
      })
    }
  }

  // Handle editing a picture set
  const handleEditPictureSet = async (pictureSet: PictureSet) => {
    try {
      console.log(`Preparing to edit picture set ${pictureSet.id}`)

      // Fetch the latest data for this picture set to ensure we have the most up-to-date information
      const { data: freshPictureSet, error } = await supabase
        .from("picture_sets")
        .select("*, pictures(*)")
        .eq("id", pictureSet.id)
        .single()

      if (error) {
        console.error("Error fetching picture set for editing:", error)
        toast({
          title: "Error",
          description: "Failed to load picture set data for editing",
          variant: "destructive",
        })
        return
      }

      console.log(
        `Loaded fresh data for picture set ${pictureSet.id} with ${freshPictureSet.pictures?.length || 0} pictures`,
      )

      // Set the editing state with the fresh data
      setEditingPictureSet(freshPictureSet)
      setActiveTab("form")
    } catch (error) {
      console.error("Error in handleEditPictureSet:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
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
          {isLoading ? (
            <div className="flex justify-center py-8">
              <p>Loading picture sets...</p>
            </div>
          ) : (
            <PictureSetList pictureSets={pictureSets} onEdit={handleEditPictureSet} onDelete={handleDeletePictureSet} />
          )}
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
