import "server-only"

import type {
  ConnectionLeasePolicy,
  RateLimitPolicy,
} from "@/lib/rate-limits/config"

export const webhookRateLimitPolicies = {
  // Endpoint creation across the whole service.
  // Limit: 360000 creates per 1-hour window; average 100/second.
  endpointCreateGlobal: {
    id: "endpoint-create-global",
    limit: 360000,
    windowSeconds: 60 * 60, // 1 hour
  },
  // Endpoint creation from one client.
  // Limit: 100 creates per 1-hour window; average ~0.03/second.
  endpointCreatePerClient: {
    id: "endpoint-create-client",
    limit: 100,
    windowSeconds: 60 * 60, // 1 hour
  },
  // Captured webhook body bytes for one endpoint.
  // Limit: 1 GiB per 24-hour window.
  webhookCaptureBytesPerEndpoint: {
    id: "webhook-capture-bytes-endpoint",
    limit: 1024 * 1024 * 1024, // 1 GiB
    windowSeconds: 24 * 60 * 60, // 24 hours
  },
  // Captured webhook requests across the whole service.
  // Limit: 60000 requests per 60-second window; average 1000/second.
  webhookCaptureGlobal: {
    id: "webhook-capture-global",
    limit: 60000,
    windowSeconds: 60,
  },
  // Captured webhook requests from one client across all endpoints.
  // Limit: 1200 requests per 60-second window; average 20/second.
  webhookCapturePerClient: {
    id: "webhook-capture-client",
    limit: 1200,
    windowSeconds: 60,
  },
  // Captured webhook requests for one endpoint across all clients.
  // Limit: 600 requests per 60-second window; average 10/second.
  webhookCapturePerEndpoint: {
    id: "webhook-capture-endpoint",
    limit: 600,
    windowSeconds: 60,
  },
  // Server-side request replays across the whole service.
  // Limit: 600 replays per 60-second window; average 10/second.
  requestReplayGlobal: {
    id: "request-replay-global",
    limit: 600,
    windowSeconds: 60,
  },
  // Server-side request replays from one client across all endpoints.
  // Limit: 60 replays per 60-second window; average 1/second.
  requestReplayPerClient: {
    id: "request-replay-client",
    limit: 60,
    windowSeconds: 60,
  },
  // Server-side request replays for one endpoint.
  // Limit: 120 replays per 60-second window; average 2/second.
  requestReplayPerEndpoint: {
    id: "request-replay-endpoint",
    limit: 120,
    windowSeconds: 60,
  },
  // Server-side replays of one stored request.
  // Limit: 60 replays per 60-second window; average 1/second.
  requestReplayPerRequest: {
    id: "request-replay-request",
    limit: 60,
    windowSeconds: 60,
  },
} satisfies Record<string, RateLimitPolicy>

export const webhookEventStreamPolicies = {
  // Open live event streams across the whole service.
  // Concurrent limit: 1000; stale leases expire after 60 seconds.
  globalConnections: {
    id: "event-streams-global",
    limit: 1000,
    leaseSeconds: 60,
  },
  // Open live event streams from one client across all endpoints.
  // Concurrent limit: 10; stale leases expire after 60 seconds.
  perClientConnections: {
    id: "event-streams-client",
    limit: 10,
    leaseSeconds: 60,
  },
  // Open live event streams for one endpoint across all clients.
  // Concurrent limit: 3; stale leases expire after 60 seconds.
  perEndpointConnections: {
    id: "event-streams-endpoint",
    limit: 3,
    leaseSeconds: 60,
  },
} satisfies Record<string, ConnectionLeasePolicy>
