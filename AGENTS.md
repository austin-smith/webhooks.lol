# AGENTS.md

## Project Overview

`webhooks.lol` is a pnpm workspace for a small webhook endpoint inspector built
with Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/Radix UI,
Drizzle ORM, PostgreSQL, Redis, PgBoss, and Vitest. It creates private endpoint
URLs, captures inbound HTTP requests, stores them in PostgreSQL, streams live
updates into a compact browser inspector, supports request replay and endpoint
forwarding, ships a `whlol` CLI under `apps/cli` for local forwarding, tailing,
and replay, and runs queued endpoint forwarding from the PgBoss worker app under
`apps/pgboss`.

Important domain terms are defined in `CONTEXT.md`. Read it before changing
webhook capture, persistence, event streaming, endpoint forwarding, request
replay, CLI transport, or browser endpoint-session code.

## Standard

This repo optimizes for clean, correct, modern code. Best practices and high
code quality are expected for new code and touched code.

- Follow current best practices for Next.js App Router, React, TypeScript,
  Tailwind CSS, Drizzle, and the repo's chosen libraries.
- Do not add shims, workaround layers, polyfill-style wrappers, fallback
  branches, compatibility adapters, or dual code paths unless the user
  explicitly requests them.
- Do not preserve old APIs, old props, old data shapes, stale flags, or dead
  abstractions "just in case."
- Do not take shortcut fixes, temporary hacks, bandaids, or "good enough for
  now" implementations and present them as finished work.
- Prefer replacing weak patterns over wrapping them.
- Fix root causes when reasonably possible. If a compromise is unavoidable,
  call it out clearly.
- Refactor locally when needed to keep the touched area coherent.

## Setup Commands

- Install dependencies: `pnpm install`
- Create database tooling env:
  `cp packages/database/.env.example packages/database/.env.local`
- Create web app env: `cp apps/web/.env.example apps/web/.env.local`
- Create PgBoss worker env: `cp apps/pgboss/.env.example apps/pgboss/.env.local`
- Start local PostgreSQL: `pnpm db:local:start`
- Start local Redis: `pnpm redis:local:start`
- Apply migrations: `pnpm db:migrate`
- Start the dev server: `pnpm dev`

The dev server runs on `http://localhost:4665`.

## Development Workflow

- Package manager: use `pnpm`; do not switch to npm, yarn, or bun.
- Dev server: `pnpm dev`
- Production build: `pnpm build`
- Production start after build: `pnpm start`
- Full local verification: `pnpm verify`
- Endpoint forwarding PgBoss worker in development: `pnpm pgboss:dev`
- Endpoint forwarding PgBoss worker after build: `pnpm pgboss:start`
- Format TypeScript and TSX files: `pnpm format`

Keep route handlers and server-only modules on the Node.js runtime when they use
database access, `Buffer`, streams, or other Node-specific APIs.

Workspace task orchestration uses Turborepo. Keep internal workspace libraries
as compiled packages with `dist` package exports, and express dependency order,
caching, and long-running dev task behavior in `turbo.json` rather than in
nested shell scripts. Root app commands such as `pnpm dev`, `pnpm web:build`,
and `pnpm pgboss:dev` should use the Turbo-backed scripts so package builds and
watchers stay dependency-aware.

Use root Turbo-backed scripts for any app or worker command that depends on
compiled workspace packages. Direct filtered app commands such as
`pnpm --filter @webhooks-lol/web build`,
`pnpm --filter @webhooks-lol/web test`, or
`pnpm --filter @webhooks-lol/pgboss build` do not build ignored `dist` outputs
for workspace dependencies on a clean checkout. Use the root commands
(`pnpm web:build`, `pnpm web:verify`, `pnpm pgboss:build`,
`pnpm pgboss:verify`) or an explicit `turbo run <task> --filter <app>...`
invocation instead. Direct `pnpm --filter <package> <script>` remains
appropriate for package-owned commands that do not require compiled workspace
dependency outputs, such as database tooling and focused package tests after
the relevant dependency build graph has run.

Local env files live with the package or app that reads them. Put database
tooling variables in `packages/database/.env.local`, web runtime variables in
`apps/web/.env.local`, and PgBoss worker variables in `apps/pgboss/.env.local`.

Railway deployments use app-local config-as-code files:
`apps/web/railway.json`, `apps/docs/railway.json`, and
`apps/pgboss/railway.json`. Keep Railway service roots at the repository root so
pnpm workspace packages resolve correctly, and point each Railway service at its
own config file path. Do not add a root `railway.json` for this monorepo.

## Database Workflow

- Database table definitions live in `packages/database/src/auth-schema.ts` and
  `packages/database/src/public-schema.ts`; `packages/database/src/schema.ts`
  re-exports both for Drizzle and runtime setup.
- Drizzle migrations live in `packages/database/drizzle/`.
- Generate migrations after schema changes with `pnpm db:generate`.
- Apply migrations with `pnpm db:migrate`.
- Use `pnpm db:push` only for local prototyping, not as a replacement for a
  committed migration.
- Open Drizzle Studio with `pnpm db:studio` when inspecting local data.
- Follow local database logs with `pnpm db:local:logs`.
- Stop local PostgreSQL with `pnpm db:local:stop`.

Database access belongs behind the webhook repository layer. Do not put Drizzle
queries directly in route handlers when the behavior belongs in a repository or
domain module.

### Better Auth Tables

- This repo deliberately uses a custom PostgreSQL schema for Better Auth while
  staying on the Better Auth Drizzle adapter. Standard Better Auth tables live
  in `auth` (`auth.user`, `auth.session`, `auth.account`, `auth.verification`);
  app-owned tables live in `public`.
- Define Better Auth tables in `packages/database/src/auth-schema.ts` with
  `authSchema.table(...)`. Define public app tables in
  `packages/database/src/public-schema.ts` with `pgTable(...)`.
- Keep `schemaFilter: ["public", "auth"]` in
  `packages/database/drizzle.config.ts`, and pass the schema object explicitly
  to `drizzleAdapter`.
- Do not add custom auth, role, setup-token, ownership, or bootstrap tables
  unless a Better Auth-supported feature and product design require it.
- When Better Auth plugins change, generate CLI output as a table-shape
  reference, then apply the relevant changes to
  `packages/database/src/auth-schema.ts`:

  ```bash
  cd apps/web
  pnpm dlx auth@latest generate \
    --config lib/auth/schema-generator.ts \
    --output .better-auth-schema.generated.ts \
    --yes
  ```

- After changing table definitions, run `pnpm db:generate` and confirm the
  migration keeps Better Auth tables in `auth` and app tables in `public`.

## Testing Instructions

- Run all tests through package verification: `pnpm verify`
- Run web tests with package dependencies: `pnpm exec turbo run test --filter @webhooks-lol/web...`
- Run webhook core tests: `pnpm --filter @webhooks-lol/webhooks-core test`
- Run webhook server tests: `pnpm --filter @webhooks-lol/webhooks-server test`
- Run one package test file: `pnpm --filter <package> vitest run path/to/file.test.ts`
- Run package tests by name: `pnpm --filter <package> vitest run -t "test name"`
- Run TypeScript checks: `pnpm typecheck`
- Run app lint with package dependencies: `pnpm exec turbo run lint --filter @webhooks-lol/web...`
- Run package lint: `pnpm --filter <package> lint`
- Run the full suite before finishing broad changes: `pnpm verify`

Tests live next to the package or app that owns the behavior. Web tests live
under `apps/web/tests/`, webhook core tests under `packages/webhooks-core/tests/`,
webhook server tests under `packages/webhooks-server/tests/`, and CLI tests
under `apps/cli/tests/`. Vitest runs in a Node environment. The web Vitest config
aliases `@/` to `apps/web` and maps `server-only` to
`apps/web/tests/server-only.ts`; the server package maps `server-only` to
`packages/webhooks-server/tests/server-only.ts`.

Add or update focused tests for changed behavior. Repository and route-boundary
changes should cover persistence rules, request parsing, error responses, and
event publishing behavior as appropriate. Client session changes should cover
state helpers, storage normalization, event-stream handling, and transport
behavior. CLI changes should cover argument parsing, request shaping, SSE
parsing/reconnect behavior, local delivery, replay selection, and API-client
error handling as appropriate.

Do not add tests just to tick a coverage box. Tests should protect meaningful
behavior, invariants, and ownership boundaries that would matter in a regression.
Prefer concise table-driven coverage for input/output rules over narrow examples
that only mirror the current implementation or assert third-party library
internals.

## CLI Package

The `whlol` CLI lives in `apps/cli` as a separate pnpm workspace package. It
owns local forwarding, tailing, replay command orchestration, API transport, SSE
parsing, request shaping, local delivery, and terminal output.

- Run CLI verification: `pnpm cli:verify`
- Run CLI tests: `pnpm --filter whlol test`
- Build CLI output: `pnpm --filter whlol build`

Keep CLI-specific behavior inside `apps/cli/src/*` unless there is a durable
shared server/client contract that belongs in
`packages/webhooks-core/src/api-contracts.ts`.
Do not import browser endpoint-session code into the CLI.

## PgBoss Worker App

The endpoint forwarding PgBoss worker lives in `apps/pgboss`. It is a separate
Node.js process that imports server-side forwarding behavior from
`@webhooks-lol/webhooks-server/endpoint-forwarding/worker`.

- Run the worker in development: `pnpm pgboss:dev`
- Build the worker and its package dependencies: `pnpm pgboss:build`
- Start the compiled worker: `pnpm pgboss:start`
- Verify the worker app and package dependencies: `pnpm pgboss:verify`

Do not put production worker entrypoints under `script/`. Runtime processes
belong in `apps/*`; reusable implementation belongs in packages.

## Code Style

- TypeScript is strict. Keep it strict.
- Avoid `any`, unsafe casts, and non-null assertions unless there is no
  reasonable alternative.
- Model domain behavior with explicit types instead of stringly typed
  conventions.
- Keep unsafe input handling at boundaries and narrow data before passing it
  into domain code.
- Use the `@/` import alias for app-local imports.
- Follow the repo's Prettier config: no semicolons, double quotes, LF endings,
  2-space indentation, trailing commas where configured, and Tailwind class
  sorting through `prettier-plugin-tailwindcss`.
- Prefer small, cohesive modules with clear names over generic helpers.
- Do not scatter behavior into `utils` files without a real boundary or durable
  responsibility.

## Architecture

- `apps/web/app/api/**/route.ts` files are server boundaries. They should parse route
  context, call dedicated server/domain modules, and shape HTTP responses.
- `packages/webhooks-core/src/*` owns shared webhook vocabulary and dependency-light
  contracts: endpoint IDs, captured request types, endpoint response shapes,
  request search helpers, endpoint forwarding enums/types, and API contracts.
- `packages/webhooks-server/src/inbound-capture.ts` owns inbound request capture
  rules, body limits, body parsing, captured-path/query/header extraction, and
  publication after persistence succeeds.
- `packages/webhooks-server/src/repository.ts` owns endpoint and captured-request
  persistence.
- `packages/webhooks-server/src/endpoint-event-stream.ts` owns live endpoint
  event-stream behavior.
- `packages/webhooks-server/src/endpoint-forwarding/*` owns server-side forwarding
  policy, target validation, delivery shaping, PgBoss queue integration,
  persistence, transport, and worker processing.
- `packages/webhooks-server/src/request-replay/*` owns replaying a stored captured request
  through the normal capture persistence/event publication path.
- `packages/database/src/*` owns Drizzle table definitions and PostgreSQL
  connection setup.
- `apps/web/components/webhook-inspector/endpoint-session/*` owns browser-side
  endpoint session state, storage, transport, and event-stream handling.
- `apps/cli/src/*` owns the `whlol` command-line client.
- `apps/web/components/ui/*` contains shadcn/Radix-derived primitives. Extend them
  consistently instead of inventing incompatible UI primitives.

Prefer the flow `Route Handler -> domain/server module -> repository` for
database-backed behavior. Keep business rules out of UI components and route
handlers when they belong in domain modules.

## App Router and React Guidelines

- Prefer Server Components by default.
- Use Client Components only for state, event handlers, effects, custom hooks,
  or browser-only APIs.
- Use Route Handlers for HTTP endpoints, webhooks, SSE, and non-UI responses.
- Keep Route Handlers thin and explicit about cache behavior with
  `dynamic = "force-dynamic"` and no-store headers when applicable.
- Use Next.js App Router conventions and the Metadata API. Do not manage
  document head state manually in client code.
- Keep hooks focused on one responsibility and avoid hiding large workflows
  behind vague names.

## UI Guidelines

- Match the existing inspector style: compact, practical, monospaced,
  information-dense, and restrained.
- Use shadcn/Radix primitives and `lucide-react` icons where appropriate.
- Keep controls accessible: labels, focus states, keyboard behavior, and
  meaningful status text matter.
- Avoid marketing-page patterns for the app surface. This is an operational
  tool, so favor scanning, comparison, and repeated use.
- Do not add decorative UI that competes with request data.

## Webhook Behavior

### Capture and Event Streams

- Redis-backed admission control protects endpoint creation, webhook capture
  request counts, captured body bytes, and live event-stream connection leases.
  Keep admission checks before expensive work such as body reads when possible.
- Policies live in `packages/webhooks-server/src/policies.ts`, admission in
  `packages/webhooks-server/src/admission-control.ts`, and Redis primitives in
  `packages/webhooks-server/src/rate-limits/*`.
- Event streams use Redis leases; renew with heartbeats and release on cleanup.
- Preserve CORS and no-store response behavior for capture endpoints.
- Browser preflight requests should not be saved as webhook traffic.
- Publish live request events only after persistence succeeds.
- Be careful with binary payloads: text display and base64 storage are separate
  concerns.

### Forwarding and Replay

- Endpoint forwarding creates queued deliveries only after capture persistence
  succeeds.
  Forwarding workers must preserve original method, forwardable headers, body
  bytes, path mode, and query semantics while rejecting unsafe target URLs.
- Request retention must not delete captured requests with pending forwarding
  deliveries. Requests marked for deletion after forwarding should be pruned only
  after all pending deliveries for that request are no longer pending.
- Request replay creates and publishes a new captured request for the same
  endpoint. It should not enqueue endpoint-forwarding deliveries unless that
  behavior is explicitly changed.

## File Organization

- Add a new file when it creates a real module boundary or clarifies a durable
  responsibility.
- Extend an existing module when the new behavior is tightly related and not
  meaningfully reusable on its own.
- Choose names that describe domain responsibility, not the incidental task that
  led to the file.
- Before creating general-purpose helpers, look for a feature, domain, or layer
  where the behavior belongs.
