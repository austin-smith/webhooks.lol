import { isUuid } from "@/lib/webhooks/id-format"

export function parseEndpointId(value: string) {
  return isEndpointId(value) ? value.toLowerCase() : null
}

export function isEndpointId(value: string) {
  return isUuid(value)
}

export function encodeEndpointId(endpointId: string) {
  return encodeURIComponent(endpointId)
}
