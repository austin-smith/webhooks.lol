import { NO_STORE_HEADERS } from "@webhooks-lol/webhooks-server/http/headers"
import {
  createMissingClientIdentityHeaderResponse,
  createRateLimitedResponse,
  isMissingClientIdentityHeaderError,
} from "@webhooks-lol/webhooks-server/rate-limits/http"
import { checkEndpointCreateAdmission } from "@webhooks-lol/webhooks-server/admission-control"
import { createEndpoint } from "@webhooks-lol/webhooks-server/repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let admission: Awaited<ReturnType<typeof checkEndpointCreateAdmission>>

  try {
    admission = await checkEndpointCreateAdmission(request)
  } catch (error) {
    if (isMissingClientIdentityHeaderError(error)) {
      return createMissingClientIdentityHeaderResponse({
        error,
        headers: NO_STORE_HEADERS,
      })
    }

    throw error
  }

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
