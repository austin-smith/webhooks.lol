# whlol

Forward, tail, and replay [webhooks.lol](https://webhooks.lol) endpoint traffic
from your terminal.

[`whlol`](https://www.npmjs.com/package/whlol) lets you inspect endpoint traffic
without opening the browser. Use it to create forwarding sessions for local
development, tail live requests as they arrive, or replay retained requests
through webhooks.lol or to a local server.

```bash
npx whlol forward --to http://localhost:3000/api/webhooks
```

This creates an endpoint, prints its receive URL, and forwards every captured
request to your local server. Paste the URL into the provider's webhook
configuration and trigger an event.

## Commands

```bash
# Forward (create a new anonymous endpoint, or attach to an existing anonymous one)
npx whlol forward --to http://localhost:3000/api/webhooks
npx whlol forward <endpoint-id> --to http://localhost:3000/hook

# Tail live requests from an anonymous endpoint to the terminal
npx whlol tail <endpoint-id>
npx whlol tail <endpoint-id> --json | jq .

# Replay a stored request, or a filtered set, from an anonymous endpoint
npx whlol replay <endpoint-id> --request <request-id>
npx whlol replay <endpoint-id> --method POST --grep created

# Replay to a local server from your machine
npx whlol replay <endpoint-id> --request <request-id> --to http://localhost:3000/hook
npx whlol replay <endpoint-id> --method POST --grep created --to http://localhost:3000/hook
```

The original method, headers, and exact body bytes are preserved, so provider
signature headers (`Stripe-Signature`, `X-Hub-Signature-256`, …) still verify
against your local handler. Without `--to`, `replay` re-submits the stored
request through webhooks.lol and creates a new captured request for the same
endpoint. `forward` reconnects and reconciles missed requests from the
endpoint's retained request history, and retries delivery if the local server is
briefly down.

## Options

| Option              | Description                                                                   |
| ------------------- | ----------------------------------------------------------------------------- |
| `--to <url>`        | Local URL to deliver to. Required for `forward`; optional for local `replay`. |
| `--host <url>`      | API origin. Defaults to `https://webhooks.lol`, or `WEBHOOKS_LOL_URL`.        |
| `--path <mode>`     | Local delivery subpath mapping: `preserve` (default) or `strip`.              |
| `--method <m>`      | Only include this method. Repeatable.                                         |
| `--grep <text>`     | Only include requests whose path, URL, or text body contains `<text>`.        |
| `--request <id>`    | Replay a single stored request by id.                                         |
| `--timeout <ms>`    | Local delivery timeout in milliseconds (default `30000`).                     |
| `--retries <n>`     | Connection-failure retries per request (default `5`).                         |
| `--no-catchup`      | Do not replay requests missed while disconnected.                             |
| `--replay-existing` | On first connect, also deliver already-stored requests.                       |
| `--allow-remote`    | Allow a non-local `--to` host.                                                |
| `--json`            | Emit machine-readable JSON lines.                                             |
| `--no-color`        | Disable colored output.                                                       |
| `-h, --help`        | Show help.                                                                    |
| `-v, --version`     | Show the version.                                                             |

## Security

The current CLI protocol supports anonymous endpoints only. `whlol` can read,
replay, and forward traffic for anonymous endpoints by endpoint ID.

Account-owned endpoints created while signed in require the owning browser
session and are not exposed to the CLI until a dedicated CLI authentication or
endpoint-token flow exists. By default `--to` must be a local or private-network
host; pass `--allow-remote` to override.
