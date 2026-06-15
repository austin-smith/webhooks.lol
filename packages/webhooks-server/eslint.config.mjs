import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import eslint from "@eslint/js"
import tseslint from "typescript-eslint"

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url))

export default tseslint.config(
  {
    ignores: ["dist/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs", "vitest.config.ts"],
        },
        tsconfigRootDir,
      },
    },
    rules: {
      "no-undef": "off",
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/require-await": "off",
    },
  }
)
