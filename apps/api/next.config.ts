import { withSentryConfig } from "@sentry/nextjs/config";
import { getPublicAppSecurityHeaders } from "@zoonk/core/security/headers";
import { withBotId } from "botid/next/config";
import { type NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withWorkflow } from "workflow/next";

const isE2E = process.env.E2E_TESTING === "true";

const e2eAliases: Record<string, string> = isE2E
  ? { "@zoonk/auth": "../../packages/auth/src/e2e.ts" }
  : {};

const nextConfig: NextConfig = {
  allowedDevOrigins: ["**.local"],
  cacheComponents: true,
  distDir: isE2E ? ".next-e2e" : ".next",
  experimental: {
    authInterrupts: true,
    // The API enables Cache Components for request deduplication, not to require every auth page to navigate instantly.
    instantInsights: { validationLevel: "manual-warning" },
    // Next 16.4.0: a dev session restored from Turbopack's file cache can answer every HMR subscription to
    // the client entry with "restart", so auth pages reload in a loop. The API compiles quickly from scratch.
    turbopackFileSystemCacheForDev: false,
    turbopackRustReactCompiler: true,
    typedEnv: true,
  },
  headers: getPublicAppSecurityHeaders,
  // Lesson code checks run model-written programs in a separate process that loads these
  // WebAssembly runtimes from @zoonk/core's packages on disk, which tracing can't see.
  outputFileTracingIncludes: {
    "/.well-known/workflow/**": [
      "../../packages/core/node_modules/{pyodide,quickjs-wasi,sql.js}/package.json",
      "../../node_modules/.pnpm/pyodide@*/node_modules/{pyodide,ws}/**",
      "../../node_modules/.pnpm/quickjs-wasi@*/node_modules/quickjs-wasi/**",
      "../../node_modules/.pnpm/sql.js@*/node_modules/sql.js/{package.json,dist/sql-wasm.*}",
    ],
  },
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
      format: "po",
      locales: "infer",
      path: ["./messages"],
      precompile: true,
      sourceLocale: "en",
    },
    srcPath: "./src",
  },
});

export default withSentryConfig(withWorkflow(withBotId(withNextIntl(nextConfig))), {
  org: "zoonk",
  project: "zoonk-api",
  silent: true,
  webpack: { treeshake: { removeDebugLogging: true } },
  widenClientFileUpload: true,
});
