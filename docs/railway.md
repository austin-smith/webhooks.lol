# Railway Deployment

This repository uses Railway config-as-code for each deployable app service.
Because this is a shared pnpm workspace, keep each Railway service rooted at the
repository root and point the service at its own app-local config file.

## Services

| Railway service | Config file                 |
| --------------- | --------------------------- |
| `web`           | `/apps/web/railway.json`    |
| `docs`          | `/apps/docs/railway.json`   |
| `pgboss`        | `/apps/pgboss/railway.json` |

Do not add a root `railway.json`. The services have different build commands,
start commands, migration behavior, and watch patterns.

## Source Settings

Keep these settings in Railway service configuration:

- GitHub repository: `austin-smith/webhooks.lol`
- Branches:
  - `develop` environment: `cli`
  - `production` environment: `main`
- Root directory: unset
- Custom config file path: the app-local path from the services table
- Domains, variables, and managed database services

## App Environment Identity

The web app uses its provider-independent `APP_ENV` variable to identify the
deployment. Set it explicitly in each Railway environment:

| Railway environment | `APP_ENV` value |
| ------------------- | --------------- |
| `develop`           | `develop`       |
| `production`        | `production`    |

Do not derive `APP_ENV` from Railway-provided environment metadata. Keeping the
application contract provider-independent makes the same configuration work in
local development and on other deployment platforms. The production value is
the only value that suppresses the environment badge in the web app.

The badge's detail popover uses provider-independent build metadata variables.
For GitHub-triggered Railway deployments, define these aliases on the web
service so the application remains decoupled from Railway's variable names:

| Application variable       | Railway value                     |
| -------------------------- | --------------------------------- |
| `APP_BUILD_BRANCH`         | `${{RAILWAY_GIT_BRANCH}}`         |
| `APP_BUILD_COMMIT_SHA`     | `${{RAILWAY_GIT_COMMIT_SHA}}`     |
| `APP_BUILD_COMMIT_SUBJECT` | `${{RAILWAY_GIT_COMMIT_MESSAGE}}` |

`APP_BUILD_AT` and `APP_BUILD_DIRTY` are optional build-time overrides. The
build timestamp defaults to the time the web build starts, and provider builds
default to a clean working tree. Local builds discover all five values directly
from Git. If neither a complete provider identity nor Git metadata is available,
the environment badge remains visible without the detail popover.

Keep these settings in the app-local `railway.json` files:

- Railpack builder
- Build command
- Watch patterns
- Start command
- Pre-deploy command
- Runtime
- Restart policy
- Replica region

## Rollout Order

1. Commit and push the app split and the three `railway.json` files to `cli`.
2. Set `configFile` in the `develop` environment:

   ```bash
   railway environment edit \
     --project 9a83bf30-61bb-4e76-a097-2ca6ee86bff2 \
     --environment develop \
     --service-config web configFile /apps/web/railway.json

   railway environment edit \
     --project 9a83bf30-61bb-4e76-a097-2ca6ee86bff2 \
     --environment develop \
     --service-config docs configFile /apps/docs/railway.json

   railway environment edit \
     --project 9a83bf30-61bb-4e76-a097-2ca6ee86bff2 \
     --environment develop \
     --service-config pgboss configFile /apps/pgboss/railway.json
   ```

3. Deploy and verify `develop`.
4. Merge or promote the same app split and config files to `main`.
5. Set `configFile` in the `production` environment:

   ```bash
   railway environment edit \
     --project 9a83bf30-61bb-4e76-a097-2ca6ee86bff2 \
     --environment production \
     --service-config web configFile /apps/web/railway.json

   railway environment edit \
     --project 9a83bf30-61bb-4e76-a097-2ca6ee86bff2 \
     --environment production \
     --service-config docs configFile /apps/docs/railway.json

   railway environment edit \
     --project 9a83bf30-61bb-4e76-a097-2ca6ee86bff2 \
     --environment production \
     --service-config pgboss configFile /apps/pgboss/railway.json
   ```

6. Deploy and verify `production`.

Do not set `configFile` before the referenced files exist on the branch Railway
deploys. A service configured with a missing config file path is harder to reason
about than the old dashboard-only configuration.

## Verification

After each environment is updated, verify the stored Railway service config:

```bash
railway environment config --environment develop --json
railway environment config --environment production --json
```

Each app service should report its expected `configFile` path.

Then verify deployment behavior from the latest deployment details or logs:

- `web` builds with `pnpm web:build`.
- `web` runs migrations with `pnpm db:migrate`.
- `web` starts with `pnpm web:start`.
- `docs` builds with `pnpm docs:build`.
- `docs` starts with `pnpm docs:start`.
- `pgboss` builds with `pnpm pgboss:build`.
- `pgboss` starts with `pnpm pgboss:start`.
