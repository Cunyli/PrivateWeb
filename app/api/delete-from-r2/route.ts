import { NextResponse } from "next/server"

// This is a simple API route to delete files from R2 storage
export async function POST(request: Request) {
  try {
    const { objectKey } = await request.json()

    if (!objectKey) {
      return NextResponse.json({ error: "Object key is required" }, { status: 400 })
    }

    // Get R2 credentials from environment variables
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    const bucketName = process.env.R2_BUCKET_NAME

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.error("Missing R2 credentials")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Create the S3 API endpoint URL for Cloudflare R2
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`

    // Create the date string for the AWS Signature
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "")
    const dateStamp = date.substring(0, 8)
    const regionName = "auto"
    const serviceName = "s3"

    // Create the canonical request
    const method = "DELETE"
    const canonicalUri = `/${objectKey}`
    const canonicalQueryString = ""
    const canonicalHeaders = `host:${accountId}.r2.cloudflarestorage.com\nx-amz-date:${date}\n`
    const signedHeaders = "host;x-amz-date"
    const payloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" // SHA-256 hash of empty string

    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`

    // Create the string to sign
    const algorithm = "AWS4-HMAC-SHA256"
    const credentialScope = `${dateStamp}/${regionName}/${serviceName}/aws4_request`
    const stringToSign = `${algorithm}\n${date}\n${credentialScope}\n${await sha256(canonicalRequest)}`

    // Calculate the signature
    const signingKey = await getSignatureKey(secretAccessKey, dateStamp, regionName, serviceName)
    const signature = await hmacSha256(signingKey, stringToSign)

    // Create the authorization header
    const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    // Make the DELETE request to R2
    const response = await fetch(`${endpoint}/${objectKey}`, {
      method: "DELETE",
      headers: {
        "X-Amz-Date": date,
        Authorization: authorizationHeader,
      },
    })

    if (!response.ok) {
      console.error("Failed to delete object from R2:", await response.text())
      return NextResponse.json({ error: "Failed to delete object from R2" }, { status: response.status })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting from R2:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Helper functions for AWS Signature Version 4
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function hmacSha256(key: ArrayBuffer, message: string): Promise<string> {
  const keyObj = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"])
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.sign("HMAC", keyObj, msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  regionName: string,
  serviceName: string,
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256Buf(new TextEncoder().encode(`AWS4${key}`), dateStamp)
  const kRegion = await hmacSha256Buf(kDate, regionName)
  const kService = await hmacSha256Buf(kRegion, serviceName)
  const kSigning = await hmacSha256Buf(kService, "aws4_request")
  return kSigning
}

async function hmacSha256Buf(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const keyObj = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"])
  const msgBuffer = new TextEncoder().encode(message)
  return await crypto.subtle.sign("HMAC", keyObj, msgBuffer)
}
