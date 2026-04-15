import path from "node:path";
import createMDX from "@next/mdx";
import { withSentryConfig } from "@sentry/nextjs";
import { getPublicAppSecurityHeaders } from "@zoonk/next/security/headers";
import { withBotId } from "botid/next/config";
import { type NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const CACHE_IMAGE_DAYS = 30;

const isE2E = process.env.E2E_TESTING === "true";

// Swap @zoonk/auth for E2E-specific config during E2E builds
const e2eAliases: Record<string, string> = isE2E
  ? { "@zoonk/auth": "../../packages/auth/src/e2e.ts" }
  : {};

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.local"],
  devIndicators: false,
  // Use separate build directories so E2E and production builds don't conflict
  distDir: isE2E ? ".next-e2e" : ".next",
  experimental: {
    authInterrupts: true,
    staleTimes: {
      dynamic: 300,
    },
    typedEnv: true,
  },
  headers: getPublicAppSecurityHeaders,
  images: {
    minimumCacheTTL: 60 * 60 * 24 * CACHE_IMAGE_DAYS,
    remotePatterns: [
      new URL("https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/**"),
      new URL("https://mvrkldmanjesbxos.public.blob.vercel-storage.com/**"),
      new URL("https://*.googleusercontent.com/**"),
      new URL("https://*.githubusercontent.com/**"),
    ],
  },
  logging: {
    browserToTerminal: true,
  },
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  reactCompiler: true,
  turbopack: {
    resolveAlias: {
      ...e2eAliases,
    },
    root: path.resolve(import.meta.dirname, "../.."),
    rules: {
      // Allow to import MDX files used for AI prompts
      "*.md": {
        as: "*.js",
        loaders: ["raw-loader"],
      },
    },
  },
  typedRoutes: true,
  typescript: { ignoreBuildErrors: true },
};

const withMDX = createMDX();

const withNextIntl = createNextIntlPlugin({
  experimental: {
    extract: {
      sourceLocale: "en",
    },
    messages: {
      format: {
        codec: "./src/i18n/codec.ts",
        extension: ".po",
      },
      locales: "infer",
      path: "./messages",
      precompile: true,
    },
    srcPath: ["./src", "../../packages/player/src"],
  },
});

export default withSentryConfig(withBotId(withNextIntl(withMDX(nextConfig))), {
  org: "zoonk",
  project: "zoonk",
  silent: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
  widenClientFileUpload: true,
});
