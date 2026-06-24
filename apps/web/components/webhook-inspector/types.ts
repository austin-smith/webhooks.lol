import type { CapturedRequest } from "@webhooks-lol/webhooks-core/types"
import type {
  EndpointResponseConfig,
  EndpointResponseOverrideInput,
} from "@webhooks-lol/webhooks-core/endpoint-response"
import type { RequestSearchCriteria } from "@webhooks-lol/webhooks-core/request-search"
import type {
  EndpointAccountStatus,
  EndpointStats,
} from "./endpoint-session/transport"
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
  loadEndpointAccountStatus: (
    endpointId?: string
  ) => Promise<EndpointAccountStatus | null>
  loadForwardTargets: () => Promise<void>
  loadEndpointStats: () => Promise<EndpointStats | null>
  loadOlderRequests: () => void
  renameEndpoint: (name: string) => void
  refreshEndpoint: () => void
  replayRequest: (requestId: string) => Promise<void>
  saveEndpointToAccount: (
    endpointId?: string
  ) => Promise<EndpointAccountStatus | null>
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
  endpointAccountStatuses: Record<string, EndpointAccountStatus>
  forwardTargets: EndpointForwardTarget[]
  isClearing: boolean
  isLoadingForwardTargets: boolean
  isLoading: boolean
  isLoadingOlderRequests: boolean
  isReplayingSelectedRequest: boolean
  isSignedIn: boolean
  isSavingResponse: boolean
  isSavingForwardTarget: boolean
  isSavingEndpointToAccount: boolean
  hasMoreRequests: boolean
  recentEndpointIds: string[]
  responseConfig: EndpointResponseConfig
  requestSearch: RequestSearchCriteria
  requests: CapturedRequest[]
  replayingRequestIds: ReadonlySet<string>
  selectedRequest: CapturedRequest | null
  endpointId: string | null
}

export type Endpoint = EndpointState & {
  actions: EndpointActions
}
