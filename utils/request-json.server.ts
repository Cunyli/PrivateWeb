export class RequestBodyError extends Error {
  constructor(public status: number) { super(status === 413 ? "Request is too large" : "Invalid JSON request") }
}

export async function readJsonObject(request: Request, maxBytes = 16384): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new RequestBodyError(415)
  const length = Number(request.headers.get("content-length"))
  if (Number.isFinite(length) && length > maxBytes) throw new RequestBodyError(413)
  if (!request.body) throw new RequestBodyError(400)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const next = await reader.read()
    if (next.done) break
    size += next.value.byteLength
    if (size > maxBytes) { await reader.cancel(); throw new RequestBodyError(413) }
    chunks.push(next.value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  let value: unknown
  try { value = JSON.parse(new TextDecoder().decode(bytes)) }
  catch (error) { if (error instanceof SyntaxError) throw new RequestBodyError(400); throw error }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestBodyError(400)
  return value as Record<string, unknown>
}
