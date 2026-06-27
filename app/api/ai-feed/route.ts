import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { NextResponse } from "next/server"
import { requireAdminRequest } from "@/utils/admin-auth.server"

const feedDir = join(process.cwd(), "data", "ai-intel-feed")

async function readJsonFile(path: string, fallback: unknown) {
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch (error: any) {
    if (error?.code === "ENOENT") return fallback
    throw error
  }
}

export async function GET(request: Request) {
  const auth = await requireAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const [feed, sharedState] = await Promise.all([
    readJsonFile(join(feedDir, "feed-input.json"), { date: "", blocks: [] }),
    readJsonFile(join(feedDir, "shared-state.json"), { state: {}, exposurePool: {}, pinned: {} }),
  ])

  return NextResponse.json({ feed, sharedState })
}
