import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbopackFileSystemCacheForDev: true,
    typedEnv: true,
  },
  transpilePackages: ["@zoonk/auth"],
  typedRoutes: true,
};

export default nextConfig;
