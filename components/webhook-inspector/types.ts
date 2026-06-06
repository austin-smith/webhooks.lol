import type { CapturedRequest } from "@/lib/webhooks/types"
import type {
  EndpointResponseConfig,
  EndpointResponseOverrideInput,
} from "@/lib/webhooks/endpoint-response"

export type ConnectionState = "live" | "connecting" | "offline"

export type EndpointActions = {
  clearEndpoint: () => void
  clearResponseOverride: () => Promise<void>
  renameEndpoint: (name: string) => void
  refreshEndpoint: () => void
  saveResponseOverride: (
    override: EndpointResponseOverrideInput
  ) => Promise<void>
  selectRequest: (id: string) => void
  startNewEndpoint: () => void
  switchEndpoint: (endpointId: string) => void
}

export type EndpointNames = Record<string, string>

export type EndpointState = {
  canRefresh: boolean
  connectionState: ConnectionState
  errorMessage: string | null
  endpointNames: EndpointNames
  isClearing: boolean
  isLoading: boolean
  isSavingResponse: boolean
  recentEndpointIds: string[]
  responseConfig: EndpointResponseConfig
  requests: CapturedRequest[]
  selectedRequest: CapturedRequest | null
  endpointId: string | null
}

export type Endpoint = EndpointState & {
  actions: EndpointActions
}
