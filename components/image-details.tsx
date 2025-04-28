interface ImageItem {
  url: string
  rawUrl: string
  alt: string
  title: string
  titleCn: string
  description: string
}

interface ImageDetailsProps {
  image: ImageItem
}

export function ImageDetails({ image }: ImageDetailsProps) {
  // If there's no content to display, return null
  if (!image.title && !image.titleCn && !image.description) {
    return null
  }

  return (
    <div className="py-2">
      <div className="flex flex-wrap items-baseline gap-x-4">
        {image.title && <h2 className="text-xl font-bold">{image.title}</h2>}
        {image.titleCn && <h3 className="text-lg text-gray-600">{image.titleCn}</h3>}
      </div>
      {image.description && <p className="text-gray-700 mt-2">{image.description}</p>}
    </div>
  )
}
