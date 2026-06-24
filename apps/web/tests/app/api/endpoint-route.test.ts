import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  assertEndpointAccessibleToActor,
  checkEndpointCreateAdmission,
  createEndpoint,
  getEndpointAccessActor,
  getEndpointAccountStatus,
  getEndpoint,
  getEndpointForActor,
  listEndpointsForUser,
  publishEndpointAccessRevoked,
  requireEndpointUserId,
  saveEndpointToAccount,
  updateEndpointName,
} = vi.hoisted(() => ({
  assertEndpointAccessibleToActor: vi.fn(),
  checkEndpointCreateAdmission: vi.fn(),
  createEndpoint: vi.fn(),
  getEndpointAccessActor: vi.fn(),
  getEndpointAccountStatus: vi.fn(),
  getEndpoint: vi.fn(),
  getEndpointForActor: vi.fn(),
  listEndpointsForUser: vi.fn(),
  publishEndpointAccessRevoked: vi.fn(),
  requireEndpointUserId: vi.fn(),
  saveEndpointToAccount: vi.fn(),
  updateEndpointName: vi.fn(),
}))

vi.mock("@webhooks-lol/webhooks-server/admission-control", () => ({
  checkEndpointCreateAdmission,
}))

vi.mock("@webhooks-lol/webhooks-server/endpoint-event-stream", () => ({
  publishEndpointAccessRevoked,
}))

vi.mock("@webhooks-lol/webhooks-server/repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@webhooks-lol/webhooks-server/repository")
  >()),
  assertEndpointAccessibleToActor,
  createEndpoint,
  getEndpointAccountStatus,
  getEndpoint,
  getEndpointForActor,
  listEndpointsForUser,
  saveEndpointToAccount,
  updateEndpointName,
}))

vi.mock("@/lib/auth/endpoint-access", () => ({
  getEndpointAccessActor,
  requireEndpointUserId,
}))

import { GET as LIST_ENDPOINTS, POST } from "@/app/api/endpoints/route"
import {
  GET as GET_ENDPOINT_ACCOUNT_STATUS,
  POST as SAVE_ENDPOINT_TO_ACCOUNT,
} from "@/app/api/endpoints/[endpointId]/account/route"
import {
  GET,
  MAX_ENDPOINT_METADATA_REQUEST_BYTES,
  PATCH,
} from "@/app/api/endpoints/[endpointId]/route"
import { AuthenticationRequiredError } from "@/lib/auth/session"
import { MissingClientIdentityHeaderError } from "@webhooks-lol/webhooks-server/rate-limits/client-identity"
import { EndpointNotFoundError } from "@webhooks-lol/webhooks-server/repository"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"
const NEW_ENDPOINT_ID = "22222222-2222-4222-8222-222222222222"
const ANONYMOUS_SESSION_ID = "33333333-3333-4333-8333-333333333333"

function createAllowedAdmission() {
  return {
    kind: "allowed" as const,
    clientIdentity: {
      key: "client:test",
      keyHash: "client-hash",
      source: "trusted-header" as const,
    },
  }
}

function createDeniedAdmission() {
  return {
    kind: "denied" as const,
    rateLimit: {
      limit: 1,
      policyId: "endpoint-create-client",
      remaining: 0,
      resetSeconds: 60,
      retryAfterSeconds: 60,
      windowSeconds: 60,
    },
  }
}

function createContext(endpointId = ENDPOINT_ID) {
  return {
    params: Promise.resolve({ endpointId }),
  } as RouteContext<"/api/endpoints/[endpointId]">
}

function createAccountContext(endpointId = ENDPOINT_ID) {
  return {
    params: Promise.resolve({ endpointId }),
  } as RouteContext<"/api/endpoints/[endpointId]/account">
}

describe("endpoint route", () => {
  beforeEach(() => {
    checkEndpointCreateAdmission.mockReset()
    checkEndpointCreateAdmission.mockResolvedValue(createAllowedAdmission())
    assertEndpointAccessibleToActor.mockReset()
    createEndpoint.mockReset()
    getEndpointAccessActor.mockReset()
    getEndpointAccessActor.mockResolvedValue({ userId: null })
    getEndpointAccountStatus.mockReset()
    getEndpoint.mockReset()
    getEndpointForActor.mockReset()
    listEndpointsForUser.mockReset()
    publishEndpointAccessRevoked.mockReset()
    requireEndpointUserId.mockReset()
    requireEndpointUserId.mockResolvedValue("user-1")
    saveEndpointToAccount.mockReset()
    updateEndpointName.mockReset()
  })

  it("creates an endpoint with persisted metadata shape", async () => {
    createEndpoint.mockResolvedValueOnce({
      endpointId: NEW_ENDPOINT_ID,
      name: null,
    })

    const response = await POST(
      new Request("https://hooks.example.com/api/endpoints", {
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toContain(
      `webhooks_lol_endpoint_session=`
    )
    await expect(response.json()).resolves.toEqual({
      endpointId: NEW_ENDPOINT_ID,
      name: null,
    })
    expect(createEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        anonymousSessionId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        ),
        creatorKeyHash: "client-hash",
        ownerUserId: null,
      })
    )
  })

  it("reuses the anonymous endpoint session cookie when creating endpoints", async () => {
    createEndpoint.mockResolvedValueOnce({
      endpointId: NEW_ENDPOINT_ID,
      name: null,
    })

    const response = await POST(
      new Request("https://hooks.example.com/api/endpoints", {
        headers: {
          cookie: `webhooks_lol_endpoint_session=${ANONYMOUS_SESSION_ID}`,
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toBeNull()
    expect(createEndpoint).toHaveBeenCalledWith({
      anonymousSessionId: ANONYMOUS_SESSION_ID,
      creatorKeyHash: "client-hash",
      ownerUserId: null,
    })
  })

  it("creates signed-in endpoints for the current user", async () => {
    getEndpointAccessActor.mockResolvedValueOnce({ userId: "user-1" })
    createEndpoint.mockResolvedValueOnce({
      endpointId: NEW_ENDPOINT_ID,
      name: null,
    })

    const response = await POST(
      new Request("https://hooks.example.com/api/endpoints", {
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    expect(createEndpoint).toHaveBeenCalledWith({
      anonymousSessionId: null,
      creatorKeyHash: "client-hash",
      ownerUserId: "user-1",
    })
  })

  it("lists endpoints for the signed-in user", async () => {
    listEndpointsForUser.mockResolvedValueOnce([
      {
        endpointId: ENDPOINT_ID,
        name: "Stripe",
      },
    ])

    const response = await LIST_ENDPOINTS()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpoints: [
        {
          endpointId: ENDPOINT_ID,
          name: "Stripe",
        },
      ],
    })
    expect(listEndpointsForUser).toHaveBeenCalledWith("user-1")
  })

  it("requires authentication before listing account endpoints", async () => {
    requireEndpointUserId.mockRejectedValueOnce(
      new AuthenticationRequiredError()
    )

    const response = await LIST_ENDPOINTS()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Authentication is required.",
    })
    expect(listEndpointsForUser).not.toHaveBeenCalled()
  })

  it("rejects endpoint creation when the create policy is exhausted", async () => {
    checkEndpointCreateAdmission.mockResolvedValueOnce(createDeniedAdmission())

    const response = await POST(
      new Request("https://hooks.example.com/api/endpoints", {
        method: "POST",
      })
    )

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("60")
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Rate limit exceeded.",
      retryAfterSeconds: 60,
    })
    expect(createEndpoint).not.toHaveBeenCalled()
  })

  it("rejects endpoint creation when the client identity header is missing", async () => {
    checkEndpointCreateAdmission.mockRejectedValueOnce(
      new MissingClientIdentityHeaderError("x-forwarded-for")
    )

    const response = await POST(
      new Request("https://hooks.example.com/api/endpoints", {
        method: "POST",
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Required client identity header "x-forwarded-for" is missing.',
    })
    expect(createEndpoint).not.toHaveBeenCalled()
  })

  it("returns endpoint metadata", async () => {
    getEndpointForActor.mockResolvedValueOnce({
      endpointId: ENDPOINT_ID,
      name: "Stripe",
    })

    const response = await GET(
      new Request(`https://hooks.example.com/api/endpoints/${ENDPOINT_ID}`),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpointId: ENDPOINT_ID,
      name: "Stripe",
    })
    expect(getEndpointForActor).toHaveBeenCalledWith(ENDPOINT_ID, {
      userId: null,
    })
  })

  it("rejects malformed endpoint IDs before querying", async () => {
    const response = await GET(
      new Request("https://hooks.example.com/api/endpoints/not-an-id"),
      createContext("not-an-id")
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Invalid endpoint ID.",
    })
    expect(getEndpointForActor).not.toHaveBeenCalled()
  })

  it("updates endpoint names", async () => {
    updateEndpointName.mockResolvedValueOnce({
      endpointId: ENDPOINT_ID,
      name: "Payments",
    })

    const response = await PATCH(
      new Request(`https://hooks.example.com/api/endpoints/${ENDPOINT_ID}`, {
        body: JSON.stringify({ name: " Payments " }),
        method: "PATCH",
      }),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpointId: ENDPOINT_ID,
      name: "Payments",
    })
    expect(updateEndpointName).toHaveBeenCalledWith({
      endpointId: ENDPOINT_ID,
      name: "Payments",
    })
  })

  it("clears blank endpoint names", async () => {
    updateEndpointName.mockResolvedValueOnce({
      endpointId: ENDPOINT_ID,
      name: null,
    })

    const response = await PATCH(
      new Request(`https://hooks.example.com/api/endpoints/${ENDPOINT_ID}`, {
        body: JSON.stringify({ name: " " }),
        method: "PATCH",
      }),
      createContext()
    )

    expect(response.status).toBe(200)
    expect(updateEndpointName).toHaveBeenCalledWith({
      endpointId: ENDPOINT_ID,
      name: null,
    })
  })

  it("rejects invalid endpoint names", async () => {
    const response = await PATCH(
      new Request(`https://hooks.example.com/api/endpoints/${ENDPOINT_ID}`, {
        body: JSON.stringify({ name: "x".repeat(33) }),
        method: "PATCH",
      }),
      createContext()
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Endpoint name must be 32 characters or fewer.",
    })
    expect(updateEndpointName).not.toHaveBeenCalled()
  })

  it("rejects oversized metadata requests before storing", async () => {
    const response = await PATCH(
      new Request(`https://hooks.example.com/api/endpoints/${ENDPOINT_ID}`, {
        body: "x".repeat(MAX_ENDPOINT_METADATA_REQUEST_BYTES + 1),
        method: "PATCH",
      }),
      createContext()
    )

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Request body too large.",
      maxBodyBytes: MAX_ENDPOINT_METADATA_REQUEST_BYTES,
    })
    expect(updateEndpointName).not.toHaveBeenCalled()
  })

  it("returns endpoint account status for the current browser session", async () => {
    getEndpointAccountStatus.mockResolvedValueOnce({
      canSaveToAccount: true,
      endpointId: ENDPOINT_ID,
      savedToAccount: false,
    })

    const response = await GET_ENDPOINT_ACCOUNT_STATUS(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/account`,
        {
          headers: {
            cookie: `webhooks_lol_endpoint_session=${ANONYMOUS_SESSION_ID}`,
          },
        }
      ),
      createAccountContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      canSaveToAccount: true,
      endpointId: ENDPOINT_ID,
      savedToAccount: false,
    })
    expect(getEndpointAccountStatus).toHaveBeenCalledWith({
      anonymousSessionId: ANONYMOUS_SESSION_ID,
      endpointId: ENDPOINT_ID,
      userId: null,
    })
  })

  it("saves an endpoint to the signed-in account with the anonymous session cookie", async () => {
    saveEndpointToAccount.mockResolvedValueOnce({
      canSaveToAccount: false,
      endpointId: ENDPOINT_ID,
      savedToAccount: true,
    })

    const response = await SAVE_ENDPOINT_TO_ACCOUNT(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/account`,
        {
          headers: {
            cookie: `webhooks_lol_endpoint_session=${ANONYMOUS_SESSION_ID}`,
          },
          method: "POST",
        }
      ),
      createAccountContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      canSaveToAccount: false,
      endpointId: ENDPOINT_ID,
      savedToAccount: true,
    })
    expect(saveEndpointToAccount).toHaveBeenCalledWith({
      anonymousSessionId: ANONYMOUS_SESSION_ID,
      endpointId: ENDPOINT_ID,
      ownerUserId: "user-1",
    })
    expect(publishEndpointAccessRevoked).toHaveBeenCalledWith(ENDPOINT_ID)
  })

  it("requires authentication before saving an endpoint to an account", async () => {
    requireEndpointUserId.mockRejectedValueOnce(
      new AuthenticationRequiredError()
    )

    const response = await SAVE_ENDPOINT_TO_ACCOUNT(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/account`,
        {
          headers: {
            cookie: `webhooks_lol_endpoint_session=${ANONYMOUS_SESSION_ID}`,
          },
          method: "POST",
        }
      ),
      createAccountContext()
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Authentication is required.",
    })
    expect(saveEndpointToAccount).not.toHaveBeenCalled()
    expect(publishEndpointAccessRevoked).not.toHaveBeenCalled()
  })

  it("requires the anonymous session cookie before saving an endpoint to an account", async () => {
    const response = await SAVE_ENDPOINT_TO_ACCOUNT(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/account`,
        {
          method: "POST",
        }
      ),
      createAccountContext()
    )

    expect(response.status).toBe(404)
    expect(saveEndpointToAccount).not.toHaveBeenCalled()
    expect(publishEndpointAccessRevoked).not.toHaveBeenCalled()
  })

  it("hides endpoint save ownership failures behind the endpoint not found response", async () => {
    saveEndpointToAccount.mockRejectedValueOnce(
      new EndpointNotFoundError(ENDPOINT_ID)
    )

    const response = await SAVE_ENDPOINT_TO_ACCOUNT(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/account`,
        {
          headers: {
            cookie: `webhooks_lol_endpoint_session=${ANONYMOUS_SESSION_ID}`,
          },
          method: "POST",
        }
      ),
      createAccountContext()
    )

    expect(response.status).toBe(404)
    expect(publishEndpointAccessRevoked).not.toHaveBeenCalled()
  })
})
