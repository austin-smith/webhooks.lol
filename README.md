<h1 align="center">
  <img src="app/icon.png" alt="webhooks.lol icon" width="128" height="128">
  <br><span style="font-family: monospace;">webhooks.lol</span>
</h1>

A small webhook inbox for receiving and inspecting HTTP requests.

The app creates private inbox URLs, captures requests sent to them, and shows the latest traffic in a compact inspector. It is intentionally simple: a request list, a detail pane, and a small remembered-inbox switcher for moving between URLs you have created.

## Run

```bash
pnpm install
cp .env.example .env
pnpm db:local:start
pnpm db:migrate
pnpm dev
```

The development server runs on [http://localhost:4665](http://localhost:4665). For real webhook delivery, deploy it behind a public HTTPS URL so external services can reach the receive endpoint.

The local Postgres script runs a named Docker container, `webhooks-lol-postgres`, with a named volume, `webhooks-lol-postgres-data`.

For non-local environments, set `DATABASE_URL` to the target PostgreSQL database and run migrations before starting the app:

```bash
pnpm db:migrate
```

For production, run it on a Node.js host with PostgreSQL available through `DATABASE_URL`.

## Use

1. Open the app.
2. Optionally rename the current inbox so it is easier to recognize later.
3. Copy the `RECEIVE_URL`.
4. Send any request to that URL, or to a nested path below it.

Example:

```bash
curl -X POST https://hooks.example.com/api/hook/<token>/payments/created \
  -H "content-type: application/json" \
  -d '{"event":"payment.created","amount":42}'
```

Captured requests appear live in the inbox. Select a request to inspect the parsed body, headers, query string, and raw HTTP request.

## Behavior

- Requests persist in PostgreSQL through Drizzle-managed schema migrations.
- The app keeps the latest 500 requests per inbox.
- Request bodies are capped at 1 MiB. Larger payloads return `413`.
- Browser preflight requests return CORS headers and are not saved as webhook traffic.
- The browser remembers recent inbox tokens and optional inbox names for the current user.

## Scripts

```bash
pnpm dev        # start Next.js on port 4665
pnpm db:generate # generate Drizzle migrations after schema changes
pnpm db:local:start # start local PostgreSQL with Docker
pnpm db:local:stop  # stop the local PostgreSQL container
pnpm db:local:logs  # follow local PostgreSQL logs
pnpm db:migrate  # apply Drizzle migrations to DATABASE_URL
pnpm db:push     # push schema directly for local prototyping
pnpm typecheck  # run TypeScript
pnpm lint       # run ESLint
pnpm build      # production build
pnpm verify     # typecheck, lint, and build
```
