import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL(".", import.meta.url)),
      },
      {
        find: /^@webhooks-lol\/database\/(.+)$/,
        replacement: fileURLToPath(
          new URL("../../packages/database/src/$1.ts", import.meta.url)
        ),
      },
      {
        find: "@webhooks-lol/database",
        replacement: fileURLToPath(
          new URL("../../packages/database/src/index.ts", import.meta.url)
        ),
      },
      {
        find: /^@webhooks-lol\/webhooks-core\/(.+)$/,
        replacement: fileURLToPath(
          new URL("../../packages/webhooks-core/src/$1.ts", import.meta.url)
        ),
      },
      {
        find: "@webhooks-lol/webhooks-core",
        replacement: fileURLToPath(
          new URL("../../packages/webhooks-core/src/index.ts", import.meta.url)
        ),
      },
      {
        find: /^@webhooks-lol\/webhooks-server\/(.+)$/,
        replacement: fileURLToPath(
          new URL("../../packages/webhooks-server/src/$1.ts", import.meta.url)
        ),
      },
      {
        find: "@webhooks-lol/webhooks-server",
        replacement: fileURLToPath(
          new URL(
            "../../packages/webhooks-server/src/index.ts",
            import.meta.url
          )
        ),
      },
      {
        find: "server-only",
        replacement: fileURLToPath(
          new URL("./tests/server-only.ts", import.meta.url)
        ),
      },
    ],
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
})
