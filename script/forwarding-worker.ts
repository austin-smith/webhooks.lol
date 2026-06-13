#!/usr/bin/env node
import { runEndpointForwardingWorker } from "@/lib/webhooks/endpoint-forwarding/worker"

const controller = new AbortController()

function stop() {
  controller.abort()
}

process.once("SIGINT", stop)
process.once("SIGTERM", stop)

runEndpointForwardingWorker({ signal: controller.signal }).catch((error) => {
  console.error("[endpoint-forwarding] worker failed", error)
  process.exitCode = 1
  controller.abort()
})
