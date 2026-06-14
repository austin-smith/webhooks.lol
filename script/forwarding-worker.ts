#!/usr/bin/env node
import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"

for (const envFile of [".env.local", ".env"]) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile)
  }
}

const { runEndpointForwardingWorker } =
  await import("@/lib/webhooks/endpoint-forwarding/worker")

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
