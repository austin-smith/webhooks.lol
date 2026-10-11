import assert from "node:assert/strict"

import {
  createRailwayContext,
  project,
  type ProjectDefinition,
  type ResourceNode,
} from "railway/iac"

import railwayProgram from "./railway.ts"

const deploymentEnvironments = ["develop", "production"] as const

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

for (const environment of deploymentEnvironments) {
  const definition = await evaluateProjectDefinition(environment)
  const resources = definition.resources?.flat() ?? []

  assert.equal(definition.name, "webhooks.lol")
  assert.deepEqual(definition.environments, [...deploymentEnvironments])
  assert.deepEqual(
    resources.map((resource) => resource.address).sort(),
    expectedResourceAddresses
  )

  const web = findResource(resources, "service.web", "service")
  const docs = findResource(resources, "service.docs", "service")
  const pgboss = findResource(resources, "service.pgboss", "service")
  const postgres = findResource(resources, "database.Postgres", "database")
  const redis = findResource(resources, "database.Redis", "database")
  const postgresVolume = findResource(
    resources,
    "volume.postgres-volume",
    "volume"
  )
  const redisVolume = findResource(resources, "volume.redis-volume", "volume")

  const expectedWebDomain =
    environment === "production" ? "webhooks.lol" : "dev.webhooks.lol"
  const expectedDocsDomain =
    environment === "production" ? "docs.webhooks.lol" : "dev-docs.webhooks.lol"

  assert.equal(web.source?.repo, "austin-smith/webhooks.lol")
  assert.equal(web.source?.branch, "main")
  assert.equal(web.source?.rootDirectory, undefined)
  assert.equal(web.build?.buildCommand, "pnpm web:build")
  assert.deepEqual(web.build?.watchPatterns, [
    "**",
    "!/apps/cli/**",
    "!/apps/docs/**",
    "!/apps/pgboss/**",
  ])
  assert.equal(web.deploy?.runtime, "V2")
  assert.equal(web.deploy?.restartPolicyType, "ON_FAILURE")
  assert.equal(web.deploy?.restartPolicyMaxRetries, 10)
  assert.deepEqual(web.deploy?.multiRegionConfig, {
    "us-west2": { numReplicas: 1 },
  })
  assert.deepEqual(web.deploy?.preDeployCommand, ["pnpm db:migrate"])
  assert.equal(web.deploy?.startCommand, "pnpm web:start")
  assert.deepEqual(Object.keys(web.networking?.customDomains ?? {}), [
    expectedWebDomain,
  ])
  assert.deepEqual(Object.keys(web.variables ?? {}).sort(), [
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
    assert.deepEqual(web.variables?.[variable], { type: "preserve" })
  }
  assert.deepEqual(web.variables?.APP_ENV, {
    type: "literal",
    value: environment,
  })
  assert.deepEqual(web.variables?.DATABASE_URL, {
    type: "reference",
    resource: "database.Postgres",
    output: "DATABASE_URL",
  })
  assert.deepEqual(web.variables?.REDIS_URL, {
    type: "reference",
    resource: "database.Redis",
    output: "REDIS_URL",
  })

  assert.equal(docs.source?.repo, "austin-smith/webhooks.lol")
  assert.equal(docs.source?.branch, "main")
  assert.equal(docs.source?.rootDirectory, undefined)
  assert.equal(docs.build?.buildCommand, "pnpm docs:build")
  assert.deepEqual(docs.build?.watchPatterns, [
    "**",
    "!/apps/cli/**",
    "!/apps/pgboss/**",
    "!/apps/web/**",
  ])
  assert.equal(docs.deploy?.startCommand, "pnpm docs:start")
  assert.deepEqual(Object.keys(docs.networking?.customDomains ?? {}), [
    expectedDocsDomain,
  ])
  assert.deepEqual(Object.keys(docs.variables ?? {}).sort(), [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_DOCS_URL",
  ])

  assert.equal(pgboss.source?.repo, "austin-smith/webhooks.lol")
  assert.equal(pgboss.source?.branch, "main")
  assert.equal(pgboss.source?.rootDirectory, undefined)
  assert.equal(pgboss.build?.buildCommand, "pnpm pgboss:build")
  assert.deepEqual(pgboss.build?.watchPatterns, [
    "**",
    "!/apps/cli/**",
    "!/apps/docs/**",
    "!/apps/web/**",
  ])
  assert.equal(pgboss.deploy?.startCommand, "pnpm pgboss:start")
  assert.deepEqual(Object.keys(pgboss.variables ?? {}), ["DATABASE_URL"])
  assert.deepEqual(pgboss.variables?.DATABASE_URL, {
    type: "reference",
    resource: "database.Postgres",
    output: "DATABASE_URL",
  })

  assert.equal(postgres.image, "ghcr.io/railwayapp-templates/postgres-ssl:18")
  assert.equal(postgres.defaultMountPath, "/var/lib/postgresql/data")
  assert.equal(redis.image, "redis:8")
  assert.equal(redis.defaultMountPath, "/data")
  assert.equal(postgresVolume.config?.region, "us-west2")
  assert.equal(postgresVolume.config?.sizeMB, 50_000)
  assert.equal(redisVolume.config?.region, "us-west2")
  assert.equal(redisVolume.config?.sizeMB, 50_000)
}

await assert.rejects(
  evaluateProjectDefinition("staging"),
  /Unsupported Railway environment: staging/
)

async function evaluateProjectDefinition(
  environment: string
): Promise<ProjectDefinition> {
  return railwayProgram(
    createRailwayContext({
      command: "validate",
      environment,
      environmentName: environment,
      projectName: "webhooks.lol",
    }),
    project
  )
}

function findResource<Type extends ResourceNode["type"]>(
  resources: ResourceNode[],
  address: string,
  type: Type
): Extract<ResourceNode, { type: Type }> {
  const resource = resources.find((candidate) => candidate.address === address)

  assert.ok(
    resource && isResourceOfType(resource, type),
    `Expected Railway resource ${address} of type ${type}`
  )

  return resource
}

function isResourceOfType<Type extends ResourceNode["type"]>(
  resource: ResourceNode,
  type: Type
): resource is Extract<ResourceNode, { type: Type }> {
  return resource.type === type
}
