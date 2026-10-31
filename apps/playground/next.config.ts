import { availableParallelism } from "node:os";
import { type NextConfig } from "next";

/** A local tool for developers: it's never deployed, so it has no auth and no image hosts. */
const nextConfig: NextConfig = {
  allowedDevOrigins: ["**.local"],
  cacheComponents: true,
  experimental: { cpus: availableParallelism(), turbopackRustReactCompiler: true, typedEnv: true },
  pageExtensions: ["ts", "tsx"],
  partialPrefetching: true,
  reactCompiler: true,
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
