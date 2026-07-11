import { withSentryConfig } from "@sentry/nextjs";
import { NEXT_INTL_PO_FORMAT } from "@zoonk/i18n/next-intl/po-format";
import { getPublicAppSecurityHeaders } from "@zoonk/next/security/headers";
import { type NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withWorkflow } from "workflow/next";

const isE2E = process.env.E2E_TESTING === "true";

const e2eAliases: Record<string, string> = isE2E
  ? { "@zoonk/auth": "../../packages/auth/src/e2e.ts" }
  : {};

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: isE2E ? ".next-e2e" : ".next",
  experimental: { authInterrupts: true, typedEnv: true },
  headers: getPublicAppSecurityHeaders,
  reactCompiler: true,
  turbopack: {
    resolveAlias: { ...e2eAliases },
    rules: {
      // Allow to import MDX files used for AI prompts
      "*.md": { as: "*.js", loaders: ["raw-loader"] },
    },
  },
  typedRoutes: true,
  typescript: { ignoreBuildErrors: true },
};

const withNextIntl = createNextIntlPlugin({
  experimental: {
    extract: { path: "./messages" },
    messages: {
      format: NEXT_INTL_PO_FORMAT,
      locales: "infer",
      path: ["./messages"],
      precompile: true,
      sourceLocale: "en",
    },
    srcPath: "./src",
  },
});

export default withSentryConfig(withWorkflow(withNextIntl(nextConfig)), {
  org: "zoonk",
  project: "zoonk-api",
  silent: true,
  webpack: { treeshake: { removeDebugLogging: true } },
  widenClientFileUpload: true,
});
