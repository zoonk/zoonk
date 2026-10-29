import { availableParallelism } from "node:os";
import createMDX from "@next/mdx";
import { type NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["**.local"],
  experimental: { cpus: availableParallelism(), turbopackRustReactCompiler: true },
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  reactCompiler: true,
};

const withMDX = createMDX();

export default withMDX(nextConfig);
