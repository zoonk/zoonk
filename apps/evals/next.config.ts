import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx"],
  typedRoutes: true,
  experimental: {
    typedEnv: true,
    cacheComponents: true,
    turbopackFileSystemCacheForDev: true,
  },
  // we use next.js compiler to transpile our internal packages
  transpilePackages: ["@zoonk/ai", "@zoonk/ui", "@zoonk/utils"],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
    rules: {
      // Allow to import MDX files used for AI prompts
      "*.md": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
