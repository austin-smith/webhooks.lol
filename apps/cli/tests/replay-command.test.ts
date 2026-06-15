import { beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  getRequest: vi.fn(),
  listRequests: vi.fn(),
  replayRequest: vi.fn(),
}))
const deliver = vi.hoisted(() => ({
  deliverWithRetry: vi.fn(),
}))

vi.mock("../src/core/api-client.js", () => api)
vi.mock("../src/core/deliver.js", () => deliver)

import { CliError } from "../src/cli-error.js"
import { runReplay } from "../src/commands/replay.js"
import type { DeliveryResult } from "../src/core/deliver.js"
import type { RequestFilter } from "../src/core/filter.js"
import type { PathMode } from "../src/core/request-shape.js"
import type { CapturedRequest } from "../src/core/types.js"
import type { Printer } from "../src/ui/printer.js"

const endpointId = "11111111-1111-4111-8111-111111111111"
const requestId = "22222222-2222-4222-8222-222222222222"
const replayedRequestId = "33333333-3333-4333-8333-333333333333"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("runReplay", () => {
  it("replays a stored request through the server when --to is omitted", async () => {
    const request = createRequest()
    const replayedRequest = { ...request, id: replayedRequestId }
    api.getRequest.mockResolvedValueOnce(request)
    api.replayRequest.mockResolvedValueOnce({
      endpointId,
      originalRequestId: requestId,
      request: replayedRequest,
    })

    const info = vi.fn()
    const printer = createPrinter({ info })
    await runReplay({
      ...baseOptions(),
      printer,
    })

    expect(api.replayRequest).toHaveBeenCalledWith(
      "https://hooks.example.com",
      endpointId,
      requestId,
      expect.any(AbortSignal)
    )
    expect(info).toHaveBeenCalledWith(
      `POST /hook replayed as ${replayedRequestId}`
    )
  })

  it("rejects --path for server replay", async () => {
    await expect(
      runReplay({
        ...baseOptions(),
        pathModeWasProvided: true,
      })
    ).rejects.toThrow(CliError)

    expect(api.getRequest).not.toHaveBeenCalled()
    expect(api.replayRequest).not.toHaveBeenCalled()
  })

  it("rejects --timeout for server replay", async () => {
    await expect(
      runReplay({
        ...baseOptions(),
        timeoutWasProvided: true,
      })
    ).rejects.toThrow(CliError)

    expect(api.getRequest).not.toHaveBeenCalled()
    expect(api.replayRequest).not.toHaveBeenCalled()
  })

  it("rejects --retries for server replay", async () => {
    await expect(
      runReplay({
        ...baseOptions(),
        retriesWasProvided: true,
      })
    ).rejects.toThrow(CliError)

    expect(api.getRequest).not.toHaveBeenCalled()
    expect(api.replayRequest).not.toHaveBeenCalled()
  })

  it("uses the configured retry count for local replay", async () => {
    const request = createRequest()
    const delivery = vi.fn()
    const printer = createPrinter({ delivery })
    const result = {
      attempts: 4,
      durationMs: 12,
      outcome: "responded",
      status: 204,
    } satisfies DeliveryResult
    api.getRequest.mockResolvedValueOnce(request)
    deliver.deliverWithRetry.mockResolvedValueOnce(result)

    await runReplay({
      ...baseOptions(),
      localTarget: "http://localhost:3000/hook",
      maxRetries: 3,
      printer,
    })

    const [deliveryOptions] = deliver.deliverWithRetry.mock.calls[0] as [
      {
        maxRetries: number
        onRetry?: unknown
        pathMode: PathMode
        request: CapturedRequest
        signal: AbortSignal
        target: string
        timeoutMs: number
      },
    ]

    expect(deliveryOptions).toMatchObject({
      maxRetries: 3,
      pathMode: "preserve",
      request,
      target: "http://localhost:3000/hook",
      timeoutMs: 30_000,
    })
    expect(deliveryOptions.onRetry).toBeTypeOf("function")
    expect(deliveryOptions.signal).toBeInstanceOf(AbortSignal)
    expect(delivery).toHaveBeenCalledWith(request, result)
  })
})

function baseOptions() {
  return {
    baseUrl: "https://hooks.example.com",
    endpointId,
    filter: { grep: null, methods: [] } satisfies RequestFilter,
    json: false,
    localTarget: null,
    pathMode: "preserve" as const,
    pathModeWasProvided: false,
    printer: createPrinter(),
    requestId,
    signal: new AbortController().signal,
    timeoutMs: 30_000,
    timeoutWasProvided: false,
    maxRetries: 5,
    retriesWasProvided: false,
  }
}

function createPrinter(overrides: Partial<Printer> = {}): Printer {
  return {
    banner: vi.fn(),
    capture: vi.fn(),
    delivery: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    json: vi.fn(),
    warn: vi.fn(),
    ...overrides,
  }
}

function createRequest(): CapturedRequest {
  return {
    bodyBase64: "",
    bodySize: 0,
    bodyText: "",
    contentType: null,
    endpointId,
    headers: {},
    id: requestId,
    ip: null,
    method: "POST",
    path: "/hook",
    query: {},
    receivedAt: "2026-06-13T12:00:00.000Z",
    url: "/hook",
  }
}
