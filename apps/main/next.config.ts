import path from "node:path";
import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const CACHE_IMAGE_DAYS = 30;

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  images: {
    minimumCacheTTL: 60 * 60 * 24 * CACHE_IMAGE_DAYS,
  },
  typedRoutes: true,
  experimental: {
    typedEnv: true,
    cacheComponents: true,
    turbopackFileSystemCacheForDev: true,
  },
  // we use next.js compiler to transpile our internal packages
  transpilePackages: [
    "@zoonk/ai",
    "@zoonk/api",
    "@zoonk/auth",
    "@zoonk/db",
    "@zoonk/mailer",
    "@zoonk/ui",
    "@zoonk/utils",
  ],
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

const withMDX = createMDX();

const withNextIntl = createNextIntlPlugin({
  experimental: {
    // this is useful for type-checking keys
    createMessagesDeclaration: "./messages/en.json",
  },
});

export default withNextIntl(withMDX(nextConfig));
