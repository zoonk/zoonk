import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const CACHE_IMAGE_DAYS = 30;

const nextConfig: NextConfig = {
  cacheComponents: true,
  devIndicators: false,
  experimental: {
    authInterrupts: true,
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
  reactCompiler: true,
  typedRoutes: true,
};

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

export default withNextIntl(nextConfig);
