import type { NextConfig } from "next";

const CACHE_IMAGE_DAYS = 30;

const nextConfig: NextConfig = {
  cacheComponents: true,
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
  reactCompiler: true,
  transpilePackages: ["@zoonk/auth", "@zoonk/api", "@zoonk/db", "@zoonk/ui"],
  typedRoutes: true,
};

export default nextConfig;
