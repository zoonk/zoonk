import path from "node:path";
import { type NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isE2E = process.env.E2E_TESTING === "true";

// Swap @zoonk/auth for E2E-specific config during E2E builds
const e2eAliases: Record<string, string> = isE2E
  ? { "@zoonk/auth": "../../packages/auth/src/e2e.ts" }
  : {};

const nextConfig: NextConfig = {
  cacheComponents: true,
  devIndicators: false,
  // Use separate build directories so E2E and production builds don't conflict
  distDir: isE2E ? ".next-e2e" : ".next",
  experimental: {
    authInterrupts: true,
    typedEnv: true,
  },
  reactCompiler: true,
  turbopack: {
    resolveAlias: {
      ...e2eAliases,
    },
    root: path.resolve(import.meta.dirname, "../.."),
  },
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
