import createMDX from "@next/mdx";
import { withSentryConfig } from "@sentry/nextjs/config";
import { CACHE_LIFE_PROFILES } from "@zoonk/core/cache-tags";
import { getPublicAppSecurityHeaders } from "@zoonk/core/security/headers";
import { getExtractPath } from "@zoonk/i18n/extract-path";
import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { withBotId } from "botid/next/config";
import { type NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const CACHE_IMAGE_DAYS = 30;

const isE2E = process.env.E2E_TESTING === "true";

// Substitute authentication and external AI boundaries only in E2E builds.
const e2eAliases: Record<string, string> = isE2E
  ? {
      "@zoonk/ai/tasks/v2/language/assess-pronunciation":
        "../../packages/e2e/src/pronunciation-grader.ts",
      "@zoonk/ai/tasks/v2/language/live-call-session":
        "../../packages/e2e/src/live-call-provider.ts",
      "@zoonk/auth": "../../packages/auth/src/e2e.ts",
    }
  : {};

/** Paths without a locale are the default language; the others start with their locale. */
const localePrefixes = ["", `/:locale(${SUPPORTED_LOCALES.join("|")})`];

/**
 * The old course-prompt pages (`/start/learn/{prompt}`, `/start/speak`, `/start/exam`) are now
 * onboarding, which reads the goal from `?goal=`, so their links and search results keep working.
 */
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

/**
 * Pages folded into others: the language setting lives in Appearance, "My courses" gave way to
 * Today, where a learner's goals and their courses are, and the Plan holds what the Progress and
 * Content tabs and the subject map had. The Plan was called the Journey for a while, so its old
 * addresses (a subject's page too) lead to the same page. Chapter and unit pages keep their URLs.
 * Help lives at `/support`, and `/help` is the address people guess.
 */
const movedPageRedirects = localePrefixes.flatMap((prefix) => [
  { destination: `${prefix}/settings/appearance`, permanent: true, source: `${prefix}/language` },
  { destination: `${prefix}/today`, permanent: true, source: `${prefix}/my` },
  { destination: `${prefix}/support`, permanent: true, source: `${prefix}/help` },
  { destination: `${prefix}/plan/:rest*`, permanent: true, source: `${prefix}/journey/:rest*` },
  ...["/progress", "/content", "/content/map"].map((path) => ({
    destination: `${prefix}/plan`,
    permanent: true,
    source: `${prefix}${path}`,
  })),
]);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["**.local"],
  cacheComponents: true,
  cacheLife: { ...CACHE_LIFE_PROFILES },
  // Use separate build directories so E2E and production builds don't conflict
  distDir: isE2E ? ".next-e2e" : ".next",
  experimental: {
    authInterrupts: true,
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
    rules: {
      // Allow to import MDX files used for AI prompts
      "*.md": { as: "*.js", loaders: ["raw-loader"] },
    },
  },
  typedRoutes: true,
  typescript: { ignoreBuildErrors: true },
};

const withMDX = createMDX();

const withNextIntl = createNextIntlPlugin({
  experimental: {
    extract: { path: getExtractPath("main") },
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
