import { type NextConfig } from "next";

/** A local tool for developers: it's never deployed, so it has no auth and no image hosts. */
const nextConfig: NextConfig = {
  allowedDevOrigins: ["**.local"],
  cacheComponents: true,
  experimental: { turbopackRustReactCompiler: true, typedEnv: true },
  pageExtensions: ["ts", "tsx"],
  partialPrefetching: true,
  reactCompiler: true,
  typedRoutes: false,
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
