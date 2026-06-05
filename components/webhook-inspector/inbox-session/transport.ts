import type {
  CapturedRequest,
  CreateInboxResponse,
  RequestsResponse,
} from "@/lib/webhook-types"

export type InboxTransport = {
  clearInbox: (token: string) => Promise<void>
  createInbox: () => Promise<string>
  loadRequests: (token: string) => Promise<CapturedRequest[]>
}

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

export function createFetchInboxTransport(
  fetcher: Fetcher = (...args) => fetch(...args)
): InboxTransport {
  return {
    async clearInbox(token) {
      const response = await fetcher(`/api/inboxes/${token}/requests`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Could not clear inbox.")
      }
    },
    async createInbox() {
      const response = await fetcher("/api/inboxes", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Could not create inbox.")
      }

      const data = (await response.json()) as CreateInboxResponse

      return data.token
    },
    async loadRequests(token) {
      const response = await fetcher(`/api/inboxes/${token}/requests`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Could not load requests.")
      }

      const data = (await response.json()) as RequestsResponse

      return data.requests
    },
  }
}
