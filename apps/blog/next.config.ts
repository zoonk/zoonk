import createMDX from "@next/mdx";
import { type NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.local"],
  experimental: {
    turbopackFileSystemCacheForBuild: true,
    turbopackRustReactCompiler: true,
    useTypeScriptCli: true,
  },
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  reactCompiler: true,
};

const withMDX = createMDX();

export default withMDX(nextConfig);
