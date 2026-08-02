import type { NextConfig } from "next"
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  type PHASE_TYPE,
} from "next/constants"

import { discoverAppBuildMetadata } from "./lib/app-build-metadata.build"

export default function createNextConfig(phase: PHASE_TYPE): NextConfig {
  const buildMetadata = embedsBuildMetadata(phase)
    ? discoverAppBuildMetadata()
    : null

  return {
    env: buildMetadata
      ? {
          APP_BUILD_AT: buildMetadata.builtAt,
          APP_BUILD_BRANCH: buildMetadata.branch,
          APP_BUILD_COMMIT_SHA: buildMetadata.commitSha,
          APP_BUILD_COMMIT_SUBJECT: buildMetadata.commitSubject,
          APP_BUILD_DIRTY: String(buildMetadata.dirty),
        }
      : undefined,
    poweredByHeader: false,
    transpilePackages: [
      "@webhooks-lol/database",
      "@webhooks-lol/webhooks-core",
      "@webhooks-lol/webhooks-server",
    ],
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "X-Content-Type-Options",
              value: "nosniff",
            },
          ],
        },
      ]
    },
  }
}

function embedsBuildMetadata(phase: PHASE_TYPE) {
  return phase === PHASE_DEVELOPMENT_SERVER || phase === PHASE_PRODUCTION_BUILD
}
