"use client"

import Image from "next/image"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit, Trash2 } from "lucide-react"
import type { PictureSet } from "@/lib/pictureSet.types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useState } from "react"

interface PictureSetListProps {
  pictureSets: PictureSet[]
  onEdit: (pictureSet: PictureSet) => void
  onDelete: (id: number) => void
}

export function PictureSetList({ pictureSets, onEdit, onDelete }: PictureSetListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pictureSetToDelete, setPictureSetToDelete] = useState<number | null>(null)

  const handleDeleteClick = (id: number) => {
    setPictureSetToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (pictureSetToDelete !== null) {
      onDelete(pictureSetToDelete)
      setPictureSetToDelete(null)
    }
    setDeleteDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Uploaded Picture Sets</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {pictureSets.map((set) => {
          const count = (set.pictures?.length || 0) + (set.cover_image_url ? 1 : 0)
          return (
            <Card key={set.id} className="group">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{set.title}</span>
                  <span className="text-sm font-normal text-gray-500">Position: {set.position || "up"}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {set.cover_image_url && (
                  <div className="relative w-full h-48 mb-4">
                    <Image
                      src={set.cover_image_url || "/placeholder.svg"}
                      alt={set.title}
                      fill
                      className="object-cover rounded"
                    />
                  </div>
                )}
                <p className="text-sm text-gray-500">{set.subtitle}</p>
                <p className="mt-2 line-clamp-2">{set.description}</p>
                <p className="mt-2 text-sm text-gray-500">{count > 0 ? `${count} pictures` : "No pictures"}</p>
              </CardContent>
              <CardFooter className="opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex justify-end w-full gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(set)}>
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(set.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this picture set?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the picture set and all its pictures.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
