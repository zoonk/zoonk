import path from "node:path";
import createMDX from "@next/mdx";
import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const CACHE_IMAGE_DAYS = 30;
const CACHE_EXPIRE_DAYS = 365;
const CACHE_STALE_MINUTES = 5;
const CACHE_REVALIDATE_DAYS = 30;

// Swap @zoonk/auth for E2E-specific config during E2E builds
const e2eAliases: Record<string, string> =
  process.env.E2E_TESTING === "true"
    ? { "@zoonk/auth": "@zoonk/auth/e2e" }
    : {};

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    default: {
      expire: 60 * 60 * 24 * CACHE_EXPIRE_DAYS,
      revalidate: 60 * 60 * 24 * CACHE_REVALIDATE_DAYS,
      stale: 60 * CACHE_STALE_MINUTES,
    },
  },
  devIndicators: false,
  experimental: {
    authInterrupts: true,
    staleTimes: {
      dynamic: 300,
    },
    turbopackFileSystemCacheForBuild: true,
    typedEnv: true,
  },
  images: {
    minimumCacheTTL: 60 * 60 * 24 * CACHE_IMAGE_DAYS,
    remotePatterns: [
      new URL("https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/**"),
      new URL("https://*.googleusercontent.com/**"),
      new URL("https://*.githubusercontent.com/**"),
    ],
  },
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  reactCompiler: true,
  turbopack: {
    resolveAlias: {
      ...e2eAliases,
    },
    root: path.resolve(__dirname, "../.."),
    rules: {
      // Allow to import MDX files used for AI prompts
      "*.md": {
        as: "*.js",
        loaders: ["raw-loader"],
      },
    },
  },
  typedRoutes: true,
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
    },
    srcPath: "./src",
  },
});

export default withBotId(withNextIntl(withMDX(nextConfig)));
