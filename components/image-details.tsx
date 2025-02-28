interface ImageItem {
  url: string
  alt: string
  title: string
  titleCn: string
  description: string
}

interface ImageDetailsProps {
  image: ImageItem
}

export function ImageDetails({ image }: ImageDetailsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">{image.title}</h2>
        <h3 className="text-xl text-gray-600">{image.titleCn}</h3>
      </div>
      <p className="text-gray-700">{image.description}</p>
    </div>
  )
}
