# Auth

Auth is for admin capability, not for ordinary webhook endpoint use.

The public app remains disposable and anonymous. Anyone can create an endpoint,
send webhook traffic to it, and inspect endpoints remembered by their own browser
session. Signing in must not become a requirement for that core workflow.

## Current Model

- GitHub is the only sign-in provider because the app is developer-focused.
- Auth gates `/admin`, not webhook endpoint creation or inspection.
- The first GitHub user created on a fresh deployment becomes the admin.
- After that first user exists, public signup is closed for this release.
- Existing linked GitHub accounts can still sign in.

This gives a deployment owner a way to access app-wide activity without turning
the disposable webhook product into an account-based product too early.

## Admin

Admin means app-wide visibility and control. It is separate from endpoint access.

Current admin access is intentionally narrow:

- `/admin` requires a valid session.
- The signed-in user must have the standard Better Auth `admin` role.
- The database enforces a single admin role so concurrent first sign-ins cannot
  accidentally create multiple admins.

Do not add custom role tables, setup-token flows, hardcoded admin IDs, owner
tables, or bootstrap scripts unless the product design changes first.

## Future Direction

The current signup policy describes this version of the product. It is not a
permanent claim that only one account can ever exist.

User accounts should be added only when the product needs authenticated user
ownership. Until then, auth stays limited to admin access and must not leak into
the anonymous endpoint workflow.
