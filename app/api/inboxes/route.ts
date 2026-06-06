import { NO_STORE_HEADERS } from "@/lib/http/headers"
import type { CreateInboxResponse } from "@/lib/webhooks/api-contracts"
import { createInbox } from "@/lib/webhooks/repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const response = {
    token: await createInbox(),
  } satisfies CreateInboxResponse

  return Response.json(response, { headers: NO_STORE_HEADERS })
}
