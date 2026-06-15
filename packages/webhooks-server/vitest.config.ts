import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@webhooks-lol\/database\/(.+)$/,
        replacement: fileURLToPath(
          new URL("../database/src/$1.ts", import.meta.url)
        ),
      },
      {
        find: "@webhooks-lol/database",
        replacement: fileURLToPath(
          new URL("../database/src/index.ts", import.meta.url)
        ),
      },
      {
        find: /^@webhooks-lol\/webhooks-core\/(.+)$/,
        replacement: fileURLToPath(
          new URL("../webhooks-core/src/$1.ts", import.meta.url)
        ),
      },
      {
        find: "@webhooks-lol/webhooks-core",
        replacement: fileURLToPath(
          new URL("../webhooks-core/src/index.ts", import.meta.url)
        ),
      },
      {
        find: /^@webhooks-lol\/webhooks-server\/(.+)$/,
        replacement: fileURLToPath(new URL("./src/$1.ts", import.meta.url)),
      },
      {
        find: "@webhooks-lol/webhooks-server",
        replacement: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
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
    setupFiles: ["./tests/setup-env.ts"],
  },
})
