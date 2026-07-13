import createMDX from "@next/mdx";
import { type NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.local"],
  devIndicators: false,
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  reactCompiler: true,
};

const withMDX = createMDX();

export default withMDX(nextConfig);
