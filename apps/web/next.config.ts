import type { NextConfig } from "next"

const nextConfig: NextConfig = {
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

export default nextConfig
