import { availableParallelism } from "node:os";
import createMDX from "@next/mdx";
import { withSentryConfig } from "@sentry/nextjs/config";
import { getPublicAppSecurityHeaders } from "@zoonk/core/security/headers";
import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { withBotId } from "botid/next/config";
import { type NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const CACHE_IMAGE_DAYS = 30;

const isE2E = process.env.E2E_TESTING === "true";

const e2eAliases: Record<string, string> = isE2E
  ? {
      "@zoonk/ai/tasks/v2/language/assess-pronunciation":
        "../../packages/e2e/src/pronunciation-grader.ts",
      "@zoonk/ai/tasks/v2/language/live-call-session":
        "../../packages/e2e/src/live-call-provider.ts",
      "@zoonk/auth": "../../packages/auth/src/e2e.ts",
    }
  : {};

const localePrefixes = ["", `/:locale(${SUPPORTED_LOCALES.join("|")})`];

const oldStartRedirects = localePrefixes.flatMap((prefix) => [
  {
    destination: `${prefix}/start?goal=:prompt`,
    permanent: true,
    source: `${prefix}/start/learn/:prompt`,
  },
  {
    destination: `${prefix}/start`,
    permanent: true,
    source: `${prefix}/start/:page(learn|speak|exam)/:rest*`,
  },
]);

/** `/help` is the address people guess for `/support`. */
const movedPageRedirects = localePrefixes.flatMap((prefix) => [
  { destination: `${prefix}/settings/appearance`, permanent: true, source: `${prefix}/language` },
  { destination: `${prefix}/today`, permanent: true, source: `${prefix}/my` },
  { destination: `${prefix}/support`, permanent: true, source: `${prefix}/help` },
]);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["**.local"],
  cacheComponents: true,
  distDir: isE2E ? ".next-e2e" : ".next",
  env: { ZOONK_APP: "main" },
  experimental: {
    authInterrupts: true,
    cpus: availableParallelism(),
    exposeTestingApiInProductionBuild: isE2E,
    // The root layout sits under `[lang]`, so URLs no route matches need `app/global-not-found.tsx`.
    globalNotFound: true,
    turbopackRustReactCompiler: true,
    typedEnv: true,
  },
  headers: getPublicAppSecurityHeaders,
  images: {
    minimumCacheTTL: 60 * 60 * 24 * CACHE_IMAGE_DAYS,
    remotePatterns: [
      new URL("https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/**"),
      new URL("https://mvrkldmanjesbxos.public.blob.vercel-storage.com/**"),
      new URL("https://*.googleusercontent.com/**"),
      new URL("https://*.githubusercontent.com/**"),
    ],
  },
  logging: { browserToTerminal: true },
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  partialPrefetching: true,
  reactCompiler: true,
  redirects: async () => [...oldStartRedirects, ...movedPageRedirects],
  turbopack: {
    resolveAlias: { ...e2eAliases },
    rules: { "*.md": { as: "*.js", loaders: ["raw-loader"] } },
  },
  typedRoutes: true,
  typescript: { ignoreBuildErrors: true },
};

const withMDX = createMDX();

const withNextIntl = createNextIntlPlugin({
  experimental: {
    extract: { path: "./messages" },
    messages: {
      format: "po",
      locales: "infer",
      path: ["./messages", "../../packages/player/messages", "../../packages/learn/messages"],
      precompile: true,
      sourceLocale: "en",
    },
    srcPath: "./src",
  },
});

export default withSentryConfig(withBotId(withNextIntl(withMDX(nextConfig))), {
  org: "zoonk",
  project: "zoonk",
  silent: true,
  webpack: { treeshake: { removeDebugLogging: true } },
  widenClientFileUpload: true,
});
