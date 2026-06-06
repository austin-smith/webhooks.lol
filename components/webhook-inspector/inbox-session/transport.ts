import type { CapturedRequest } from "@/lib/webhooks/types"
import type {
  CreateInboxResponse,
  InboxResponseConfigResponse,
  RequestsResponse,
  UpdateInboxResponseOverrideRequest,
} from "@/lib/webhooks/api-contracts"
import type { InboxResponseConfig } from "@/lib/webhooks/inbox-response"

export type InboxTransport = {
  clearInboxResponseOverride: (token: string) => Promise<InboxResponseConfig>
  clearInbox: (token: string) => Promise<void>
  createInbox: () => Promise<string>
  loadInboxResponseConfig: (token: string) => Promise<InboxResponseConfig>
  loadRequests: (token: string) => Promise<CapturedRequest[]>
  saveInboxResponseOverride: (
    token: string,
    override: UpdateInboxResponseOverrideRequest
  ) => Promise<InboxResponseConfig>
}

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

export function createFetchInboxTransport(
  fetcher: Fetcher = (...args) => fetch(...args)
): InboxTransport {
  return {
    async clearInboxResponseOverride(token) {
      const response = await fetcher(`/api/inboxes/${token}/response`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Could not reset response override.")
      }

      const data = (await response.json()) as InboxResponseConfigResponse

      return data.response
    },
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
    async loadInboxResponseConfig(token) {
      const response = await fetcher(`/api/inboxes/${token}/response`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Could not load response override.")
      }

      const data = (await response.json()) as InboxResponseConfigResponse

      return data.response
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
    async saveInboxResponseOverride(token, override) {
      const response = await fetcher(`/api/inboxes/${token}/response`, {
        body: JSON.stringify(override),
        headers: {
          "content-type": "application/json",
        },
        method: "PUT",
      })

      if (!response.ok) {
        throw new Error("Could not save response override.")
      }

      const data = (await response.json()) as InboxResponseConfigResponse

      return data.response
    },
  }
}
