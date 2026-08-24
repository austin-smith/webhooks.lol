import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"

import { diffGraphs, evaluateRailwayFile, validateGraph } from "railway/iac"

const configurationFile = fileURLToPath(
  new URL("./railway.ts", import.meta.url)
)

const expectedResourceAddresses = [
  "database.Postgres",
  "database.Redis",
  "service.docs",
  "service.pgboss",
  "service.web",
  "volume.postgres-volume",
  "volume.redis-volume",
]
const preservedWebVariables = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_EMAIL_API_TOKEN",
  "EMAIL_FROM_ADDRESS",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TRUSTED_CLIENT_IP_HEADER",
  "TURNSTILE_SECRET_KEY",
] as const

for (const environment of ["develop", "production"] as const) {
  const { desiredConfig, graph } = await evaluateRailwayFile(
    configurationFile,
    {
      context: {
        command: "validate",
        environment,
        environmentName: environment,
        projectName: "webhooks.lol",
      },
    }
  )

  assert.deepEqual(validateGraph(graph), [])
  assert.equal(graph.project.name, "webhooks.lol")
  assert.deepEqual(
    graph.resources.map((resource) => resource.address).sort(),
    expectedResourceAddresses
  )

  const resources = new Map(
    graph.resources.map((resource) => [resource.address, resource])
  )
  const graphWeb = resources.get("service.web")
  const graphDocs = resources.get("service.docs")
  const graphPgboss = resources.get("service.pgboss")
  const graphPostgres = resources.get("database.Postgres")
  const graphRedis = resources.get("database.Redis")
  const graphPostgresVolume = resources.get("volume.postgres-volume")
  const graphRedisVolume = resources.get("volume.redis-volume")

  assert.equal(graphWeb?.type, "service")
  assert.equal(graphDocs?.type, "service")
  assert.equal(graphPgboss?.type, "service")
  assert.equal(graphPostgres?.type, "database")
  assert.equal(graphRedis?.type, "database")
  assert.equal(graphPostgresVolume?.type, "volume")
  assert.equal(graphRedisVolume?.type, "volume")

  assert.equal(graphWeb.source?.repo, "austin-smith/webhooks.lol")
  assert.equal(graphWeb.source?.branch, "main")
  assert.equal(graphWeb.source?.rootDirectory, undefined)
  assert.deepEqual(graphWeb.build?.watchPatterns, [
    "**",
    "!/apps/cli/**",
    "!/apps/docs/**",
    "!/apps/pgboss/**",
  ])
  assert.equal(graphWeb.deploy?.runtime, "V2")
  assert.equal(graphWeb.deploy?.restartPolicyType, "ON_FAILURE")
  assert.equal(graphWeb.deploy?.restartPolicyMaxRetries, 10)
  assert.deepEqual(graphWeb.deploy?.multiRegionConfig, {
    "us-west2": { numReplicas: 1 },
  })
  assert.deepEqual(Object.keys(graphWeb.variables ?? {}).sort(), [
    "APP_ENV",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_EMAIL_API_TOKEN",
    "DATABASE_URL",
    "EMAIL_FROM_ADDRESS",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_DOCS_URL",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "REDIS_URL",
    "TRUSTED_CLIENT_IP_HEADER",
    "TURNSTILE_SECRET_KEY",
  ])
  for (const variable of preservedWebVariables) {
    assert.deepEqual(graphWeb.variables?.[variable], { type: "preserve" })
  }
  assert.deepEqual(graphWeb.variables?.DATABASE_URL, {
    type: "reference",
    resource: "database.Postgres",
    output: "DATABASE_URL",
  })
  assert.deepEqual(graphWeb.variables?.REDIS_URL, {
    type: "reference",
    resource: "database.Redis",
    output: "REDIS_URL",
  })

  assert.equal(graphDocs.source?.repo, "austin-smith/webhooks.lol")
  assert.equal(graphDocs.source?.branch, "main")
  assert.equal(graphDocs.source?.rootDirectory, undefined)
  assert.deepEqual(graphDocs.build?.watchPatterns, [
    "**",
    "!/apps/cli/**",
    "!/apps/pgboss/**",
    "!/apps/web/**",
  ])
  assert.deepEqual(Object.keys(graphDocs.variables ?? {}).sort(), [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_DOCS_URL",
  ])

  assert.equal(graphPgboss.source?.repo, "austin-smith/webhooks.lol")
  assert.equal(graphPgboss.source?.branch, "main")
  assert.equal(graphPgboss.source?.rootDirectory, undefined)
  assert.deepEqual(graphPgboss.build?.watchPatterns, [
    "**",
    "!/apps/cli/**",
    "!/apps/docs/**",
    "!/apps/web/**",
  ])
  assert.deepEqual(Object.keys(graphPgboss.variables ?? {}), ["DATABASE_URL"])
  assert.deepEqual(graphPgboss.variables?.DATABASE_URL, {
    type: "reference",
    resource: "database.Postgres",
    output: "DATABASE_URL",
  })

  assert.equal(
    graphPostgres.image,
    "ghcr.io/railwayapp-templates/postgres-ssl:18"
  )
  assert.equal(graphPostgres.defaultMountPath, "/var/lib/postgresql/data")
  assert.equal(graphRedis.image, "redis:8")
  assert.equal(graphRedis.defaultMountPath, "/data")
  assert.equal(graphPostgresVolume.config?.region, "us-west2")
  assert.equal(graphPostgresVolume.config?.sizeMB, 50_000)
  assert.equal(graphRedisVolume.config?.region, "us-west2")
  assert.equal(graphRedisVolume.config?.sizeMB, 50_000)

  const autoUpdatedGraph = structuredClone(graph)
  for (const resource of autoUpdatedGraph.resources) {
    const pointRelease =
      resource.address === "database.Postgres"
        ? "ghcr.io/railwayapp-templates/postgres-ssl:18.6"
        : resource.address === "database.Redis"
          ? "redis:8.2.1"
          : undefined

    if (resource.type !== "database" || pointRelease === undefined) {
      continue
    }

    resource.image = pointRelease
    resource.source = {
      ...resource.source,
      type: "image",
      image: pointRelease,
      autoUpdates: { type: "minor", tagMode: "semver" },
    }
  }

  const databaseDrift = diffGraphs({
    current: autoUpdatedGraph,
    desired: graph,
  }).changes
  assert.deepEqual(databaseDrift, [])

  const web = desiredConfig.services?.web
  const docs = desiredConfig.services?.docs
  const pgboss = desiredConfig.services?.pgboss

  assert.equal(web?.build?.buildCommand, "pnpm web:build")
  assert.deepEqual(web?.deploy?.preDeployCommand, ["pnpm db:migrate"])
  assert.equal(web?.deploy?.startCommand, "pnpm web:start")
  assert.equal(docs?.build?.buildCommand, "pnpm docs:build")
  assert.equal(docs?.deploy?.startCommand, "pnpm docs:start")
  assert.equal(pgboss?.build?.buildCommand, "pnpm pgboss:build")
  assert.equal(pgboss?.deploy?.startCommand, "pnpm pgboss:start")

  const expectedWebDomain =
    environment === "production" ? "webhooks.lol" : "dev.webhooks.lol"
  const expectedDocsDomain =
    environment === "production" ? "docs.webhooks.lol" : "dev-docs.webhooks.lol"

  assert.deepEqual(Object.keys(web?.networking?.customDomains ?? {}), [
    expectedWebDomain,
  ])
  assert.deepEqual(Object.keys(docs?.networking?.customDomains ?? {}), [
    expectedDocsDomain,
  ])
  assert.equal(web?.variables?.APP_ENV?.value, environment)
}

await assert.rejects(
  evaluateRailwayFile(configurationFile, {
    context: {
      command: "validate",
      environment: "staging",
      environmentName: "staging",
      projectName: "webhooks.lol",
    },
  }),
  /Unsupported Railway environment: staging/
)
