import path from "node:path";
import { type NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  devIndicators: false,
  experimental: {
    typedEnv: true,
  },
  images: {
    remotePatterns: [new URL("https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/**")],
  },
  pageExtensions: ["ts", "tsx"],
  reactCompiler: true,
  turbopack: {
    root: path.resolve(import.meta.dirname, "../.."),
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
