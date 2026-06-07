# Security Best Practices Audit Report

Audit date: 2026-06-06

Scope: Next.js App Router, React/TypeScript frontend, Better Auth integration,
Drizzle/PostgreSQL persistence, webhook capture routes, browser inbox session
state, and production dependency advisory posture.

## Executive Summary

No critical vulnerabilities were found in this pass. The app uses random UUID
inbox tokens, keeps database access behind server-only modules, uses Drizzle
query builders/parameterized SQL, gates `/admin` with server-side Better Auth
session and role checks, sets secure cookies in production, and avoids obvious
client-side token storage for auth.

The highest-risk issues are public resource-control gaps. Anonymous endpoints
can create inboxes, persist webhook traffic, and hold SSE connections without
visible app-level rate limits, quotas, token validation, or connection caps. For
a public webhook inbox, those controls are part of the security boundary because
attackers can turn the intended anonymous workflow into database, CPU, memory,
or connection exhaustion.

Dependency scanning with `pnpm audit --prod` found two moderate advisories:
`postcss < 8.5.10` through `next@16.2.6`, and `esbuild <= 0.24.2` through the
Drizzle tooling dependency path. The current `next@16.2.6` line appears patched
for the May 2026 Next.js advisories checked during this audit, but the PostCSS
transitive advisory remains visible in the production audit result.

## Critical Findings

No critical findings were identified.

## High Findings

### SEC-001: Anonymous write and stream endpoints lack app-level rate limits and quotas

- Rule ID: NEXT-DOS-001 / NEXT-LIMITS-001
- Severity: High
- Location:
  - `app/api/inboxes/route.ts`, `POST`, lines 8-13
  - `app/api/hook/[token]/[[...path]]/route.ts`, capture exports, lines 46-53
  - `lib/webhooks/inbound-capture.ts`, body limit only, lines 10 and 137-142
  - `lib/webhooks/repository.ts`, per-inbox retention only, lines 12 and 69-81
  - `app/api/inboxes/[token]/events/route.ts`, `GET`, lines 7-16
  - `lib/webhooks/inbox-event-stream.ts`, unlimited listeners, lines 19-23 and 112-116
- Evidence:

```ts
// app/api/inboxes/route.ts
export async function POST() {
  const response = {
    token: await createInbox(),
  } satisfies CreateInboxResponse

  return Response.json(response, { headers: NO_STORE_HEADERS })
}
```

```ts
// app/api/hook/[token]/[[...path]]/route.ts
export {
  capture as DELETE,
  capture as GET,
  capture as HEAD,
  capture as PATCH,
  capture as POST,
  capture as PUT,
}
```

```ts
// lib/webhooks/inbox-event-stream.ts
events.setMaxListeners(0)
...
events.on(REQUEST_EVENT, onRequest)
events.on(CLEAR_EVENT, onClear)
```

- Impact: A remote unauthenticated attacker can create many inboxes, write many
  retained requests, and hold many event streams, potentially exhausting
  database storage, Node memory, CPU, or available connections.
- Fix:
  - Add app-level rate limits for `/api/inboxes`, `/api/hook/**`, and
    `/api/inboxes/[token]/events`.
  - Add per-token and global quotas for inbox count, retained bytes, request
    rate, and concurrent event streams.
  - Enforce infrastructure limits at the reverse proxy or platform edge for
    request rate, body size, header size, request duration, and SSE connection
    count.
- Mitigation:
  - Keep the 1 MiB body limit and 500-request retention cap, but treat them as
    partial controls only. They do not limit inbox cardinality, connection
    count, request frequency, or aggregate database growth.
- False positive notes:
  - This may be partly handled by hosting infrastructure, CDN, or WAF policy,
    but no such configuration is visible in this repository. Verify deployed
    edge controls separately.

### SEC-002: Inbox token and route-derived values are not validated or bounded before persistence and transport use

- Rule ID: NEXT-INPUT-001 / REACT-URL-001
- Severity: High
- Location:
  - `app/api/hook/[token]/[[...path]]/route.ts`, route token read, lines 7-12
  - `app/api/inboxes/[token]/requests/route.ts`, token read and write-through
    behavior, lines 13-19 and 26-35
  - `app/api/inboxes/[token]/events/route.ts`, token read, lines 7-16
  - `lib/webhooks/repository.ts`, `ensureInbox(token)` on read/delete and text
    primary key persistence, lines 20-28, 87-105
  - `lib/database/public-schema.ts`, unbounded text columns, lines 11-37
  - `components/webhook-inspector/inbox-session/transport.ts`, token inserted
    into URLs without `encodeURIComponent`, lines 22-25 and 44-47
  - `components/webhook-inspector/inbox-session/event-stream.ts`, token inserted
    into EventSource URL without `encodeURIComponent`, lines 20-22
  - `components/webhook-inspector/inbox-session/state.ts`, storage token
    normalization accepts any non-empty string, lines 80-89
- Evidence:

```ts
// app/api/inboxes/[token]/requests/route.ts
const { token } = await context.params
const response = {
  token,
  requests: await listRequests(token),
} satisfies RequestsResponse
```

```ts
// lib/webhooks/repository.ts
export async function ensureInbox(token: string) {
  await getDatabase()
    .insert(inboxes)
    .values({
      token,
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: inboxes.token })
}
```

```ts
// components/webhook-inspector/inbox-session/transport.ts
const response = await fetcher(`/api/inboxes/${token}/requests`, {
  method: "DELETE",
})
```

- Impact: A remote unauthenticated attacker can force arbitrary token strings
  into the database and associated indexes. Very long or malformed route values
  can amplify storage and query costs; tampered browser storage can also produce
  malformed client requests because tokens are interpolated into URL paths
  without encoding.
- Fix:
  - Define a single inbox token validator, preferably UUID-only for generated
    tokens, and reject invalid tokens with `400`.
  - Apply the validator at every route boundary before calling repository or
    event-stream code.
  - Stop creating inbox rows on read/delete for arbitrary token strings; only
    create from the explicit inbox creation or capture flow after validation.
  - Encode path segments in client transport with `encodeURIComponent(token)`.
  - Add bounds for captured path, query keys/values, headers, and body-derived
    display text before persistence.
- Mitigation:
  - Platform URL and header limits reduce some worst cases, but the application
    still needs durable domain limits because route params and storage values are
    attacker-controlled inputs.
- False positive notes:
  - UUID tokens generated by `createInbox()` are strong. The issue is that
    route handlers also accept arbitrary strings and persist them.

## Medium Findings

### SEC-003: Production dependency audit reports known moderate advisories

- Rule ID: NEXT-SUPPLY-001 / REACT-SUPPLY-001
- Severity: Medium
- Location:
  - `package.json`, dependencies, lines 28-43
  - `pnpm-lock.yaml`, `esbuild@0.18.20`, lines 3036-3040 and 7633-7657
  - `pnpm-lock.yaml`, `postcss@8.4.31`, lines 4178-4181 and 8917-8922
- Evidence:

```json
// package.json
"dependencies": {
  "better-auth": "^1.6.14",
  ...
  "next": "16.2.6",
  ...
}
```

`pnpm audit --prod` reported:

```text
moderate: esbuild enables any website to send any requests to the development server and read the response
Package: esbuild
Vulnerable versions: <=0.24.2
Patched versions: >=0.24.3
Path: .>better-auth>drizzle-kit>@esbuild-kit/esm-loader>@esbuild-kit/core-utils>esbuild

moderate: PostCSS has XSS via Unescaped </style> in its CSS Stringify Output
Package: postcss
Vulnerable versions: <8.5.10
Patched versions: >=8.5.10
Paths: .>better-auth>next>postcss and .>next>postcss
```

- Impact: Known vulnerable transitive packages remain in the resolved
  dependency tree. The PostCSS issue is XSS-prone when user-controlled CSS is
  re-stringified into HTML style contexts. The esbuild advisory affects exposed
  development server usage.
- Fix:
  - Upgrade the dependency chain or apply a `pnpm` override to force patched
    `postcss >= 8.5.10` if compatible with Next.js.
  - Upgrade or remove the `@esbuild-kit` dependency path if it remains reachable
    through production dependencies.
  - Re-run `pnpm audit --prod` after dependency changes.
- Mitigation:
  - Do not expose development servers publicly.
  - Avoid parsing/stringifying untrusted CSS into inline `<style>` tags.
- False positive notes:
  - The esbuild path is tooling-oriented and lower risk if dev servers are not
    exposed. The audit command still reports it in the production tree because
    it is pulled through a production dependency path.
  - GitHub's Next.js advisory GHSA-26hh-7cqf-hhc6 lists `16.2.6` as patched for
    the May 7, 2026 middleware/proxy bypass follow-up. This repo uses
    `next@16.2.6`.

### SEC-004: Security headers are incomplete; CSP and clickjacking defenses are not visible in app code

- Rule ID: NEXT-HEADERS-001 / NEXT-CSP-001 / REACT-CSP-001
- Severity: Medium
- Location:
  - `next.config.ts`, only `X-Content-Type-Options`, lines 3-17
  - `app/layout.tsx`, inline `beforeInteractive` script, lines 14-24 and 35-37
  - `components/webhook-inspector/request-data-panels.tsx`, Shiki HTML sink,
    lines 54-63
- Evidence:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ]
  },
}
```

```tsx
// components/webhook-inspector/request-data-panels.tsx
<div
  className={cn("request-code-panel", wrap && "wrap")}
  dangerouslySetInnerHTML={{ __html: highlightedHtml }}
/>
```

- Impact: If an XSS sink is introduced later, or if Shiki/highlighting output is
  ever fed unsafe HTML, the app lacks a visible CSP to reduce script execution
  impact. Missing `frame-ancestors`/`X-Frame-Options` also leaves clickjacking
  protection dependent on unverified infrastructure.
- Fix:
  - Add centrally managed production headers: CSP, `frame-ancestors` or
    `X-Frame-Options`, `Referrer-Policy`, and a restrictive
    `Permissions-Policy`.
  - Prefer a nonce/hash-compatible CSP that accounts for the existing
    `beforeInteractive` theme script.
  - Keep `X-Content-Type-Options: nosniff` and `poweredByHeader: false`.
- Mitigation:
  - The current Shiki path uses fixed languages/themes and React escaping for
    non-highlighted text. That reduces immediate XSS likelihood, but it does not
    replace browser-enforced policy.
- False positive notes:
  - Headers may be set at CDN/edge outside this repo. Verify runtime response
    headers before closing this finding.

### SEC-005: Captured webhook secrets are stored and displayed without redaction or retention policy beyond request count

- Rule ID: NEXT-LOG-001 / REACT-AUTH-001
- Severity: Medium
- Location:
  - `lib/webhooks/inbound-capture.ts`, stores all request headers and body text,
    lines 70-82 and 153-157
  - `lib/webhooks/repository.ts`, persists headers and bodies, lines 53-67
  - `components/webhook-inspector/request-detail.tsx`, headers/body/raw tabs,
    lines 203-218
  - `components/webhook-inspector/request-data-panels.tsx`, header/value
    display, lines 78-116
- Evidence:

```ts
// lib/webhooks/inbound-capture.ts
headers: Object.fromEntries(request.headers.entries()),
bodyText: body.text,
bodyBase64: body.base64,
```

```ts
// lib/webhooks/repository.ts
headers: request.headers,
bodyText: request.bodyText,
bodyBase64: request.bodyBase64,
```

```tsx
// components/webhook-inspector/request-detail.tsx
<TabsContent value="headers" className="min-h-0 flex-1">
  <KeyValueTable values={request.headers} />
</TabsContent>
```

- Impact: Webhook requests commonly include bearer tokens, signatures, cookies,
  API keys, and personal data. Anyone with the inbox token, and any admin user
  with app-wide access, can view captured sensitive material. Database backups
  and operational access also inherit that sensitive data.
- Fix:
  - Decide which sensitive fields should be redacted at rest by default, such as
    `authorization`, `cookie`, `set-cookie`, `x-api-key`, and provider-specific
    secret headers.
  - If full fidelity is required, add explicit product documentation, retention
    controls, and a per-inbox clear/expiry policy based on age and bytes, not
    only count.
  - Consider masking sensitive values in the UI with a deliberate reveal action.
- Mitigation:
  - Keep inbox tokens high entropy and avoid exposing inbox URLs in logs,
    referrers, screenshots, or support artifacts.
- False positive notes:
  - Capturing request headers and bodies is central to a webhook inspector.
    This finding is about secure defaults and lifecycle controls, not about
    removing the feature.

## Low Findings

### SEC-006: IP address attribution trusts spoofable forwarding headers

- Rule ID: NEXT-PROXY-001
- Severity: Low
- Location:
  - `lib/webhooks/inbound-capture.ts`, `readIp`, lines 202-210
  - `lib/admin/dashboard.ts`, admin display of stored IP, lines 19-31
  - `app/admin/page.tsx`, IP rendered in dashboard, lines 84-93 and 115-117
- Evidence:

```ts
// lib/webhooks/inbound-capture.ts
const forwardedFor = request.headers.get("x-forwarded-for")

if (forwardedFor) {
  return forwardedFor.split(",")[0]?.trim() ?? null
}

return request.headers.get("x-real-ip")
```

- Impact: Clients can send spoofed `x-forwarded-for` or `x-real-ip` values
  unless a trusted reverse proxy strips and re-adds those headers. Admin traffic
  attribution can therefore be misleading during abuse investigation.
- Fix:
  - Trust forwarding headers only when the deployment has a known proxy chain
    that removes inbound client-supplied forwarding headers.
  - Prefer platform-provided request IP metadata when available, or document
    that IP is advisory only.
- Mitigation:
  - Display the value as untrusted/advisory in admin tooling until proxy
    behavior is verified.
- False positive notes:
  - This is not currently used for authorization or rate limiting. If it becomes
    a control input, severity increases.

## Positive Security Notes

- `lib/database/client.ts`, `lib/webhooks/inbound-capture.ts`,
  `lib/webhooks/repository.ts`, `lib/webhooks/inbox-event-stream.ts`,
  `lib/admin/dashboard.ts`, `lib/auth/session.ts`, and
  `lib/auth/authorization.ts` use `server-only` guards.
- Admin access is enforced server-side in `app/admin/page.tsx` through
  `requireAdminSession()`, which checks a current Better Auth session and then
  verifies the admin role from the database.
- The admin role has a database uniqueness constraint in
  `lib/database/auth-schema.ts`, lines 31-35, and the migration creates the same
  partial unique index in `drizzle/0001_swift_black_queen.sql`, line 60.
- Session cookies are configured with Better Auth secure-cookie behavior in
  production via `lib/auth/options.ts`, lines 53-60.
- Drizzle query APIs and SQL template parameters are used instead of string-built
  SQL for attacker-controlled values.
- No server actions, `middleware.ts`, `proxy.ts`, filesystem reads/writes,
  subprocess execution, `postMessage`, service worker registration, dynamic
  third-party scripts, or obvious `NEXT_PUBLIC_*` secret exposure were found.
- `.env.local` is present locally but is ignored by `.gitignore`; `git ls-files`
  did not show `.env.local` or `.env.example` as tracked during this audit.

## Verification Performed

- Read project instructions and `CONTEXT.md`.
- Loaded the relevant security references for Next.js server code, React
  frontend code, and general browser JavaScript/TypeScript.
- Enumerated route handlers, auth/session code, repository boundaries, database
  schema, browser inbox-session state, client transport, SSE handling, and UI
  rendering paths.
- Searched for high-signal patterns: raw HTML sinks, DOM sinks, dynamic code
  execution, redirects/navigation, `postMessage`, service workers, filesystem
  access, subprocess execution, server-side fetch, cache/static rendering
  hazards, CORS, cookies, environment variables, and security headers.
- Ran `pnpm audit --prod`. The first sandboxed attempt failed because registry
  network access was blocked; the approved network run completed and reported
  two moderate advisories.
- Checked GitHub's Next.js security advisory list for the current
  `next@16.2.6` posture. GHSA-26hh-7cqf-hhc6 lists `16.2.6` as a patched
  version for the May 7, 2026 follow-up advisory.

## Recommended Fix Order

1. Add app-level rate limits, quotas, and connection caps for anonymous create,
   capture, read/delete, and SSE endpoints.
2. Add strict UUID token validation at every route boundary and encode tokens in
   client-generated URLs.
3. Resolve `pnpm audit --prod` advisories or document accepted residual risk for
   tooling-only paths.
4. Add production security headers, starting with CSP and clickjacking controls.
5. Define a captured-secret retention/redaction policy that matches the product
   risk model.
6. Treat IP forwarding headers as advisory unless the trusted proxy chain is
   documented and enforced.
