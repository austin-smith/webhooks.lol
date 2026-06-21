<h1 align="center">
  <img src="apps/web/app/icon.png" alt="webhooks.lol icon" width="128" height="128">
  <br><span style="font-family: monospace;">webhooks.lol</span>
</h1>

<p align="center">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js%2016-black?logo=nextdotjs">
  <img alt="TypeScript 5" src="https://img.shields.io/badge/TypeScript%205-3178C6?logo=typescript&logoColor=white">
  <img alt="PostgreSQL 18" src="https://img.shields.io/badge/PostgreSQL%2018-4169E1?logo=postgresql&logoColor=white">
  <img alt="Redis 8" src="https://img.shields.io/badge/Redis%208-FF4438?logo=redis&logoColor=white">
</p>

A small webhook endpoint for receiving and inspecting HTTP requests. The app
creates unique receive URLs, captures requests sent to them, and shows the
latest traffic in a compact inspector. It is intentionally simple: a request
list, a detail pane, and a small remembered-endpoint switcher for moving between
URLs you have created. Anonymous endpoints remain disposable and browser-local;
signed-in endpoints are attached to the account that created them so they follow
that account across browsers and sessions.

<p align="center">
  <img src="./docs/screenshots/screen-grab-light.png" alt="webhooks.lol light mode" width="49%" />
  <img src="./docs/screenshots/screen-grab-dark.png" alt="webhooks.lol dark mode" width="49%" />
</p>

## Quick Start

```bash
pnpm install
cp packages/database/.env.example packages/database/.env.local
cp apps/web/.env.example apps/web/.env.local
cp apps/docs/.env.example apps/docs/.env.local
cp apps/pgboss/.env.example apps/pgboss/.env.local
pnpm db:local:start
pnpm redis:local:start
pnpm db:migrate
pnpm dev
```

The development server runs on
[http://localhost:4665](http://localhost:4665).

## Configuration

Environment variables are process-owned. Each process reads its own environment
file or host-provided variables:

- `packages/database/.env.local` is for Drizzle database tooling.
- `apps/web/.env.local` is for the Next.js web app.
- `apps/docs/.env.local` is for the Next.js docs app.
- `apps/pgboss/.env.local` is for the PgBoss worker.

The checked-in `.env.example` files provide local defaults for the matching
process. Replace placeholder values with the values for the environment being
run. Auth configuration is documented in [`docs/auth.md`](docs/auth.md).

## Local Services

The local Postgres script runs a named Docker container,
`webhooks-lol-postgres`, with a named volume, `webhooks-lol-postgres-data`. The
local Redis script runs `webhooks-lol-redis` with a named volume,
`webhooks-lol-redis-data`, for rate-limit state.

To create the local Postgres container directly:

```bash
docker volume create webhooks-lol-postgres-data
docker run -d --name webhooks-lol-postgres \
  -e POSTGRES_DB=webhooks-lol \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5434:5432 \
  -v webhooks-lol-postgres-data:/var/lib/postgresql/data \
  postgres:18
```

To create the local Redis container directly:

```bash
docker volume create webhooks-lol-redis-data
docker run -d --name webhooks-lol-redis \
  -p 6379:6379 \
  -v webhooks-lol-redis-data:/data \
  redis:8 redis-server --appendonly yes
```

## Usage

1. Open the app.
2. Optionally sign in or create an account if you want endpoints to follow you
   across browsers.
3. Optionally rename the current endpoint so it is easier to recognize later.
4. Copy the `RECEIVE_URL`.
5. Send any request to that URL, or to a nested path below it.

Example:

```bash
curl -X POST https://hooks.example.com/api/hook/<id>/events/created \
  -H "content-type: application/json" \
  -d '{"event":"created","id":"evt_123"}'
```

Captured requests appear live in the endpoint. Select a request to inspect the
parsed body, headers, query string, and raw HTTP request.

## CLI

The [`whlol`](https://www.npmjs.com/package/whlol) CLI streams endpoint traffic
from your terminal. Use it to forward captured requests to a local server, tail
live requests, or replay stored requests. Forwarded and replayed requests
preserve the original method, headers, and exact body bytes, so provider
signature headers still verify locally.

The current CLI protocol supports anonymous endpoints only. Endpoints created
while signed in are account-owned and require the owning browser session; use
anonymous endpoints with `whlol` until a dedicated CLI authentication or
endpoint-token flow exists.

```bash
# Forward to a local server (creates an endpoint and prints its receive URL)
npx whlol forward --to http://localhost:3000/api/webhooks

# Stream live requests from an anonymous endpoint to the terminal
npx whlol tail <endpoint-id>

# Re-send a stored request from an anonymous endpoint
npx whlol replay <endpoint-id> --request <request-id> --to http://localhost:3000/hook
```

Point the CLI at a local or self-hosted deployment with
`--host http://localhost:4665` or the `WEBHOOKS_LOL_URL` environment variable.
See `apps/cli/README.md` for all options.

## Behavior

- Requests persist in PostgreSQL through Drizzle-managed schema migrations.
- The app keeps the 50 most recently active endpoints per signed-in account or
  anonymous browser session.
- The app keeps the latest 500 requests per endpoint.
- Request bodies are capped at 1 MiB. Larger payloads return `413`.
- Browser preflight requests return CORS headers and are not saved as webhook
  traffic.
- Endpoint names help identify webhook endpoints in the endpoint switcher.
- Signed-in endpoint creation attaches the endpoint to the user account;
  anonymous endpoint creation remains disposable and browser-local.
- Endpoint forwarding deliveries are queued in PostgreSQL through PgBoss and
  processed by the worker app in `apps/pgboss`.

## Workspace

| Path                       | Responsibility                                                  |
| -------------------------- | --------------------------------------------------------------- |
| `apps/web`                 | Next.js web app and API routes                                  |
| `apps/pgboss`              | PgBoss endpoint-forwarding worker process                       |
| `apps/cli`                 | `whlol` command-line client                                     |
| `apps/docs`                | Documentation site                                              |
| `packages/database`        | Drizzle schema and PostgreSQL connection                        |
| `packages/webhooks-core`   | Shared webhook types, IDs, search helpers, and API contracts    |
| `packages/webhooks-server` | Server workflows, repositories, rate limits, replay, forwarding |

## Scripts

Use root commands for app and worker builds or verification so Turbo builds
workspace package dependencies first.

```bash
pnpm dev               # start apps/web on port 4665
pnpm web:build         # production build for apps/web
pnpm web:verify        # typegen, typecheck, lint, test, and build apps/web
pnpm pgboss:dev        # run the PgBoss worker in development
pnpm pgboss:build      # build the worker and package dependencies
pnpm pgboss:start      # start the compiled PgBoss worker
pnpm pgboss:verify     # verify database/core/server packages and worker app
pnpm cli:verify        # verify the whlol CLI package
pnpm docs:start        # start the built docs app
pnpm docs:verify       # verify the docs app
pnpm db:generate       # generate Drizzle migrations in packages/database
pnpm db:local:start    # start local PostgreSQL with Docker
pnpm db:local:stop     # stop the local PostgreSQL container
pnpm db:local:logs     # follow local PostgreSQL logs
pnpm redis:local:start # start local Redis with Docker
pnpm redis:local:stop  # stop the local Redis container
pnpm redis:local:logs  # follow local Redis logs
pnpm db:migrate        # apply packages/database Drizzle migrations
pnpm db:push           # push schema directly for local prototyping
pnpm typecheck         # run TypeScript checks for every workspace package
pnpm build             # production build for apps/web
pnpm verify            # full workspace verification
```
