import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    turbopackFileSystemCacheForDev: true,
    typedEnv: true,
  },
  images: {
    remotePatterns: [
      new URL("https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/**"),
    ],
  },
  pageExtensions: ["ts", "tsx"],
  reactCompiler: true,
  // we use next.js compiler to transpile our internal packages
  transpilePackages: ["@zoonk/ai", "@zoonk/ui", "@zoonk/utils"],
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

export default nextConfig;
