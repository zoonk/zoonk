import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  cacheComponents: true,
  devIndicators: false,
  experimental: {
    authInterrupts: true,
    turbopackFileSystemCacheForBuild: true,
    typedEnv: true,
  },
  reactCompiler: true,
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
