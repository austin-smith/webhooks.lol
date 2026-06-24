import { describe, expect, it } from "vitest"

import {
  getSignedInStoredEndpointIds,
  resolveSignedInEndpointRestore,
} from "@/components/webhook-inspector/endpoint-session/restore"
import type { StoredEndpointSession } from "@/components/webhook-inspector/endpoint-session/storage"
import type { EndpointMetadata } from "@/components/webhook-inspector/endpoint-session/transport"

const ACCOUNT_ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"
const ACCOUNT_OTHER_ENDPOINT_ID = "22222222-2222-4222-8222-222222222222"
const STORED_ENDPOINT_ID = "33333333-3333-4333-8333-333333333333"
const STORED_OTHER_ENDPOINT_ID = "44444444-4444-4444-8444-444444444444"

function createStoredSession(
  overrides: Partial<StoredEndpointSession> = {}
): StoredEndpointSession {
  return {
    activeEndpointId: null,
    recentEndpointIds: [],
    ...overrides,
  }
}

function createEndpoint(
  endpointId: string,
  name: string | null = null
): EndpointMetadata {
  return {
    endpointId,
    name,
  }
}

describe("signed-in endpoint restore", () => {
  it("loads same-browser stored endpoints that are not already account endpoints", () => {
    expect(
      getSignedInStoredEndpointIds({
        accountEndpointIds: [ACCOUNT_ENDPOINT_ID],
        accountSession: createStoredSession({
          recentEndpointIds: [ACCOUNT_ENDPOINT_ID, STORED_ENDPOINT_ID],
        }),
        anonymousSession: createStoredSession({
          recentEndpointIds: [
            STORED_ENDPOINT_ID,
            STORED_OTHER_ENDPOINT_ID,
            ACCOUNT_ENDPOINT_ID,
          ],
        }),
      })
    ).toEqual([STORED_ENDPOINT_ID, STORED_OTHER_ENDPOINT_ID])
  })

  it("keeps account endpoints and same-browser stored endpoints in the picker", () => {
    expect(
      resolveSignedInEndpointRestore({
        accountEndpoints: [
          createEndpoint(ACCOUNT_ENDPOINT_ID, "Account"),
          createEndpoint(ACCOUNT_OTHER_ENDPOINT_ID, "Other account"),
        ],
        accountSession: createStoredSession({
          activeEndpointId: null,
          recentEndpointIds: [],
        }),
        anonymousSession: createStoredSession({
          activeEndpointId: STORED_ENDPOINT_ID,
          recentEndpointIds: [STORED_ENDPOINT_ID],
        }),
        storedEndpoints: [createEndpoint(STORED_ENDPOINT_ID, "Stored")],
      })
    ).toEqual({
      activeEndpoint: createEndpoint(STORED_ENDPOINT_ID, "Stored"),
      endpointIds: [
        STORED_ENDPOINT_ID,
        ACCOUNT_ENDPOINT_ID,
        ACCOUNT_OTHER_ENDPOINT_ID,
      ],
      metadata: [
        createEndpoint(ACCOUNT_ENDPOINT_ID, "Account"),
        createEndpoint(ACCOUNT_OTHER_ENDPOINT_ID, "Other account"),
        createEndpoint(STORED_ENDPOINT_ID, "Stored"),
      ],
    })
  })

  it("prefers account metadata when an endpoint appears in both sources", () => {
    expect(
      resolveSignedInEndpointRestore({
        accountEndpoints: [createEndpoint(ACCOUNT_ENDPOINT_ID, "Saved")],
        accountSession: createStoredSession({
          activeEndpointId: ACCOUNT_ENDPOINT_ID,
          recentEndpointIds: [ACCOUNT_ENDPOINT_ID],
        }),
        anonymousSession: createStoredSession({
          activeEndpointId: ACCOUNT_ENDPOINT_ID,
          recentEndpointIds: [ACCOUNT_ENDPOINT_ID],
        }),
        storedEndpoints: [createEndpoint(ACCOUNT_ENDPOINT_ID, "Old")],
      })
    ).toEqual({
      activeEndpoint: createEndpoint(ACCOUNT_ENDPOINT_ID, "Saved"),
      endpointIds: [ACCOUNT_ENDPOINT_ID],
      metadata: [createEndpoint(ACCOUNT_ENDPOINT_ID, "Saved")],
    })
  })

  it("prefers a claimed endpoint without dropping other account endpoints", () => {
    expect(
      resolveSignedInEndpointRestore({
        accountEndpoints: [
          createEndpoint(ACCOUNT_ENDPOINT_ID, "Claimed"),
          createEndpoint(ACCOUNT_OTHER_ENDPOINT_ID, "Other account"),
        ],
        accountSession: createStoredSession({
          activeEndpointId: ACCOUNT_OTHER_ENDPOINT_ID,
          recentEndpointIds: [ACCOUNT_OTHER_ENDPOINT_ID],
        }),
        anonymousSession: createStoredSession({
          activeEndpointId: ACCOUNT_ENDPOINT_ID,
          recentEndpointIds: [ACCOUNT_ENDPOINT_ID, STORED_ENDPOINT_ID],
        }),
        preferredActiveEndpointId: ACCOUNT_ENDPOINT_ID,
        storedEndpoints: [createEndpoint(STORED_ENDPOINT_ID, "Stored")],
      })
    ).toEqual({
      activeEndpoint: createEndpoint(ACCOUNT_ENDPOINT_ID, "Claimed"),
      endpointIds: [
        ACCOUNT_ENDPOINT_ID,
        ACCOUNT_OTHER_ENDPOINT_ID,
        STORED_ENDPOINT_ID,
      ],
      metadata: [
        createEndpoint(ACCOUNT_ENDPOINT_ID, "Claimed"),
        createEndpoint(ACCOUNT_OTHER_ENDPOINT_ID, "Other account"),
        createEndpoint(STORED_ENDPOINT_ID, "Stored"),
      ],
    })
  })
})
