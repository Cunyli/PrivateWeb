import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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
    const { fileData, objectName, contentType } = await request.json();
    if (!fileData || !objectName) {
      return NextResponse.json({ error: "Missing fileData or objectName" }, { status: 400 });
    }
    const buffer = Buffer.from(fileData, "base64");
    // ...existing code...
    const uploadParams = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectName,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    };
    await s3.send(new PutObjectCommand(uploadParams));
    return NextResponse.json({ message: `✅ 上传成功：${objectName}` });
  } catch (error) {
    return NextResponse.json({ error: `❌ 上传失败：${error}` }, { status: 500 });
  }
}
