import type { JobWithMetadata, WorkOptions } from "pg-boss"

import {
  ENDPOINT_FORWARDING_DELIVERY_TIMEOUT_MS,
  ENDPOINT_FORWARDING_QUEUE,
  EndpointForwardTargetValidationError,
  resolveEndpointForwardTargetUrlSafely,
  type EndpointForwardDeliveryJob,
} from "@webhooks-lol/webhooks-server/endpoint-forwarding/policy"
import {
  buildEndpointForwardBody,
  buildEndpointForwardHeaders,
  buildEndpointForwardTargetUrl,
} from "@webhooks-lol/webhooks-server/endpoint-forwarding/delivery-request"
import {
  getEndpointForwardDeliveryForProcessing,
  recordEndpointForwardDeliveryAttempt,
} from "@webhooks-lol/webhooks-server/endpoint-forwarding/repository"
import { getEndpointForwardingBoss } from "@webhooks-lol/webhooks-server/endpoint-forwarding/queue"
import {
  sendEndpointForwardHttpsRequest,
  type EndpointForwardTransport,
} from "@webhooks-lol/webhooks-server/endpoint-forwarding/transport"

const WORKER_CONCURRENCY = 10
const TARGET_CONCURRENCY = 2
const WORK_OPTIONS = {
  groupConcurrency: TARGET_CONCURRENCY,
  includeMetadata: true,
  localConcurrency: WORKER_CONCURRENCY,
  pollingIntervalSeconds: 1,
} as const satisfies WorkOptions

type DeliveryOutcome =
  | {
      kind: "delivered"
      status: number
    }
  | {
      kind: "failed"
      error: string
      retryable: boolean
      status: number | null
    }

class RetryableEndpointForwardDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RetryableEndpointForwardDeliveryError"
  }
}

export async function startEndpointForwardingWorker({
  transport = sendEndpointForwardHttpsRequest,
}: {
  transport?: EndpointForwardTransport
} = {}) {
  const boss = await getEndpointForwardingBoss()

  return boss.work<EndpointForwardDeliveryJob, void, typeof WORK_OPTIONS>(
    ENDPOINT_FORWARDING_QUEUE,
    WORK_OPTIONS,
    async ([job]) => {
      if (!job) {
        return
      }

      await processEndpointForwardDeliveryJob({
        job,
        transport,
      })
    }
  )
}

export async function runEndpointForwardingWorker({
  signal,
}: {
  signal: AbortSignal
}) {
  const boss = await getEndpointForwardingBoss()
  const workerId = await startEndpointForwardingWorker()

  await new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }

    signal.addEventListener("abort", () => resolve(), { once: true })
  })

  await boss.offWork(workerId, { wait: true })
  await boss.stop()
}

export async function processEndpointForwardDeliveryJob({
  job,
  transport = sendEndpointForwardHttpsRequest,
}: {
  job: JobWithMetadata<EndpointForwardDeliveryJob>
  transport?: EndpointForwardTransport
}) {
  const deliveryId = job.data.deliveryId
  const loaded = await getEndpointForwardDeliveryForProcessing(deliveryId)

  if (!loaded || loaded.delivery.status !== "pending") {
    return
  }

  if (loaded.target.deleted) {
    await recordEndpointForwardDeliveryAttempt({
      deliveryId,
      lastError: "Forward target was deleted.",
      lastStatus: null,
      status: "cancelled",
    })
    return
  }

  if (!loaded.target.enabled) {
    await recordEndpointForwardDeliveryAttempt({
      deliveryId,
      lastError: "Forward target is disabled.",
      lastStatus: null,
      status: "failed",
    })
    return
  }

  const attempt = loaded.delivery.attempts + 1
  const outcome = await deliverEndpointForwardRequest({
    attempt,
    jobSignal: job.signal,
    loaded,
    transport,
  })
  const finalAttempt = job.retryCount >= job.retryLimit

  if (outcome.kind === "delivered") {
    await recordEndpointForwardDeliveryAttempt({
      deliveryId,
      lastError: null,
      lastStatus: outcome.status,
      status: "delivered",
    })
    return
  }

  if (outcome.retryable && !finalAttempt) {
    await recordEndpointForwardDeliveryAttempt({
      deliveryId,
      lastError: outcome.error,
      lastStatus: outcome.status,
      status: "pending",
    })
    throw new RetryableEndpointForwardDeliveryError(outcome.error)
  }

  await recordEndpointForwardDeliveryAttempt({
    deliveryId,
    lastError: outcome.error,
    lastStatus: outcome.status,
    status: "failed",
  })
}

async function deliverEndpointForwardRequest({
  attempt,
  jobSignal,
  loaded,
  transport,
}: {
  attempt: number
  jobSignal: AbortSignal
  loaded: Awaited<ReturnType<typeof getEndpointForwardDeliveryForProcessing>>
  transport: EndpointForwardTransport
}): Promise<DeliveryOutcome> {
  if (!loaded) {
    return {
      error: "Endpoint forward delivery was not found.",
      kind: "failed",
      retryable: false,
      status: null,
    }
  }

  let resolvedTarget: Awaited<
    ReturnType<typeof resolveEndpointForwardTargetUrlSafely>
  >

  try {
    resolvedTarget = await resolveEndpointForwardTargetUrlSafely(
      loaded.delivery.targetUrl
    )
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      kind: "failed",
      retryable:
        !(error instanceof EndpointForwardTargetValidationError) ||
        error.retryable,
      status: null,
    }
  }

  const controller = new AbortController()
  const onAbort = () => controller.abort()
  const timeout = setTimeout(
    () => controller.abort(),
    ENDPOINT_FORWARDING_DELIVERY_TIMEOUT_MS
  )
  jobSignal.addEventListener("abort", onAbort, { once: true })

  try {
    const response = await transport({
      addresses: resolvedTarget.addresses,
      body: buildEndpointForwardBody(loaded.request),
      headers: buildEndpointForwardHeaders({
        attempt,
        deliveryId: loaded.delivery.id,
        request: loaded.request,
      }),
      method: loaded.request.method,
      signal: controller.signal,
      url: buildEndpointForwardTargetUrl({
        pathMode: loaded.delivery.targetPathMode,
        request: loaded.request,
        targetUrl: resolvedTarget.url.toString(),
      }),
    })

    if (response.status >= 200 && response.status < 300) {
      return {
        kind: "delivered",
        status: response.status,
      }
    }

    return {
      error: `Forward target responded with HTTP ${response.status}.`,
      kind: "failed",
      retryable: isRetryableStatus(response.status),
      status: response.status,
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      kind: "failed",
      retryable: true,
      status: null,
    }
  } finally {
    clearTimeout(timeout)
    jobSignal.removeEventListener("abort", onAbort)
  }
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500
}
