import { NO_STORE_HEADERS } from "@/lib/http-headers"
import { createInbox } from "@/lib/webhooks/repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  return Response.json(
    { token: await createInbox() },
    { headers: NO_STORE_HEADERS }
  )
}
