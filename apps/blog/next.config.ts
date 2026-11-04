import createMDX from "@next/mdx";
import { tailwindRules } from "@zoonk/ui/turbopack";
import { type NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["**.local"],
  experimental: { turbopackRustReactCompiler: true },
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  reactCompiler: true,
  turbopack: { rules: tailwindRules },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
