import { NO_STORE_HEADERS } from "@/lib/http/headers"
import type { InboxResponseConfigResponse } from "@/lib/webhooks/api-contracts"
import {
  InboxResponseValidationError,
  MAX_RESPONSE_OVERRIDE_REQUEST_BYTES,
  parseInboxResponseOverrideInput,
} from "@/lib/webhooks/inbox-response"
import {
  clearInboxResponseOverride,
  getInboxResponseConfig,
  setInboxResponseOverride,
} from "@/lib/webhooks/repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body is too large.")
    this.name = "RequestBodyTooLargeError"
  }
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/inboxes/[token]/response">
) {
  const { token } = await context.params
  const response = {
    token,
    response: await getInboxResponseConfig(token),
  } satisfies InboxResponseConfigResponse

  return Response.json(response, { headers: NO_STORE_HEADERS })
}

export async function PUT(
  request: Request,
  context: RouteContext<"/api/inboxes/[token]/response">
) {
  const { token } = await context.params

  let body: unknown

  try {
    body = JSON.parse(await readJsonBody(request))
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json(
        {
          ok: false,
          error: "Request body too large.",
          maxBodyBytes: MAX_RESPONSE_OVERRIDE_REQUEST_BYTES,
        },
        { headers: NO_STORE_HEADERS, status: 413 }
      )
    }

    return Response.json(
      {
        ok: false,
        error: "Request body must be valid JSON.",
      },
      { headers: NO_STORE_HEADERS, status: 400 }
    )
  }

  try {
    const override = parseInboxResponseOverrideInput(body)
    const response = {
      token,
      response: await setInboxResponseOverride({ token, override }),
    } satisfies InboxResponseConfigResponse

    return Response.json(response, { headers: NO_STORE_HEADERS })
  } catch (error) {
    if (error instanceof InboxResponseValidationError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
          issues: error.issues,
        },
        { headers: NO_STORE_HEADERS, status: 400 }
      )
    }

    throw error
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/inboxes/[token]/response">
) {
  const { token } = await context.params
  const response = {
    token,
    response: await clearInboxResponseOverride(token),
  } satisfies InboxResponseConfigResponse

  return Response.json(response, { headers: NO_STORE_HEADERS })
}

async function readJsonBody(request: Request) {
  const contentLength = request.headers.get("content-length")
  const contentLengthBytes = contentLength ? Number(contentLength) : 0

  if (
    Number.isFinite(contentLengthBytes) &&
    contentLengthBytes > MAX_RESPONSE_OVERRIDE_REQUEST_BYTES
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

    if (size > MAX_RESPONSE_OVERRIDE_REQUEST_BYTES) {
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
