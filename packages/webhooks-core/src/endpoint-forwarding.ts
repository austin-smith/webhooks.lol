export type EndpointForwardPathMode = "strip" | "preserve"

export type EndpointForwardDeliveryStatus =
  | "pending"
  | "delivered"
  | "failed"
  | "cancelled"

export type EndpointForwardTarget = {
  id: string
  endpointId: string
  url: string
  pathMode: EndpointForwardPathMode
  enabled: boolean
  deleted: boolean
  createdAt: string
  updatedAt: string
}

export type EndpointForwardDelivery = {
  id: string
  endpointId: string
  targetId: string
  requestId: string
  targetUrl: string
  targetPathMode: EndpointForwardPathMode
  status: EndpointForwardDeliveryStatus
  attempts: number
  lastStatus: number | null
  lastError: string | null
  deliveredAt: string | null
  createdAt: string
  updatedAt: string
}
