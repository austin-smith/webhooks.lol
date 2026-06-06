export type CapturedRequest = {
  id: string
  token: string
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

export type CapturedRequestInput = Omit<CapturedRequest, "id" | "receivedAt">

export type CreateInboxResponse = {
  token: string
}

export type RequestsResponse = {
  token: string
  requests: CapturedRequest[]
}
