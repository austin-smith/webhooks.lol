const MAX_BACKOFF_MS = 30_000
const BASE_BACKOFF_MS = 500

// Resolves after `ms`, or immediately when `signal` aborts, so waits never
// outlive a Ctrl-C.
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }

    const onAbort = () => {
      clearTimeout(timer)
      resolve()
    }

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)

    signal.addEventListener("abort", onAbort, { once: true })
  })
}

// Exponential backoff with full +20% jitter, capped, for reconnect and retry.
export function backoffDelay(attempt: number): number {
  const exponential = Math.min(
    MAX_BACKOFF_MS,
    BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1)
  )

  return Math.round(exponential + exponential * 0.2 * Math.random())
}
