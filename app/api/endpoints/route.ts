import { NO_STORE_HEADERS } from "@/lib/http/headers"
import { checkEndpointCreateAdmission } from "@/lib/webhooks/admission-control"
import { createEndpoint } from "@/lib/webhooks/repository"
import { createRateLimitedResponse } from "@/lib/rate-limits/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const admission = await checkEndpointCreateAdmission(request)

  if (admission.kind === "denied") {
    return createRateLimitedResponse({
      headers: NO_STORE_HEADERS,
      rateLimit: admission.rateLimit,
    })
  }

  const response = await createEndpoint({
    creatorKeyHash: admission.clientIdentity.keyHash,
  })

  return Response.json(response, { headers: NO_STORE_HEADERS })
}
