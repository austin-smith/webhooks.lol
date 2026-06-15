#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { parseArgs } from "node:util"

import { CliError } from "./cli-error.js"
import { runForward } from "./commands/forward.js"
import { runReplay } from "./commands/replay.js"
import { runTail } from "./commands/tail.js"
import {
  parseEndpointId,
  parsePathMode,
  parsePositiveInteger,
  resolveBaseUrl,
  resolveTarget,
} from "./core/config.js"
import { createFilter } from "./core/filter.js"
import { createPrinter } from "./ui/printer.js"

const HELP = `whlol — forward, tail, and replay webhooks.lol traffic to a local server

Usage:
  whlol forward [endpointId] --to <url> [options]
  whlol tail <endpointId> [options]
  whlol replay <endpointId> (--request <id> | --method <m> | --grep <text>) [--to <url>] [options]

Commands:
  forward   Create or attach to an endpoint and deliver its requests to --to.
  tail      Stream live requests to the terminal without delivering them.
  replay    Re-send one stored request (--request) or a filtered set.

Options:
  --to <url>          Local URL to deliver to. Omit for server replay through webhooks.lol.
  --host <url>        API origin (default https://webhooks.lol, or WEBHOOKS_LOL_URL).
  --path <mode>       Local delivery subpath mapping: "preserve" (default) or "strip".
  --method <m>        Only include this method (repeatable).
  --grep <text>       Only include requests whose path/url/body contains <text>.
  --request <id>      Replay a single stored request by id.
  --timeout <ms>      Local delivery timeout in milliseconds (default 30000).
  --retries <n>       Connection-failure retries per request (default 5).
  --no-catchup        Do not replay requests missed while disconnected.
  --replay-existing   On first connect, also deliver already-stored requests.
  --allow-remote      Allow a non-local --to host.
  --json              Emit machine-readable JSON lines.
  --no-color          Disable colored output.
  -h, --help          Show this help.
  -v, --version       Show the version.
`

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      to: { type: "string" },
      host: { type: "string" },
      path: { type: "string" },
      method: { type: "string", multiple: true },
      grep: { type: "string" },
      request: { type: "string" },
      timeout: { type: "string" },
      retries: { type: "string" },
      "no-catchup": { type: "boolean" },
      "replay-existing": { type: "boolean" },
      "allow-remote": { type: "boolean" },
      json: { type: "boolean" },
      "no-color": { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  })

  if (values.version) {
    process.stdout.write(`${readVersion()}\n`)
    return 0
  }

  const [command, endpointArg] = positionals

  if (values.help || !command) {
    process.stdout.write(HELP)
    return command ? 0 : values.help ? 0 : 1
  }

  const json = values.json ?? false
  const color = !values["no-color"] && process.stdout.isTTY === true
  const printer = createPrinter({ color })

  const baseUrl = resolveBaseUrl({ hostFlag: values.host, env: process.env })
  const filter = createFilter({
    methods: values.method ?? [],
    grep: values.grep ?? null,
  })

  const controller = new AbortController()
  const onSignal = () => controller.abort()
  process.on("SIGINT", onSignal)
  process.on("SIGTERM", onSignal)

  try {
    switch (command) {
      case "forward":
        await runForward({
          baseUrl,
          endpointId: endpointArg ? parseEndpointId(endpointArg) : null,
          target: resolveTarget({
            to: values.to,
            allowRemote: values["allow-remote"] ?? false,
          }),
          pathMode: parsePathMode(values.path),
          filter,
          timeoutMs: parsePositiveInteger(values.timeout, {
            flag: "--timeout",
            fallback: 30_000,
          }),
          maxRetries: parsePositiveInteger(values.retries, {
            flag: "--retries",
            fallback: 5,
          }),
          catchup: !values["no-catchup"],
          replayExisting: values["replay-existing"] ?? false,
          json,
          signal: controller.signal,
          printer,
        })
        return 0
      case "tail":
        await runTail({
          baseUrl,
          endpointId: parseEndpointId(endpointArg),
          filter,
          json,
          signal: controller.signal,
          printer,
        })
        return 0
      case "replay":
        await runReplay({
          baseUrl,
          endpointId: parseEndpointId(endpointArg),
          requestId: values.request ?? null,
          filter,
          localTarget:
            values.to !== undefined
              ? resolveTarget({
                  to: values.to,
                  allowRemote: values["allow-remote"] ?? false,
                })
              : null,
          pathMode: parsePathMode(values.path),
          pathModeWasProvided: values.path !== undefined,
          timeoutMs: parsePositiveInteger(values.timeout, {
            flag: "--timeout",
            fallback: 30_000,
          }),
          timeoutWasProvided: values.timeout !== undefined,
          maxRetries: parsePositiveInteger(values.retries, {
            flag: "--retries",
            fallback: 5,
          }),
          retriesWasProvided: values.retries !== undefined,
          json,
          signal: controller.signal,
          printer,
        })
        return 0
      default:
        printer.error(`Unknown command "${command}".`)
        process.stdout.write(HELP)
        return 1
    }
  } finally {
    process.off("SIGINT", onSignal)
    process.off("SIGTERM", onSignal)
  }
}

function readVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as { version?: string }
    return pkg.version ?? "0.0.0"
  } catch {
    return "0.0.0"
  }
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    const printer = createPrinter({ color: process.stderr.isTTY === true })
    if (error instanceof CliError) {
      printer.error(error.message)
      process.exitCode = error.exitCode
    } else {
      printer.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  })
