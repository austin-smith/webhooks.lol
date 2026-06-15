import { sql } from "drizzle-orm"
import { PgBoss, type Db } from "pg-boss"

import {
  ENDPOINT_FORWARDING_QUEUE,
  ENDPOINT_FORWARDING_RETRY_DELAY_MAX_SECONDS,
  ENDPOINT_FORWARDING_RETRY_DELAY_SECONDS,
  ENDPOINT_FORWARDING_RETRY_LIMIT,
  type EndpointForwardDeliveryJob,
} from "@webhooks-lol/webhooks-server/endpoint-forwarding/policy"

export type PgBossDrizzleTransaction = {
  execute(query: unknown): Promise<unknown>
}

let bossPromise: Promise<PgBoss> | null = null

export async function getEndpointForwardingBoss(): Promise<PgBoss> {
  bossPromise ??= startEndpointForwardingBoss().catch((error) => {
    bossPromise = null
    throw error
  })
  return bossPromise
}

export async function enqueueEndpointForwardDeliveryJob({
  deliveryId,
  targetId,
  transaction,
}: {
  deliveryId: string
  targetId: string
  transaction: PgBossDrizzleTransaction
}): Promise<void> {
  const boss = await getEndpointForwardingBoss()
  const jobId = await boss.send(
    ENDPOINT_FORWARDING_QUEUE,
    { deliveryId } satisfies EndpointForwardDeliveryJob,
    {
      db: createPgBossDrizzleDatabase(transaction),
      group: { id: targetId },
      id: deliveryId,
      retryBackoff: true,
      retryDelay: ENDPOINT_FORWARDING_RETRY_DELAY_SECONDS,
      retryDelayMax: ENDPOINT_FORWARDING_RETRY_DELAY_MAX_SECONDS,
      retryLimit: ENDPOINT_FORWARDING_RETRY_LIMIT,
    }
  )

  if (jobId !== deliveryId) {
    throw new Error("Could not enqueue endpoint forward delivery job.")
  }
}

function createPgBossDrizzleDatabase(
  transaction: PgBossDrizzleTransaction
): Db {
  return {
    async executeSql(text, values = []) {
      const { parts, reorderedValues } = parsePostgresPlaceholders(text, values)
      const strings = Object.assign(parts, { raw: [...parts] })
      const result = await transaction.execute(sql(strings, ...reorderedValues))

      return {
        rows: Array.isArray(result) ? result : [],
      }
    },
  }
}

function parsePostgresPlaceholders(text: string, values: unknown[]) {
  const parts: string[] = []
  const reorderedValues: unknown[] = []
  const placeholderPattern = /\$(\d+)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = placeholderPattern.exec(text))) {
    parts.push(text.slice(lastIndex, match.index))
    reorderedValues.push(values[Number(match[1]) - 1])
    lastIndex = match.index + match[0].length
  }

  parts.push(text.slice(lastIndex))

  return { parts, reorderedValues }
}

async function startEndpointForwardingBoss(): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: readDatabaseUrl(),
    schedule: false,
  })

  boss.on("error", (error) => {
    console.error("[endpoint-forwarding] queue error", error)
  })
  boss.on("warning", (warning) => {
    console.warn("[endpoint-forwarding] queue warning", warning)
  })

  await boss.start()
  await boss.createQueue(ENDPOINT_FORWARDING_QUEUE, {
    expireInSeconds: 60,
    heartbeatSeconds: 30,
    retryBackoff: true,
    retryDelay: ENDPOINT_FORWARDING_RETRY_DELAY_SECONDS,
    retryDelayMax: ENDPOINT_FORWARDING_RETRY_DELAY_MAX_SECONDS,
    retryLimit: ENDPOINT_FORWARDING_RETRY_LIMIT,
  })

  return boss
}

function readDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to use endpoint forwarding.")
  }

  return databaseUrl
}
