import path from "node:path";
import createMDX from "@next/mdx";
import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const CACHE_IMAGE_DAYS = 30;

const nextConfig: NextConfig = {
  cacheComponents: true,
  devIndicators: false,
  experimental: {
    authInterrupts: true,
    turbopackFileSystemCacheForDev: true,
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
  // we use next.js compiler to transpile our internal packages
  transpilePackages: [
    "@zoonk/ai",
    "@zoonk/core",
    "@zoonk/auth",
    "@zoonk/db",
    "@zoonk/mailer",
    "@zoonk/next",
    "@zoonk/ui",
    "@zoonk/utils",
  ],
  turbopack: {
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
      format: "po",
      locales: "infer",
      path: "./messages",
    },
    srcPath: "./src",
  },
});

export default withBotId(withNextIntl(withMDX(nextConfig)));
