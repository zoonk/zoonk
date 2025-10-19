import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx"],
  typedRoutes: true,
  cacheComponents: true,
  experimental: {
    typedEnv: true,
    turbopackFileSystemCacheForDev: true,
  },
  images: {
    remotePatterns: [
      new URL("https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/**"),
    ],
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
