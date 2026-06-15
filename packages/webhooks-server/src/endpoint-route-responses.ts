import { NO_STORE_HEADERS } from "@webhooks-lol/webhooks-server/http/headers"

export function createInvalidEndpointResponse(
  headers: HeadersInit = NO_STORE_HEADERS
) {
  return Response.json(
    {
      ok: false,
      error: "Invalid endpoint ID.",
    },
    { headers, status: 400 }
  )
}

export function createEndpointNotFoundResponse(
  headers: HeadersInit = NO_STORE_HEADERS
) {
  return Response.json(
    {
      ok: false,
      error: "Endpoint not found.",
    },
    { headers, status: 404 }
  )
}
