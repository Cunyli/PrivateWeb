import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PictureSet } from "@/lib/pictureSet.types"

// interface PictureSet {
//   id: string
//   title: string
//   subtitle?: string
//   description?: string
//   cover_image_url?: string
//   pictures?: any[]
// }

interface PictureSetListProps {
  pictureSets: PictureSet[]
}

export function PictureSetList({ pictureSets }: PictureSetListProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Uploaded Picture Sets</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {pictureSets.map((set) => {
          const count = (set.pictures?.length || 0) + (set.cover_image_url ? 1 : 0);
          return (
            <Card key={set.id}>
              <CardHeader>
                <CardTitle>{set.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {set.cover_image_url && (
                  <div className="relative w-full h-48 mb-4">
                    <Image src={set.cover_image_url || "/placeholder.svg"} alt={set.title} fill className="object-cover rounded" />
                  </div>
                )}
                <p className="text-sm text-gray-500">{set.subtitle}</p>
                <p className="mt-2">{set.description}</p>
                <p className="mt-2 text-sm text-gray-500">
                  {count > 0 ? `${count} pictures` : "No pictures"}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

