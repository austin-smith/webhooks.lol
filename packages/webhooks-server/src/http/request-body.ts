import "server-only"

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body is too large.")
    this.name = "RequestBodyTooLargeError"
  }
}

export async function readBoundedTextBody(
  request: Request,
  maxBodyBytes: number
) {
  const contentLength = request.headers.get("content-length")
  const contentLengthBytes = contentLength ? Number(contentLength) : 0

  if (
    Number.isFinite(contentLengthBytes) &&
    contentLengthBytes > maxBodyBytes
  ) {
    throw new RequestBodyTooLargeError()
  }

  if (!request.body) {
    return ""
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    size += value.byteLength

    if (size > maxBodyBytes) {
      await reader.cancel()
      throw new RequestBodyTooLargeError()
    }

    chunks.push(value)
  }

  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    size
  ).toString("utf8")
}
