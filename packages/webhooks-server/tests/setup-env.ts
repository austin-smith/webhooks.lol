import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"

for (const envFile of ["../database/.env.local", "../database/.env"]) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile)
  }
}
