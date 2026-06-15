import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@webhooks-lol\/webhooks-core\/(.+)$/,
        replacement: fileURLToPath(new URL("./src/$1.ts", import.meta.url)),
      },
      {
        find: "@webhooks-lol/webhooks-core",
        replacement: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "node",
    globals: false,
  },
})
