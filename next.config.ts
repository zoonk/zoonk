import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  images: {
    minimumCacheTTL: 31_536_000, // 1 year
  },
  typedRoutes: true,
  experimental: {
    typedEnv: true,
    useCache: true,
  },
};

const withNextIntl = createNextIntlPlugin({
  experimental: {
    createMessagesDeclaration: "./messages/en.json",
  },
});

export default withNextIntl(nextConfig);
