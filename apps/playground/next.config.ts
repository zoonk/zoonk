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
  turbopack: { rules: tailwindRules },
  typescript: { ignoreBuildErrors: true },
};

/**
 * `extract` compiles the packages' `useExtracted` calls, which a production build can't run
 * without. Their own extraction writes these catalogs, so with no `locales` the playground only
 * reads them.
 */
const withNextIntl = createNextIntlPlugin({
  experimental: {
    extract: { path: "./messages" },
    messages: {
      format: "po",
      locales: [],
      path: ["../../packages/player/messages", "../../packages/learn/messages"],
      precompile: true,
      sourceLocale: "en",
    },
    srcPath: "./src",
  },
  requestConfig: "./src/i18n/request.ts",
});

export default withNextIntl(nextConfig);
