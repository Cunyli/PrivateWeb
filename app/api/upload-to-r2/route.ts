import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2Endpoint = process.env.R2_ENDPOINT_URL
const r2Bucket = process.env.R2_BUCKET_NAME
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID
const r2Secret = process.env.R2_SECRET_ACCESS_KEY

// S3 client configuration using env variables
const s3 = new S3Client({
  endpoint: r2Endpoint,
  region: "auto",
  forcePathStyle: true,
  credentials: {
    accessKeyId: r2AccessKeyId || "",
    secretAccessKey: r2Secret || "",
  },
});

export async function POST(request: NextRequest) {
  try {
    if (!r2Endpoint || !r2Bucket || !r2AccessKeyId || !r2Secret) {
      return NextResponse.json(
        { error: "Missing R2 configuration" },
        { status: 500 },
      )
    }

    const { objectName, contentType } = await request.json();
    if (!objectName) {
      return NextResponse.json({ error: "Missing objectName" }, { status: 400 });
    }

    const command = new PutObjectCommand({
      Bucket: r2Bucket,
      Key: objectName,
      ContentType: contentType || "application/octet-stream",
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return NextResponse.json({
      uploadUrl: signedUrl,
      contentType: contentType || "application/octet-stream",
    });
  } catch (error) {
    return NextResponse.json({ error: `❌ Failed to create signed URL: ${error}` }, { status: 500 });
  }
}
