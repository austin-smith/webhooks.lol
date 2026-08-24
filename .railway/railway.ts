import {
  database,
  defineRailway,
  github,
  postgres,
  preserve,
  project,
  service,
  volume,
} from "railway/iac"

const deploymentEnvironments = ["develop", "production"] as const
type DeploymentEnvironment = (typeof deploymentEnvironments)[number]

const repository = "austin-smith/webhooks.lol"
const region = "us-west2"

const serviceDefaults = {
  source: github(repository, { branch: "main" }),
  deploy: {
    runtime: "V2",
    restartPolicyType: "ON_FAILURE",
    restartPolicyMaxRetries: 10,
    multiRegionConfig: {
      [region]: { numReplicas: 1 },
    },
  },
} as const

export default defineRailway((context) => {
  const environment = readDeploymentEnvironment(context.environment)
  const urls = environmentUrls(environment)

  const postgresDatabase = postgres("Postgres", { region })
  const redisDatabase = database("Redis", "redis", {
    image: "redis:8",
    output: "REDIS_URL",
    defaultMountPath: "/data",
    region,
  })

  const postgresVolume = volume("postgres-volume", {
    region,
    sizeMB: 50_000,
  })
  const redisVolume = volume("redis-volume", {
    region,
    sizeMB: 50_000,
  })

  const web = service("web", {
    ...serviceDefaults,
    build: {
      builder: "RAILPACK",
      buildCommand: "pnpm web:build",
      watchPatterns: [
        "**",
        "!/apps/cli/**",
        "!/apps/docs/**",
        "!/apps/pgboss/**",
      ],
    },
    deploy: {
      ...serviceDefaults.deploy,
      startCommand: "pnpm web:start",
      preDeployCommand: ["pnpm db:migrate"],
    },
    domains: [{ domain: urls.web.hostname, port: 8080 }],
    networking: {
      privateNetworkEndpoint: "webhooks-lol",
    },
    env: {
      APP_ENV: environment,
      NEXT_PUBLIC_APP_URL: urls.web.origin,
      NEXT_PUBLIC_DOCS_URL: urls.docs.origin,
      DATABASE_URL: postgresDatabase.env.DATABASE_URL,
      REDIS_URL: redisDatabase.env.REDIS_URL,
      TRUSTED_CLIENT_IP_HEADER: preserve(),
      BETTER_AUTH_SECRET: preserve(),
      BETTER_AUTH_URL: preserve(),
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: preserve(),
      TURNSTILE_SECRET_KEY: preserve(),
      GITHUB_CLIENT_ID: preserve(),
      GITHUB_CLIENT_SECRET: preserve(),
      CLOUDFLARE_ACCOUNT_ID: preserve(),
      CLOUDFLARE_EMAIL_API_TOKEN: preserve(),
      EMAIL_FROM_ADDRESS: preserve(),
    },
  })

  const docs = service("docs", {
    ...serviceDefaults,
    build: {
      builder: "RAILPACK",
      buildCommand: "pnpm docs:build",
      watchPatterns: [
        "**",
        "!/apps/cli/**",
        "!/apps/pgboss/**",
        "!/apps/web/**",
      ],
    },
    deploy: {
      ...serviceDefaults.deploy,
      startCommand: "pnpm docs:start",
    },
    domains: [{ domain: urls.docs.hostname, port: 8080 }],
    env: {
      NEXT_PUBLIC_APP_URL: urls.web.origin,
      NEXT_PUBLIC_DOCS_URL: urls.docs.origin,
    },
  })

  const pgboss = service("pgboss", {
    ...serviceDefaults,
    build: {
      builder: "RAILPACK",
      buildCommand: "pnpm pgboss:build",
      watchPatterns: ["**", "!/apps/cli/**", "!/apps/docs/**", "!/apps/web/**"],
    },
    deploy: {
      ...serviceDefaults.deploy,
      startCommand: "pnpm pgboss:start",
    },
    networking: {
      privateNetworkEndpoint: "workers",
    },
    env: {
      DATABASE_URL: postgresDatabase.env.DATABASE_URL,
    },
  })

  return project("webhooks.lol", {
    environments: [...deploymentEnvironments],
    resources: [
      web,
      docs,
      pgboss,
      postgresDatabase,
      redisDatabase,
      postgresVolume,
      redisVolume,
    ],
  })
})

function readDeploymentEnvironment(
  environment: string | undefined
): DeploymentEnvironment {
  if (environment === "develop" || environment === "production") {
    return environment
  }

  throw new Error(
    `Unsupported Railway environment: ${environment ?? "<unset>"}. Expected develop or production.`
  )
}

function environmentUrls(environment: DeploymentEnvironment) {
  if (environment === "production") {
    return {
      web: new URL("https://webhooks.lol"),
      docs: new URL("https://docs.webhooks.lol"),
    }
  }

  return {
    web: new URL("https://dev.webhooks.lol"),
    docs: new URL("https://dev-docs.webhooks.lol"),
  }
}
