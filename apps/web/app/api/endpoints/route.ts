import {
  getEndpointAccessActor,
  requireEndpointUserId,
} from "@/lib/auth/endpoint-access"
import { AuthenticationRequiredError } from "@/lib/auth/session"
import type { EndpointsResponse } from "@webhooks-lol/webhooks-core/api-contracts"
import { NO_STORE_HEADERS } from "@webhooks-lol/webhooks-server/http/headers"
import {
  createMissingClientIdentityHeaderResponse,
  createRateLimitedResponse,
  isMissingClientIdentityHeaderError,
} from "@webhooks-lol/webhooks-server/rate-limits/http"
import { checkEndpointCreateAdmission } from "@webhooks-lol/webhooks-server/admission-control"
import {
  createEndpoint,
  listEndpointsForUser,
} from "@webhooks-lol/webhooks-server/repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  let userId: string

  try {
    userId = await requireEndpointUserId()
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json(
        { ok: false, error: "Authentication is required." },
        { headers: NO_STORE_HEADERS, status: 401 }
      )
    }

    throw error
  }

  const response = {
    endpoints: await listEndpointsForUser(userId),
  } satisfies EndpointsResponse

  return Response.json(response, { headers: NO_STORE_HEADERS })
}

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

  const actor = await getEndpointAccessActor(request)
  const response = await createEndpoint({
    creatorKeyHash: admission.clientIdentity.keyHash,
    ownerUserId: actor.userId,
  })

  return Response.json(response, { headers: NO_STORE_HEADERS })
}
