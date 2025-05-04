import { NextResponse } from "next/server"
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3"

export async function POST(request: Request) {
  try {
    const { objectKey } = await request.json()

    if (!objectKey) {
      console.error("Missing objectKey in request")
      return NextResponse.json({ error: "Object key is required" }, { status: 400 })
    }

    // Get R2 credentials from environment variables
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    const bucketName = process.env.R2_BUCKET_NAME
    const endpoint = process.env.R2_ENDPOINT_URL || `https://${accountId}.r2.cloudflarestorage.com`

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.error("Missing R2 credentials")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    console.log(`Attempting to delete object: ${objectKey} from bucket: ${bucketName}`)

    // Create S3 client for R2
    const s3Client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })

    // Create delete command
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    })

    // Execute delete command
    const response = await s3Client.send(deleteCommand)
    console.log("Delete response:", response)

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${objectKey}`,
    })
  } catch (error) {
    console.error("Error deleting from R2:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
