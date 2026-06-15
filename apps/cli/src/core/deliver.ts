import {
  buildForwardHeaders,
  buildRequestBody,
  buildTargetUrl,
  type PathMode,
} from "./request-shape.js"
import { backoffDelay, sleep } from "./timing.js"
import type { CapturedRequest } from "./types.js"

export interface DeliveryResult {
  // "responded" means the local server returned an HTTP response (any status,
  // including 5xx). "failed" means the request never reached it (connection
  // refused, timeout, DNS, abort).
  outcome: "responded" | "failed"
  status?: number
  durationMs: number
  attempts: number
  error?: Error
}

interface DeliverOptions {
  request: CapturedRequest
  target: string
  pathMode: PathMode
  timeoutMs: number
  signal: AbortSignal
}

export async function deliverRequest(
  options: DeliverOptions
): Promise<DeliveryResult> {
  const { request, target, pathMode, timeoutMs, signal } = options
  const url = buildTargetUrl(target, request, pathMode)
  const headers = buildForwardHeaders(request)
  const body = buildRequestBody(request)

  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal.addEventListener("abort", onAbort, { once: true })
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const start = performance.now()

  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      signal: controller.signal,
    })

    // Drain the body so the socket can be reused or closed promptly.
    await response.arrayBuffer().catch(() => {})

    return {
      outcome: "responded",
      status: response.status,
      durationMs: performance.now() - start,
      attempts: 1,
    }
  } catch (error) {
    return {
      outcome: "failed",
      durationMs: performance.now() - start,
      attempts: 1,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  } finally {
    clearTimeout(timer)
    signal.removeEventListener("abort", onAbort)
  }
}

interface DeliverWithRetryOptions extends DeliverOptions {
  maxRetries: number
  onRetry?: (attempt: number, delayMs: number, error: Error) => void
}

// Delivers, retrying only connection-level failures (the local server is down
// or unreachable). An HTTP response — even a 5xx — is a successful delivery and
// is returned immediately.
export async function deliverWithRetry(
  options: DeliverWithRetryOptions
): Promise<DeliveryResult> {
  const { maxRetries, onRetry, signal, ...deliverOptions } = options
  let attempt = 0

  while (true) {
    const result = await deliverRequest({ ...deliverOptions, signal })

    if (
      result.outcome === "responded" ||
      signal.aborted ||
      result.error?.name === "AbortError" ||
      attempt >= maxRetries
    ) {
      return { ...result, attempts: attempt + 1 }
    }

    attempt += 1
    const delayMs = backoffDelay(attempt)
    onRetry?.(attempt, delayMs, result.error ?? new Error("Delivery failed."))
    await sleep(delayMs, signal)
  }
}
