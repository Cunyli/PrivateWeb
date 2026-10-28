export type PhotoSource = { preview: string; original: string }
export type LoadedPhoto = { src: string; original: string; width: number; height: number; element: HTMLImageElement }
type Entry = { promise: Promise<LoadedPhoto>; image: HTMLImageElement; requested: boolean; pending: boolean; cancel: () => void }

/** Holds decoded previews, rather than just their URL/dimension promises. */
export class PhotoPreviewCache {
  private entries = new Map<string, Entry>()

  load(source: PhotoSource, priority: "high" | "low" = "low") {
    if (priority === "high") {
      // A new selection wins over stale selections and speculative downloads.
      for (const [key, entry] of this.entries) {
        if (key !== source.preview && entry.pending) { entry.cancel(); this.entries.delete(key) }
      }
    }
    const known = this.entries.get(source.preview)
    if (known) {
      this.entries.delete(source.preview); this.entries.set(source.preview, known)
      if (priority === "high") { known.requested = true; known.image.fetchPriority = "high" }
      return known.promise
    }
    const image = new Image()
    image.decoding = "async"; image.fetchPriority = priority
    let resolve!: (photo: LoadedPhoto) => void, reject!: (error: unknown) => void, originalAttempted = false
    const promise = new Promise<LoadedPhoto>((done, fail) => { resolve = done; reject = fail })
    const detach = () => { image.onload = null; image.onerror = null }
    const entry: Entry = { promise, image, requested: priority === "high", pending: true, cancel: () => {
      if (!entry.pending) return
      entry.pending = false; detach(); image.removeAttribute("src")
      reject(new DOMException("A newer photograph was selected", "AbortError"))
    } }
    const fail = (error: unknown) => {
      if (!entry.pending) return
      // Never download a full original as speculative prefetch fallback.
      if (entry.requested && !originalAttempted && source.preview !== source.original) {
        originalAttempted = true; image.src = source.original; return
      }
      entry.pending = false; detach()
      if (this.entries.get(source.preview) === entry) this.entries.delete(source.preview)
      reject(error)
    }
    image.onload = () => {
      image.decode().then(() => {
        if (!entry.pending) return
        entry.pending = false; detach()
        resolve({ src: image.src, original: source.original, width: image.naturalWidth, height: image.naturalHeight, element: image })
      }, fail)
    }
    image.onerror = () => fail(new Error("Photograph unavailable"))
    this.entries.set(source.preview, entry)
    while (this.entries.size > 5) {
      const oldest = this.entries.keys().next().value as string
      this.entries.get(oldest)?.cancel(); this.entries.delete(oldest)
    }
    image.src = source.preview
    return promise
  }

  clear() {
    this.entries.forEach(entry => entry.cancel())
    this.entries.clear()
  }
}
