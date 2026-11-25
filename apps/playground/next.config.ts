import { tailwindRules } from "@zoonk/ui/turbopack";
import { type NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/** A local tool for developers: it's never deployed, so it has no auth and no image hosts. */
const nextConfig: NextConfig = {
  allowedDevOrigins: ["**.local"],
  cacheComponents: true,
  experimental: { turbopackRustReactCompiler: true, typedEnv: true },
  pageExtensions: ["ts", "tsx"],
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: { rules: { ...tailwindRules } },
  typescript: { ignoreBuildErrors: true },
};

/**
 * `extract` compiles the packages' `useExtracted` calls, which a production build can't run
 * without. `eloqnt extract` (`pnpm i18n:extract`) writes these catalogs, so with no `locales` the
 * playground only reads them. Development skips precompiling, so a string the catalogs don't have
 * yet still fills in its placeholders.
 */
const withNextIntl = createNextIntlPlugin({
  experimental: {
    extract: { path: "./messages" },
    messages: {
      format: "po",
      locales: [],
      path: ["../../packages/player/messages", "../../packages/learn/messages"],
      precompile: process.env.NODE_ENV !== "development",
      sourceLocale: "en",
    },
    srcPath: "./src",
  },
  requestConfig: "./src/i18n/request.ts",
});

export default withNextIntl(nextConfig);
