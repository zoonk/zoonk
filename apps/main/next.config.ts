import createMDX from "@next/mdx";
import { withSentryConfig } from "@sentry/nextjs";
import { NEXT_INTL_PO_FORMAT } from "@zoonk/i18n/next-intl/po-format";
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
    appNewScrollHandler: true,
    authInterrupts: true,
    staleTimes: { dynamic: 300 },
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
  logging: { browserToTerminal: true },
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  reactCompiler: true,
  async redirects() {
    return [
      { destination: "/start/learn", permanent: true, source: "/learn" },
      { destination: "/start/learn/:prompt", permanent: true, source: "/learn/:prompt" },
    ];
  },
  turbopack: {
    resolveAlias: { ...e2eAliases },
    rules: {
      // Allow to import MDX files used for AI prompts
      "*.md": { as: "*.js", loaders: ["raw-loader"] },
    },
  },
  typedRoutes: true,
  typescript: { ignoreBuildErrors: true },
};

const withMDX = createMDX();

const withNextIntl = createNextIntlPlugin({
  experimental: {
    extract: { path: "./messages" },
    messages: {
      format: NEXT_INTL_PO_FORMAT,
      locales: "infer",
      path: ["./messages", "../../packages/player/messages"],
      precompile: true,
      sourceLocale: "en",
    },
    srcPath: "./src",
  },
});

export default withSentryConfig(withBotId(withNextIntl(withMDX(nextConfig))), {
  org: "zoonk",
  project: "zoonk",
  silent: true,
  webpack: { treeshake: { removeDebugLogging: true } },
  widenClientFileUpload: true,
});
