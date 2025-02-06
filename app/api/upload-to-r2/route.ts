import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3 client configuration using env variables
const s3 = new S3Client({
  endpoint: process.env.R2_ENDPOINT_URL,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

export async function POST(request: NextRequest) {
  try {
    const { objectName, contentType } = await request.json();
    if (!objectName) {
      return NextResponse.json({ error: "Missing objectName" }, { status: 400 });
    }

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectName,
      ContentType: contentType || "application/octet-stream",
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return NextResponse.json({ uploadUrl: signedUrl });
  } catch (error) {
    return NextResponse.json({ error: `❌ Failed to create signed URL: ${error}` }, { status: 500 });
  }
}
