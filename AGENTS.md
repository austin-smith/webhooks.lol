# AGENTS.md

## Project Overview

`webhooks.lol` is a small webhook inbox built with Next.js App Router,
React, TypeScript, Tailwind CSS, shadcn/Radix UI, Drizzle ORM, PostgreSQL, and
Vitest. It creates private inbox URLs, captures inbound HTTP requests, stores
them in PostgreSQL, and streams live updates into a compact browser inspector.

Important domain terms are defined in `CONTEXT.md`. Read it before changing
webhook capture, persistence, event streaming, or browser inbox-session code.

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
- Apply migrations: `pnpm db:migrate`
- Start the dev server: `pnpm dev`

The dev server runs on `http://localhost:4665`.

For non-local environments, set `DATABASE_URL` to the target PostgreSQL database
and run `pnpm db:migrate` before starting the app.

## Development Workflow

- Package manager: use `pnpm`; do not switch to npm, yarn, or bun.
- Dev server: `pnpm dev`
- Production build: `pnpm build`
- Production start after build: `pnpm start`
- Full local verification: `pnpm verify`
- Format TypeScript and TSX files: `pnpm format`

Keep route handlers and server-only modules on the Node.js runtime when they use
database access, `Buffer`, streams, or other Node-specific APIs.

## Database Workflow

- Schema lives in `lib/database/schema.ts`.
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
tested without Next's runtime guard blocking imports.

Add or update focused tests for changed behavior. Repository and route-boundary
changes should cover persistence rules, request parsing, error responses, and
event publishing behavior as appropriate. Client session changes should cover
state helpers, storage normalization, event-stream handling, and transport
behavior.

Do not add tests just to tick a coverage box. Tests should protect meaningful
behavior, invariants, and ownership boundaries that would matter in a regression.
Prefer concise table-driven coverage for input/output rules over narrow examples
that only mirror the current implementation or assert third-party library
internals.

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
- `lib/webhooks/repository.ts` owns inbox and captured-request persistence.
- `lib/webhooks/inbox-event-stream.ts` owns live inbox event-stream behavior.
- `lib/webhooks/api-contracts.ts` owns shared API response shapes used across
  routes and client transport code.
- `components/webhook-inspector/inbox-session/*` owns browser-side inbox session
  state, storage, transport, and event-stream handling.
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

- Preserve CORS and no-store response behavior for capture endpoints.
- Browser preflight requests should not be saved as webhook traffic.
- Publish live request events only after persistence succeeds.
- Be careful with binary payloads: text display and base64 storage are separate
  concerns.

## File Organization

- Add a new file when it creates a real module boundary or clarifies a durable
  responsibility.
- Extend an existing module when the new behavior is tightly related and not
  meaningfully reusable on its own.
- Choose names that describe domain responsibility, not the incidental task that
  led to the file.
- Before creating general-purpose helpers, look for a feature, domain, or layer
  where the behavior belongs.
