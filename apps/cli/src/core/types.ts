// Wire shape captured by webhooks.lol and delivered over the SSE event stream
// and the requests API. This mirrors the server's CapturedRequest contract; the
// CLI is an independent HTTP client, so it owns its own copy of the boundary
// type rather than importing server-internal modules.
export interface CapturedRequest {
  id: string
  endpointId: string
  method: string
  url: string
  path: string
  query: Record<string, string[]>
  headers: Record<string, string>
  bodyText: string
  bodyBase64: string
  bodySize: number
  contentType: string | null
  receivedAt: string
  ip: string | null
}

export interface ServerReplayResult {
  endpointId: string
  originalRequestId: string
  request: CapturedRequest
}

export type StreamMessage =
  | { type: "open" }
  | { type: "ready"; endpointId: string; readyAt: string }
  | { type: "request"; request: CapturedRequest }
  | { type: "clear"; endpointId: string }
  | { type: "reconnecting"; attempt: number; delayMs: number; error: unknown }
  | { type: "fatal"; status: number; message: string }
