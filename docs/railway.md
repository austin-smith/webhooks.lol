# Railway Deployment

This repository defines the `webhooks.lol` Railway project in
`.railway/railway.ts`. Railway evaluates the same project graph separately for
the `develop` and `production` environments.

Infrastructure as Code is the source of truth for:

- the `web`, `docs`, and `pgboss` application services;
- the `Postgres` and `Redis` database services;
- the `postgres-volume` and `redis-volume` persistent volumes;
- GitHub sources, build commands, deploy commands, regions, and replicas;
- custom domains, private-network endpoint names, and service variables.

Keep every GitHub service rooted at the repository root. The application build
commands use the root Turbo-backed scripts so compiled workspace dependencies
are available on clean builds.

## Tooling

The repository exact-pins the Railway TypeScript SDK used to evaluate the IaC
graph. Install the Railway CLI from Railway's official distribution rather than
adding its npm wrapper to this workspace. Update it immediately before a
cutover, confirm that it supports `config plan` and `config apply`, and record
the version used in the change record:

```bash
railway --version
```

Validate the TypeScript graph for both environments without connecting to
Railway:

```bash
pnpm railway:check
```

Application verification and Railway infrastructure validation are separate
checks. Run `pnpm verify` for the workspace and `pnpm railway:check` for the
Railway graph.

## Environment Configuration

Both Railway environments currently deploy the `main` branch. Changing branch
strategy is a separate infrastructure decision and must not be combined with
the Config as Code migration.

| Environment  | Web URL                    | Docs URL                        | `APP_ENV`    |
| ------------ | -------------------------- | ------------------------------- | ------------ |
| `develop`    | `https://dev.webhooks.lol` | `https://dev-docs.webhooks.lol` | `develop`    |
| `production` | `https://webhooks.lol`     | `https://docs.webhooks.lol`     | `production` |

The web app uses the provider-independent `APP_ENV` variable to identify the
deployment. Do not derive it from Railway metadata. Railway's Git metadata is
used only for build provenance.

Application secrets remain stored in Railway. The IaC graph names each secret
with `preserve()` so plans retain its existing value without writing it to the
repository or printing it. Database connection variables use typed references
to the `Postgres` and `Redis` resources.

If a plan proposes deleting any existing variable, stop. Reconcile the missing
variable in `.railway/railway.ts` before applying.

## Application Deployment Contracts

| Service  | Build command       | Pre-deploy command | Start command       |
| -------- | ------------------- | ------------------ | ------------------- |
| `web`    | `pnpm web:build`    | `pnpm db:migrate`  | `pnpm web:start`    |
| `docs`   | `pnpm docs:build`   | none               | `pnpm docs:start`   |
| `pgboss` | `pnpm pgboss:build` | none               | `pnpm pgboss:start` |

All three services use Railpack, the Railway V2 runtime, one `us-west2`
replica, and an `ON_FAILURE` restart policy with ten retries.

## Database Image Policy

Database image sources specify major versions only. PostgreSQL uses Railway's
official IaC helper for PostgreSQL 18. Redis uses the official Redis 8 image
with the existing `/data` mount; Railway's Redis helper is intentionally not
used because it defines a different image and `/bitnami` mount contract.

When enabled in Railway, image auto-updates may advance database point releases
within those major versions. The pinned IaC SDK treats same-major database
images as equivalent, so a plan does not roll an auto-updated point release
back. Major-version upgrades require a separate, reviewed IaC change with a
database-specific migration and rollback plan.

## Cutover Procedure

Migrate `develop` completely before touching `production`. Freeze merges and
deployments during each environment's cutover so no deployment starts between
clearing the legacy Config File settings and applying IaC.

Do not merge the IaC pull request until both environments have completed this
procedure and a second plan for each environment reports no changes. The
currently deployed `main` branch retains the old Config as Code files throughout
the cutover; merging the pull request removes them.

The Railway project ID is `9a83bf30-61bb-4e76-a097-2ca6ee86bff2`.

### 1. Prepare the local context

Check out the reviewed pull-request commit containing `.railway/railway.ts`.
Authenticate and select the target project and environment:

```bash
railway login
railway link --project 9a83bf30-61bb-4e76-a097-2ca6ee86bff2
railway environment link develop
pnpm railway:check
```

Capture the current environment configuration before changing anything:

```bash
railway environment config --environment develop --json
```

Store the snapshot in an approved secure location. It can contain configuration
that should not be committed.

### 2. Clear legacy Config File settings

In the Railway dashboard for the target environment, clear the Config File
setting for exactly these services:

| Service  | Legacy value                |
| -------- | --------------------------- |
| `web`    | `/apps/web/railway.json`    |
| `docs`   | `/apps/docs/railway.json`   |
| `pgboss` | `/apps/pgboss/railway.json` |

Do not alter build, deploy, source, variable, networking, database, or volume
settings during this step.

### 3. Review the plan

Run a full, redacted plan immediately after clearing the three settings:

```bash
railway config plan --file .railway/railway.ts --verbose
```

The plan is acceptable only when all of the following are true:

- there are no service, database, or volume deletions;
- there are no database replacements or volume detachments;
- there are no variable deletions;
- the only application command changes establish the contracts listed above;
- the only domain values are the expected domains for the target environment;
- `Postgres` and `Redis` remain in `us-west2` with their existing volumes;
- no unrelated infrastructure changes appear.

If any criterion fails, stop and restore the three Config File settings. Fix the
IaC definition in the pull request and complete review and validation again
before attempting the cutover.

### 4. Apply interactively

Apply only the reviewed plan:

```bash
railway config apply --file .railway/railway.ts
```

Do not use `--yes` for the initial migration. Do not use
`--confirm-destructive`; an ordinary migration must contain no destructive
changes. Railway recalculates the plan immediately before applying, so review
the final prompt as carefully as the first plan.

### 5. Verify the environment

Read the stored configuration and verify deployment behavior:

```bash
railway environment config --environment develop --json
railway service list --json
```

Verify all of the following before ending the deployment freeze:

- `web`, `docs`, `pgboss`, `Postgres`, and `Redis` are healthy;
- web migrations completed successfully;
- the web and docs domains return the expected environment;
- webhook capture persists requests and streams live updates;
- endpoint forwarding is processed by `pgboss`;
- PostgreSQL and Redis use their existing data volumes;
- a second `railway config plan` reports no changes.

Repeat the complete procedure for `production`, replacing `develop` in the
environment commands. Do not proceed to production unless develop is healthy
and has a clean second plan.

After both environments are healthy and have clean plans, merge the exact
reviewed pull request. Run one final plan against `main` for each environment to
confirm that the repository and Railway remain in sync.

## Ongoing Changes and Drift

For every Railway infrastructure change:

1. edit `.railway/railway.ts`;
2. run `pnpm railway:check`;
3. review `railway config plan` for the intended environment;
4. apply interactively after approval;
5. verify service health and run a second plan that reports no changes.

Treat dashboard edits as emergency changes only. Reconcile an emergency edit
back into `.railway/railway.ts` immediately. Never put secret values in the IaC
file, command arguments, CI logs, or documentation.

## Rollback

Before the pull request is merged, restore the three Config File settings for
the affected environment and redeploy `main` if the IaC cutover cannot be
completed safely.

To roll back the initial migration after merge, revert this pull request,
restore the three Config File settings, and redeploy `main`. For later IaC
changes, revert to the last known-good infrastructure definition, review the
resulting plan, apply it interactively, and verify the environment. Never use an
unreviewed dashboard edit as the permanent rollback state.
