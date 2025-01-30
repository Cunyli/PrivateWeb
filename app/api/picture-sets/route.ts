import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const data = await request.json()

  // Simulate processing and storing the data
  console.log("Received picture set:", data)

  // Simulate a delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  return NextResponse.json({ success: true, message: "Picture set uploaded successfully" })
}

