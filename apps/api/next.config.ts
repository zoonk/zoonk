import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbopackFileSystemCacheForDev: true,
    typedEnv: true,
  },
  transpilePackages: ["@zoonk/auth", "@zoonk/utils"],
  typedRoutes: true,
};

export default nextConfig;
