import path from "node:path";
import { type NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isE2E = process.env.E2E_TESTING === "true";

const e2eAliases: Record<string, string> = isE2E
  ? {
      "@zoonk/auth": "../../packages/auth/src/e2e.ts",
      "@zoonk/auth/client": "../../packages/auth/src/e2e-client.ts",
    }
  : {};

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: isE2E ? ".next-e2e" : ".next",
  experimental: {
    authInterrupts: true,
    typedEnv: true,
  },
  reactCompiler: true,
  turbopack: {
    resolveAlias: { ...e2eAliases },
    root: path.resolve(import.meta.dirname, "../.."),
  },
  typedRoutes: true,
};

const withNextIntl = createNextIntlPlugin({
  experimental: {
    extract: { sourceLocale: "en" },
    messages: {
      format: { codec: "./src/i18n/codec.ts", extension: ".po" },
      locales: "infer",
      path: "./messages",
      precompile: true,
    },
    srcPath: "./src",
  },
});

export default withNextIntl(nextConfig);
