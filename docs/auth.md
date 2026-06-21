# Auth

Auth is optional for ordinary webhook endpoint use and required for account
portability.

Anonymous users can still create disposable endpoints, send webhook traffic to
them, and inspect endpoints remembered by their own browser session. Signed-in
users get account-owned endpoints that follow the user across browsers and
sessions.

## Account Model

- Email/password signup is open to users.
- Users sign in at `/login` and create accounts at `/sign-up`.
- New email/password accounts must verify their email before signing in.
- Email verification links redirect to `/email-verified`, which shows an
  explicit success or failure result before returning the user to sign-in.
- Users who forget an email/password credential can request a reset link from
  `/forgot-password`. The public request result is intentionally generic and
  does not reveal whether the email exists, whether it is GitHub-only, or
  whether email delivery happened.
- Password reset links redirect to `/reset-password`. Reset tokens are created
  and consumed by Better Auth through the standard `auth.verification` table,
  expire after one hour, and revoke existing sessions after a successful reset.
- GitHub OAuth is a normal sign-in/sign-up provider.
- Auth methods are not linked together. An account is either email/password or
  GitHub for sign-in purposes; users are not offered a flow to add another
  provider to an existing account.
- The account page offers password reset only for email/password accounts.
  GitHub accounts use GitHub for sign-in and do not get a password reset or
  password creation flow.
- The first user created on a fresh deployment receives the Better Auth `admin`
  role. Later users receive the standard `user` role regardless of provider.
- Signed-in endpoint creation stores the Better Auth user ID on the endpoint.
- Signed-in users keep up to 50 account-owned endpoints. Creating another
  endpoint succeeds and removes the least recently active account-owned
  endpoint.
- Account-owned endpoint reads and mutations require the owning user session.
- Anonymous endpoint creation does not attach an owner and remains browser-local
  from the product perspective. Anonymous browser endpoint retention uses a
  private browser session cookie.
- Deleting a user deletes that user's account-owned endpoints; owned endpoints
  must not become anonymous endpoints.

Historical anonymous endpoint claiming is intentionally not part of the current
model. Existing anonymous endpoints stay anonymous unless a future product
design explicitly introduces a claiming flow.

## Endpoint Access

Inbound webhook capture remains public-by-endpoint-ID so webhook providers can
deliver requests without a browser session.

Inspector and mutation APIs enforce endpoint ownership:

- Anonymous endpoints are accessible by endpoint ID, matching the existing
  disposable workflow.
- Account-owned endpoints are visible only to the owning Better Auth user.
- The current `whlol` CLI protocol supports anonymous endpoints only; account-
  owned endpoint CLI access needs a dedicated CLI authentication or
  endpoint-token flow.
- The signed-in endpoint list is loaded from the server and is the source of
  truth for account-backed browser sessions.
- Browser localStorage is used only as a convenience for endpoint selection; it
  is not an authorization boundary.

## Admin

Admin means app-wide visibility and control. It is separate from endpoint
ownership.

Current admin access remains narrow:

- `/admin` requires a valid session.
- The signed-in user must have the standard Better Auth `admin` role.
- Admin role checks use Better Auth's user fields, not custom role tables.
- Fresh deployments bootstrap admin access through the first user, regardless of
  provider.

Do not add custom auth, role, setup-token, ownership, or bootstrap tables unless
a Better Auth-supported feature and product design require them.

## Auth Configuration

Sign-up and sign-in require auth runtime configuration, provider configuration,
captcha configuration, and outbound email delivery. This is not production-only:
every deployed environment that exposes auth flows must configure values for that
environment. Local development must also provide these values when exercising
auth flows, but can use local URLs, test OAuth apps, Turnstile test keys, and
sandbox email sender addresses.

Auth uses the standard Better Auth tables in the `auth` PostgreSQL schema. The
app-owned endpoint ownership data remains in the `public` schema.

### Required Variables

- `BETTER_AUTH_SECRET`: Better Auth secret for signing and encryption. Use a
  unique high-entropy value per environment.
- `BETTER_AUTH_URL`: Canonical web app origin used by Better Auth for auth URLs
  and callbacks, such as `https://webhooks.lol` or `http://localhost:4665`.
- `NEXT_PUBLIC_APP_URL`: Canonical public web app origin used by app-generated
  links.
- `GITHUB_CLIENT_ID`: GitHub OAuth app client ID for this environment.
- `GITHUB_CLIENT_SECRET`: GitHub OAuth app client secret for this environment.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: Cloudflare Turnstile site key rendered by
  auth forms.
- `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile secret key verified by the auth
  server.
- `APP_ENV`: Environment label used in outbound auth email sender names.
  `production` sends as `webhooks.lol`; any other value sends as
  `webhooks.lol (<APP_ENV>)`, such as `webhooks.lol (staging)`.
- `EMAIL_FROM_ADDRESS`: Outbound sender address for auth email.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID used for Email Sending.
- `CLOUDFLARE_EMAIL_API_TOKEN`: Scoped Cloudflare API token with Email Sending
  permission.

### Email Delivery

Email/password auth requires outbound email for email verification and password
reset links. The app sends these messages through Cloudflare Email Sending.

The sender domain in `EMAIL_FROM_ADDRESS` must be onboarded in Cloudflare Email
Sending before auth email can be delivered. Use a scoped Cloudflare API token
with Email Sending permission, not a personal Wrangler OAuth token.

Password reset link email is sent only for accounts that already have an
email/password credential. GitHub-only accounts must sign in with GitHub. After
an email/password reset succeeds, the app sends a security notification email to
the account address.

Local development should use an onboarded sandbox sender address and real test
recipient addresses controlled by the developer.
