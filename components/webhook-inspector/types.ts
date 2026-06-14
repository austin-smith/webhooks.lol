import type { CapturedRequest } from "@/lib/webhooks/types"
import type {
  EndpointResponseConfig,
  EndpointResponseOverrideInput,
} from "@/lib/webhooks/endpoint-response"
import type { RequestSearchCriteria } from "@/lib/webhooks/request-search"
import type { EndpointStats } from "./endpoint-session/transport"
import type { EndpointForwardTarget } from "./endpoint-session/transport"

export type ConnectionState = "live" | "connecting" | "offline"
export type EndpointForwardPathMode = EndpointForwardTarget["pathMode"]

export type EndpointActions = {
  clearEndpoint: () => void
  clearResponseOverride: () => Promise<void>
  createForwardTarget: (target: {
    pathMode?: EndpointForwardPathMode
    url: string
  }) => Promise<void>
  deleteForwardTarget: (targetId: string) => Promise<void>
  loadForwardTargets: () => Promise<void>
  loadEndpointStats: () => Promise<EndpointStats | null>
  loadOlderRequests: () => void
  renameEndpoint: (name: string) => void
  refreshEndpoint: () => void
  replayRequest: (requestId: string) => Promise<void>
  saveResponseOverride: (
    override: EndpointResponseOverrideInput
  ) => Promise<void>
  searchRequests: (search: RequestSearchCriteria) => void
  selectRequest: (id: string) => void
  startNewEndpoint: () => void
  switchEndpoint: (endpointId: string) => void
  updateForwardTarget: (
    targetId: string,
    target: {
      enabled?: boolean
      pathMode?: EndpointForwardPathMode
      url?: string
    }
  ) => Promise<void>
}

export type EndpointNames = Record<string, string>

export type EndpointState = {
  canRefresh: boolean
  connectionState: ConnectionState
  errorMessage: string | null
  endpointNames: EndpointNames
  forwardTargets: EndpointForwardTarget[]
  isClearing: boolean
  isLoadingForwardTargets: boolean
  isLoading: boolean
  isLoadingOlderRequests: boolean
  isReplayingSelectedRequest: boolean
  isSavingResponse: boolean
  isSavingForwardTarget: boolean
  hasMoreRequests: boolean
  recentEndpointIds: string[]
  responseConfig: EndpointResponseConfig
  requestSearch: RequestSearchCriteria
  requests: CapturedRequest[]
  selectedRequest: CapturedRequest | null
  endpointId: string | null
}

export type Endpoint = EndpointState & {
  actions: EndpointActions
}
