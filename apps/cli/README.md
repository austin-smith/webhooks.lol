# whlol

Forward, tail, and replay [webhooks.lol](https://webhooks.lol) endpoint traffic
to a server on your machine.

Webhooks are delivered to a public receive URL, but the service you are building
runs on `localhost`. `whlol` streams an endpoint's captured requests and
re-delivers each one to a local URL, so your app receives real provider traffic
while you develop.

```bash
npx whlol forward --to http://localhost:3000/api/stripe
```

This creates an endpoint, prints its receive URL, and forwards every captured
request to your local server. Paste the URL into the provider's webhook
configuration and trigger an event.

## Commands

```bash
# Forward (create a new endpoint, or attach to an existing one)
npx whlol forward --to http://localhost:3000/api/stripe
npx whlol forward <endpoint-id> --to http://localhost:3000/hook

# Tail live requests to the terminal
npx whlol tail <endpoint-id>
npx whlol tail <endpoint-id> --json | jq .

# Replay a stored request, or a filtered set
npx whlol replay <endpoint-id> --request <request-id> --to http://localhost:3000/hook
npx whlol replay <endpoint-id> --method POST --grep refund --to http://localhost:3000/hook
```

The original method, headers, and exact body bytes are preserved, so provider
signature headers (`Stripe-Signature`, `X-Hub-Signature-256`, …) still verify
against your local handler. `forward` reconnects and reconciles missed requests
from the endpoint's retained request history, and retries delivery if the local
server is briefly down.

## Options

| Option | Description |
| --- | --- |
| `--to <url>` | Local URL to deliver to (required for `forward` and `replay`). |
| `--host <url>` | API origin. Defaults to `https://webhooks.lol`, or `WEBHOOKS_LOL_URL`. |
| `--path <mode>` | Subpath mapping: `preserve` (default) or `strip`. |
| `--method <m>` | Only include this method. Repeatable. |
| `--grep <text>` | Only include requests whose path, URL, or text body contains `<text>`. |
| `--request <id>` | Replay a single stored request by id. |
| `--timeout <ms>` | Per-delivery timeout in milliseconds (default `30000`). |
| `--retries <n>` | Connection-failure retries per request (default `5`). |
| `--no-catchup` | Do not replay requests missed while disconnected. |
| `--replay-existing` | On first connect, also deliver already-stored requests. |
| `--allow-remote` | Allow a non-local `--to` host. |
| `--json` | Emit machine-readable JSON lines. |
| `--no-color` | Disable colored output. |
| `-h, --help` | Show help. |
| `-v, --version` | Show the version. |

## Security

The endpoint ID is the only credential for CLI access: anyone who has it can read
and locally forward captured traffic. Treat the receive URL and ID as secrets.
By default `--to` must be a local or private-network host; pass `--allow-remote`
to override.
