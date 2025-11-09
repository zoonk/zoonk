import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    turbopackFileSystemCacheForDev: true,
    typedEnv: true,
  },
  reactCompiler: true,
  transpilePackages: ["@zoonk/ui"],
  typedRoutes: true,
};

export default nextConfig;
