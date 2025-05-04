/**
 * Helper functions for R2 storage operations
 */

// Extract the object key from an R2 URL
export function getObjectKeyFromUrl(url: string): string | null {
  try {
    if (!url) return null

    // Parse the URL to extract the pathname
    const parsedUrl = new URL(url)

    // For R2 URLs, the object key is the pathname without the leading slash
    // Example: https://pub-aa03052e73cc405b9b70dc0fc8aeb455.r2.dev/picture/cover-123456.webp
    // Object key would be: picture/cover-123456.webp
    let objectKey = parsedUrl.pathname

    // Remove the leading slash if present
    if (objectKey.startsWith("/")) {
      objectKey = objectKey.substring(1)
    }

    console.log(`Extracted object key "${objectKey}" from URL: ${url}`)
    return objectKey
  } catch (error) {
    console.error(`Error extracting object key from URL (${url}):`, error)
    return null
  }
}

// Delete a file from R2 storage
export async function deleteFileFromR2(url: string): Promise<boolean> {
  try {
    if (!url) {
      console.warn("Empty URL provided to deleteFileFromR2")
      return false
    }

    const objectKey = getObjectKeyFromUrl(url)
    if (!objectKey) {
      console.error("Failed to extract object key from URL:", url)
      return false
    }

    console.log(`Sending delete request for object key: ${objectKey}`)

    const response = await fetch("/api/delete-from-r2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ objectKey }),
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error(`Failed to delete file from R2 (status ${response.status}):`, responseData)
      return false
    }

    console.log(`Successfully deleted file from R2: ${objectKey}`, responseData)
    return true
  } catch (error) {
    console.error(`Error in deleteFileFromR2 for URL (${url}):`, error)
    return false
  }
}
