import { NO_STORE_HEADERS } from "@/lib/http/headers"
import { createEndpoint } from "@/lib/webhooks/repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const response = await createEndpoint()

  return Response.json(response, { headers: NO_STORE_HEADERS })
}
