import { type NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    typedEnv: true,
  },
};

export default nextConfig;
