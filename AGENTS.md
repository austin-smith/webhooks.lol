# AGENTS.md

## Project Overview

`webhooks.lol` is a small webhook endpoint inspector built with Next.js App Router,
React, TypeScript, Tailwind CSS, shadcn/Radix UI, Drizzle ORM, PostgreSQL, Redis,
PgBoss, and Vitest. It creates private endpoint URLs, captures inbound HTTP
requests, stores them in PostgreSQL, streams live updates into a compact browser
inspector, supports request replay and endpoint forwarding, and ships a `whlol`
CLI under `apps/cli` for local forwarding, tailing, and replay.

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
- Endpoint forwarding worker: `pnpm forwarding:worker`
- Format TypeScript and TSX files: `pnpm format`

Keep route handlers and server-only modules on the Node.js runtime when they use
database access, `Buffer`, streams, or other Node-specific APIs.

The repository is a pnpm workspace. Use `pnpm --filter <package> <script>` for
package-specific commands.

## Database Workflow

- Database table definitions live in `lib/database/auth-schema.ts` and
  `lib/database/public-schema.ts`; `lib/database/schema.ts` re-exports both for
  Drizzle and runtime setup.
- Drizzle migrations live in `drizzle/`.
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
- Define Better Auth tables in `lib/database/auth-schema.ts` with
  `authSchema.table(...)`. Define public app tables in
  `lib/database/public-schema.ts` with `pgTable(...)`.
- Keep `schemaFilter: ["public", "auth"]` in `drizzle.config.ts`, and pass the
  schema object explicitly to `drizzleAdapter`.
- Do not add custom auth, role, setup-token, ownership, or bootstrap tables
  unless a Better Auth-supported feature and product design require it.
- When Better Auth plugins change, generate CLI output as a table-shape
  reference, then apply the relevant changes to `lib/database/auth-schema.ts`:

  ```bash
  pnpm dlx auth@latest generate \
    --config lib/auth/schema-generator.ts \
    --output .better-auth-schema.generated.ts \
    --yes
  ```

- After changing table definitions, run `pnpm db:generate` and confirm the
  migration keeps Better Auth tables in `auth` and app tables in `public`.

## Testing Instructions

- Run all tests: `pnpm test`
- Run one test file: `pnpm vitest run tests/path/to/file.test.ts`
- Run tests by name: `pnpm vitest run -t "test name"`
- Run TypeScript checks: `pnpm typecheck`
- Run lint: `pnpm lint`
- Run the full suite before finishing broad changes: `pnpm verify`

Tests live under `tests/`, with webhook domain tests in `tests/lib/webhooks/`.
Vitest runs in a Node environment. The Vitest config aliases `@/` to the repo
root and maps `server-only` to `tests/server-only.ts`, so server modules can be
tested without Next's runtime guard blocking imports. CLI tests live under
`apps/cli/tests/` and run against the CLI package's separate Vitest config.

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

- Run CLI verification: `pnpm --filter whlol verify`
- Run CLI tests: `pnpm --filter whlol test`
- Build CLI output: `pnpm --filter whlol build`

Keep CLI-specific behavior inside `apps/cli/src/*` unless there is a durable
shared server/client contract that belongs in `lib/webhooks/api-contracts.ts`.
Do not import browser endpoint-session code into the CLI.

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

- `app/api/**/route.ts` files are server boundaries. They should parse route
  context, call dedicated server/domain modules, and shape HTTP responses.
- `lib/webhooks/inbound-capture.ts` owns inbound request capture rules, body
  limits, body parsing, captured-path/query/header extraction, and publication
  after persistence succeeds.
- `lib/webhooks/repository.ts` owns endpoint and captured-request persistence.
- `lib/webhooks/endpoint-event-stream.ts` owns live endpoint event-stream behavior.
- `lib/webhooks/api-contracts.ts` owns shared API response shapes used across
  routes and client transport code.
- `lib/webhooks/endpoint-forwarding/*` owns server-side forwarding policy,
  target validation, delivery shaping, PgBoss queue integration, persistence,
  transport, and worker processing.
- `lib/webhooks/request-replay/*` owns replaying a stored captured request
  through the normal capture persistence/event publication path.
- `components/webhook-inspector/endpoint-session/*` owns browser-side endpoint session
  state, storage, transport, and event-stream handling.
- `apps/cli/src/*` owns the `whlol` command-line client. Keep CLI request
  shaping, API transport, SSE parsing, local delivery, and command orchestration
  inside the CLI package instead of sharing browser-only code.
- `components/ui/*` contains shadcn/Radix-derived primitives. Extend them
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

- Redis-backed admission control protects endpoint creation, webhook capture
  request counts, captured body bytes, and live event-stream connection leases.
  Keep admission checks before expensive work such as body reads when possible.
- Policies live in `lib/webhooks/policies.ts`, admission in
  `lib/webhooks/admission-control.ts`, and Redis primitives in
  `lib/rate-limits/*`.
- Event streams use Redis leases; renew with heartbeats and release on cleanup.
- Preserve CORS and no-store response behavior for capture endpoints.
- Browser preflight requests should not be saved as webhook traffic.
- Publish live request events only after persistence succeeds.
- Be careful with binary payloads: text display and base64 storage are separate
  concerns.
- Endpoint forwarding creates queued deliveries after capture persistence.
  Forwarding workers must preserve original method, forwardable headers, body
  bytes, path mode, and query semantics while rejecting unsafe target URLs.
- Request retention must not delete captured requests with pending forwarding
  deliveries. Requests marked for deletion after forwarding should be pruned only
  after all pending deliveries for that request are no longer pending.
- Request replay creates a new captured request for the same endpoint and should
  not enqueue endpoint-forwarding deliveries unless that behavior is explicitly
  changed.

## File Organization

- Add a new file when it creates a real module boundary or clarifies a durable
  responsibility.
- Extend an existing module when the new behavior is tightly related and not
  meaningfully reusable on its own.
- Choose names that describe domain responsibility, not the incidental task that
  led to the file.
- Before creating general-purpose helpers, look for a feature, domain, or layer
  where the behavior belongs.
