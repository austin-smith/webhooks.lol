#!/usr/bin/env node
import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"

import { runEndpointForwardingWorker } from "@webhooks-lol/webhooks-server/endpoint-forwarding/worker"

for (const envFile of [".env.local", ".env"]) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile)
  }
}

const controller = new AbortController()

function stop() {
  controller.abort()
}

process.once("SIGINT", stop)
process.once("SIGTERM", stop)

runEndpointForwardingWorker({ signal: controller.signal }).catch((error) => {
  console.error("[pgboss] worker failed", error)
  process.exitCode = 1
  controller.abort()
})
