import { NextRequest, NextResponse } from "next/server"
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3"
export const runtime = 'nodejs'

const s3 = new S3Client({
  endpoint: process.env.R2_ENDPOINT_URL,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
})

export async function POST(req: NextRequest) {
  try {
    const { objectKey } = await req.json()
    if (!objectKey) return NextResponse.json({ error: "Missing objectKey" }, { status: 400 })

    const cmd = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
    })
    await s3.send(cmd)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
