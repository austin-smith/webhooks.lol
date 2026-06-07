<h1 align="center">
  <img src="app/icon.png" alt="webhooks.lol icon" width="128" height="128">
  <br><span style="font-family: monospace;">webhooks.lol</span>
</h1>

A small webhook endpoint for receiving and inspecting HTTP requests.

The app creates private endpoint URLs, captures requests sent to them, and shows the latest traffic in a compact inspector. It is intentionally simple: a request list, a detail pane, and a small remembered-endpoint switcher for moving between URLs you have created.

## Run

```bash
pnpm install
cp .env.example .env
pnpm db:local:start
pnpm redis:local:start
pnpm db:migrate
pnpm dev
```

The development server runs on [http://localhost:4665](http://localhost:4665). For real webhook delivery, deploy it behind a public HTTPS URL so external services can reach the receive endpoint.

The local Postgres script runs a named Docker container, `webhooks-lol-postgres`, with a named volume, `webhooks-lol-postgres-data`. The local Redis script runs `webhooks-lol-redis` with a named volume, `webhooks-lol-redis-data`, for rate-limit state.

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

For non-local environments, set `DATABASE_URL` to the target PostgreSQL database and `REDIS_URL` to the target Redis service. Run migrations before starting the app:

```bash
pnpm db:migrate
```

For production, run it on a Node.js host with PostgreSQL available through `DATABASE_URL` and Redis available through `REDIS_URL`.

## Use

1. Open the app.
2. Optionally rename the current endpoint so it is easier to recognize later.
3. Copy the `RECEIVE_URL`.
4. Send any request to that URL, or to a nested path below it.

Example:

```bash
curl -X POST https://hooks.example.com/api/hook/<id>/payments/created \
  -H "content-type: application/json" \
  -d '{"event":"payment.created","amount":42}'
```

Captured requests appear live in the endpoint. Select a request to inspect the parsed body, headers, query string, and raw HTTP request.

## Behavior

- Requests persist in PostgreSQL through Drizzle-managed schema migrations.
- The app keeps the latest 500 requests per endpoint.
- Request bodies are capped at 1 MiB. Larger payloads return `413`.
- Browser preflight requests return CORS headers and are not saved as webhook traffic.
- Endpoint names help identify webhook endpoints in the endpoint switcher.

## Scripts

```bash
pnpm dev        # start Next.js on port 4665
pnpm db:generate # generate Drizzle migrations after schema changes
pnpm db:local:start # start local PostgreSQL with Docker
pnpm db:local:stop  # stop the local PostgreSQL container
pnpm db:local:logs  # follow local PostgreSQL logs
pnpm redis:local:start # start local Redis with Docker
pnpm redis:local:stop  # stop the local Redis container
pnpm redis:local:logs  # follow local Redis logs
pnpm db:migrate  # apply Drizzle migrations to DATABASE_URL
pnpm db:push     # push schema directly for local prototyping
pnpm typegen    # generate Next.js route types
pnpm typecheck  # run TypeScript
pnpm lint       # run ESLint
pnpm test       # run Vitest
pnpm build      # production build
pnpm verify     # typegen, typecheck, lint, test, and build
```
