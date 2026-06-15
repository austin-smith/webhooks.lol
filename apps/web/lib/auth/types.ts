import { drizzleAdapter } from "better-auth/adapters/drizzle"

export type DrizzleDatabase = Parameters<typeof drizzleAdapter>[0]
