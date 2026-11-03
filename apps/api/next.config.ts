import { withSentryConfig } from "@sentry/nextjs/config";
import { getSessionCookieName } from "@zoonk/auth/cookies";
import { getPublicAppSecurityHeaders } from "@zoonk/core/security/headers";
import { LOCALE_COOKIE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { AUTH_LOGIN_EXPIRED_ERROR } from "@zoonk/utils/origin";
import { withBotId } from "botid/next/config";
import { type NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withWorkflow } from "workflow/next";
import { E2E_MAIN_APP_URL } from "./e2e/main-app-url";

const isE2E = process.env.E2E_TESTING === "true";

const AUTH_PAGE = "/auth/:page(login|otp|setup|untrusted-origin)";
const LOCALE = `(?<locale>${SUPPORTED_LOCALES.join("|")})`;
const LOCALIZED_AUTH_PAGE = "/auth/:locale/:page";
const LOCALE_QUERY = { key: "locale", type: "query", value: LOCALE } as const;
const LOCALE_COOKIE_MATCH = { key: LOCALE_COOKIE, type: "cookie", value: LOCALE } as const;
const EXPIRED_QUERY = { key: "error", type: "query", value: AUTH_LOGIN_EXPIRED_ERROR } as const;

const OPEN_AUTH_PAGE = "/auth/open/:page";

/**
 * A browser that may already be signed in asks first, so it goes on to the app without seeing the
 * form. A Server Action posted from the form stays on the page.
 */
const signedInRewrites = [true, false].map((secure) => ({
  destination: OPEN_AUTH_PAGE.replace(":page", "login"),
  // A value without a named group, or Next would pass the cookie on in the destination's query.
  has: [{ key: getSessionCookieName({ secure }), type: "cookie", value: ".+" } as const],
  missing: [
    { key: "error", type: "query" } as const,
    { key: "next-action", type: "header" } as const,
  ],
  source: "/auth/login",
}));

/**
 * Apps link to `/auth/login?locale=…`, and pages from an earlier deployment to the other pages without
 * a locale. The routing layer picks the page prerendered in that language, so no function runs
 * before the CDN answers; any other visit asks `OPEN_AUTH_PAGE` for the browser's.
 */
const authPageRewrites = [LOCALE_QUERY, LOCALE_COOKIE_MATCH].map((has) => ({
  destination: LOCALIZED_AUTH_PAGE,
  has: [has],
  source: AUTH_PAGE,
}));

/** An expired sign-in has its own prerendered page, so the notice is there from the first paint. */
const expiredLoginRewrites = [
  { has: [LOCALE_QUERY, EXPIRED_QUERY], source: "/auth/login" },
  { has: [LOCALE_COOKIE_MATCH, EXPIRED_QUERY], source: "/auth/login" },
  { has: [EXPIRED_QUERY], source: `/auth/:locale(${SUPPORTED_LOCALES.join("|")})/login` },
].map((rule) => ({ ...rule, destination: "/auth/:locale/login/expired" }));

const REMEMBER_LOCALE = [
  { key: "Set-Cookie", value: `${LOCALE_COOKIE}=:locale; Path=/; SameSite=Lax` },
];

/**
 * Auth emails and route handlers have no locale in their path, so they read the one the screen the
 * learner opened was in.
 */
const authLocaleCookies = [
  { has: [LOCALE_QUERY], headers: REMEMBER_LOCALE, source: AUTH_PAGE },
  {
    headers: REMEMBER_LOCALE,
    source: `/auth/:locale(${SUPPORTED_LOCALES.join("|")})/:page(login|otp|setup|untrusted-origin)`,
  },
];

const e2eAliases: Record<string, string> = isE2E
  ? {
      "@zoonk/ai/block-test-gateway-fetch": "./e2e/gateway-fetch.ts",
      "@zoonk/ai/tasks/language/live-call-session": "../../packages/e2e/src/live-call-provider.ts",
      "@zoonk/auth": "../../packages/auth/src/e2e.ts",
    }
  : {};

const nextConfig: NextConfig = {
  allowedDevOrigins: ["**.local"],
  cacheComponents: true,
  distDir: isE2E ? ".next-e2e" : ".next",
  env: {
    ZOONK_APP: "api",
    // Prerendered auth pages link to the main app as the build knew it, so the API's own E2E build
    // names the address its server runs with, as deployments and Main's E2E do.
    ...(isE2E && !process.env.MAIN_APP_URL ? { MAIN_APP_URL: E2E_MAIN_APP_URL } : {}),
  },
  experimental: {
    authInterrupts: true,
    // The API enables Cache Components for request deduplication, not to require every auth page to navigate instantly.
    instantInsights: { validationLevel: "manual-warning" },
    turbopackRustReactCompiler: true,
    typedEnv: true,
  },
  headers: async () => [...(await getPublicAppSecurityHeaders()), ...authLocaleCookies],
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
  partialPrefetching: true,
  reactCompiler: true,
  rewrites: async () => ({
    afterFiles: [],
    beforeFiles: [
      ...signedInRewrites,
      ...expiredLoginRewrites,
      ...authPageRewrites,
      { destination: OPEN_AUTH_PAGE, source: AUTH_PAGE },
    ],
    fallback: [],
  }),
  turbopack: {
    resolveAlias: { ...e2eAliases },
    rules: { "*.md": { as: "*.js", loaders: ["raw-loader"] } },
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
      path: ["./messages", "../../packages/player/messages"],
      precompile: true,
      sourceLocale: "en",
    },
    srcPath: "./src",
  },
});

export default withSentryConfig(withWorkflow(withBotId(withNextIntl(nextConfig))), {
  bundleSizeOptimizations: { excludeDebugStatements: true },
  org: "zoonk",
  project: "zoonk-api",
  silent: true,
  widenClientFileUpload: true,
});
