import type { NextConfig } from "next";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from "next/constants";

const devBackendBaseUrl =
  process.env.INTERNAL_BACKEND_BASE_URL?.trim() || "http://localhost:8000";
const prodBackendBaseUrl =
  process.env.INTERNAL_BACKEND_BASE_URL?.trim() || "http://backend:8000";

const devConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/media/:path*",
        destination: `${devBackendBaseUrl}/media/:path*`,
      },
      {
        source: "/v1/:path*",
        destination: `${devBackendBaseUrl}/v1/:path*`,
      },
    ];
  },
};

const prodConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/media/:path*",
        destination: `${prodBackendBaseUrl}/media/:path*`,
      },
      {
        source: "/v1/:path*",
        destination: `${prodBackendBaseUrl}/v1/:path*`,
      },
    ];
  },
};

const baseConfig: NextConfig = {
  // Disable compression so SSE responses aren't buffered by the proxy layer.
  // (Streaming endpoints rely on incremental flush of chunks.)
  compress: false,
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/icons/sprite-:hash.svg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/v1/:path*",
        headers: [
          // Avoid intermediaries buffering or transforming SSE streams.
          { key: "Cache-Control", value: "no-cache, no-transform" },
        ],
      },
    ];
  },
};

export default function nextConfig(phase: string): NextConfig {
  const distDir =
    phase === PHASE_DEVELOPMENT_SERVER
      ? ".next-dev"
      : phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER
        ? ".next-prod"
        : ".next";

  const isProd = phase === PHASE_PRODUCTION_SERVER || phase === PHASE_PRODUCTION_BUILD;

  return {
    ...baseConfig,
    ...(isProd ? prodConfig : devConfig),
    distDir,
  };
}
