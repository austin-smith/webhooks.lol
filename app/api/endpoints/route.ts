import { NO_STORE_HEADERS } from "@/lib/http/headers"
import type { CreateEndpointResponse } from "@/lib/webhooks/api-contracts"
import { createEndpoint } from "@/lib/webhooks/repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const response = {
    endpointId: await createEndpoint(),
  } satisfies CreateEndpointResponse

  return Response.json(response, { headers: NO_STORE_HEADERS })
}
